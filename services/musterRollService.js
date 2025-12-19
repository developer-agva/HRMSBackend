const employeeModel = require("../models/employeeModel");
const AttendanceLogModel = require("../models/attendanceLogModel");
const EmployeeSalary = require("../models/employeeSalaryModel");
const holidaysModel = require("../models/holidayModel");
const leaveTakenHistoryModel = require("../models/leaveTakenHistoryModel");

/**
 * Get number of days in a month
 */
const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

/**
 * Format month for pay_slip_month lookup (e.g., "2025-11" or "11-2025")
 * Try both formats to be safe
 */
const formatPaySlipMonth = (year, month) => {
  const monthStr = String(month).padStart(2, "0");
  return [`${year}-${monthStr}`, `${monthStr}-${year}`];
};

/**
 * Map StatusCode to Muster Roll status
 * P = Present, HD = Half Day, A = Absent, H = Holiday, WO = Week Off
 * CL = Casual Leave, EL = Earned Leave, ML = Medical Leave
 */
const mapStatusCode = (statusCode, isHoliday, isWeeklyOff, leaveType) => {
  if (isHoliday) return "H";
  if (isWeeklyOff) return "WO";
  
  // Check for leave types
  if (leaveType) {
    if (leaveType === "casualLeave") return "CL";
    if (leaveType === "earnedLeave") return "EL";
    if (leaveType === "medicalLeave") return "ML";
    if (leaveType === "compOffLeave") return "CO"; // Comp Off
  }
  
  // Map status codes
  const code = (statusCode || "").toUpperCase();
  if (code === "P") return "P";
  if (code === "HD") return "HD";
  if (code === "A") return "A";
  
  return "A"; // Default to Absent
};

/**
 * Calculate attendance summary from attendance records
 */
const calculateAttendanceSummary = (attendanceRecords, monthDays, holidaysMap, leavesMap) => {
  let totalPresent = 0;
  let halfDay = 0;
  let holiday = 0;
  let weekOff = 0;
  let compOff = 0;
  let adjustedLeave = 0;
  let totalAbsent = 0;

  attendanceRecords.forEach((record) => {
    const date = new Date(record.AttendanceDate);
    const day = date.getDate();
    const dateKey = date.toISOString().split("T")[0];
    
    const isHoliday = holidaysMap.has(dateKey);
    const isWeeklyOff = record.WeeklyOff === 1;
    const leaveInfo = leavesMap.get(dateKey);
    
    const status = mapStatusCode(
      record.StatusCode,
      isHoliday,
      isWeeklyOff,
      leaveInfo?.leaveType
    );

    switch (status) {
      case "P":
        totalPresent += 1;
        break;
      case "HD":
        halfDay += 0.5;
        totalPresent += 0.5;
        break;
      case "H":
        holiday += 1;
        break;
      case "WO":
        weekOff += 1;
        break;
      case "CO":
        compOff += 1;
        break;
      case "CL":
      case "EL":
      case "ML":
        adjustedLeave += 1;
        break;
      case "A":
        totalAbsent += 1;
        break;
    }
  });

  // Calculate payable days: Present + Half Day + Adjusted Leave
  // WO and H don't reduce payable days
  const payableDays = totalPresent + halfDay + adjustedLeave;

  return {
    totalPresent: Math.round(totalPresent * 10) / 10, // Round to 1 decimal
    halfDay,
    holiday,
    weekOff,
    compOff,
    adjustedLeave,
    totalAbsent,
    payableDays: Math.round(payableDays * 10) / 10,
    monthDays,
  };
};

/**
 * Build day-wise attendance map (1-31)
 */
const buildAttendanceDaysMap = (attendanceRecords, monthDays, holidaysMap, leavesMap) => {
  const attendanceDays = {};

  // Initialize all days as empty
  for (let day = 1; day <= monthDays; day++) {
    attendanceDays[String(day)] = "";
  }

  // Fill in attendance records
  attendanceRecords.forEach((record) => {
    const date = new Date(record.AttendanceDate);
    const day = date.getDate();
    const dateKey = date.toISOString().split("T")[0];
    
    const isHoliday = holidaysMap.has(dateKey);
    const isWeeklyOff = record.WeeklyOff === 1;
    const leaveInfo = leavesMap.get(dateKey);
    
    const status = mapStatusCode(
      record.StatusCode,
      isHoliday,
      isWeeklyOff,
      leaveInfo?.leaveType
    );

    attendanceDays[String(day)] = status;
  });

  return attendanceDays;
};

/**
 * Get muster roll data for a specific month and year
 */
const getMusterRollData = async (year, month, employeeType = "all") => {
  try {
    // Validate inputs
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      throw new Error("Invalid year");
    }
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      throw new Error("Invalid month");
    }

    const monthDays = getDaysInMonth(yearNum, monthNum);
    const startOfMonth = new Date(yearNum, monthNum - 1, 1);
    const endOfMonth = new Date(yearNum, monthNum, 0, 23, 59, 59, 999);

    // Build employee filter
    const employeeFilter = {
      accountStatus: "Active",
      isWorking: true,
    };

    if (employeeType !== "all") {
      // Map "permanent" to "Permanent", "contractual" to "Contractual"
      const typeMap = {
        permanent: "Permanent",
        contractual: "Contractual",
      };
      employeeFilter.employmentType = typeMap[employeeType.toLowerCase()] || employeeType;
    }

    // Step 1: Fetch active employees (optimized query)
    const employees = await employeeModel
      .find(employeeFilter, {
        employeeId: 1,
        employeeCode: 1,
        employeeName: 1,
        designation: 1,
        employmentType: 1,
      })
      .lean();

    if (employees.length === 0) {
      return {
        data: [],
        summary: {
          totalEmployees: 0,
          totalPresent: 0,
          totalPayableDays: 0,
          totalGrossSalary: 0,
          totalNetSalary: 0,
        },
      };
    }

    const employeeCodes = employees.map((emp) => String(emp.employeeCode || emp.employeeId)).filter(Boolean);
    const employeeMap = new Map();
    employees.forEach((emp) => {
      const key = String(emp.employeeCode || emp.employeeId);
      employeeMap.set(key, emp);
    });

    // Step 2: Fetch attendance records for the month (single optimized query)
    const attendanceRecords = await AttendanceLogModel.find(
      {
        EmployeeCode: { $in: employeeCodes },
        AttendanceDate: {
          $gte: startOfMonth,
          $lte: endOfMonth,
        },
      },
      {
        EmployeeCode: 1,
        AttendanceDate: 1,
        StatusCode: 1,
        WeeklyOff: 1,
        Holiday: 1,
      }
    ).lean();

    // Step 3: Fetch holidays for the month
    const holidays = await holidaysModel.find({}).lean();
    const holidaysMap = new Set();
    holidays.forEach((holiday) => {
      // Handle both Date objects and string dates
      let holidayDate;
      if (holiday.holidayDate instanceof Date) {
        holidayDate = holiday.holidayDate;
      } else {
        holidayDate = new Date(holiday.holidayDate);
      }
      
      // Check if date is valid and within the month
      if (!isNaN(holidayDate.getTime()) && holidayDate >= startOfMonth && holidayDate <= endOfMonth) {
        holidaysMap.add(holidayDate.toISOString().split("T")[0]);
      }
    });

    // Step 4: Fetch approved leaves for the month
    const leaves = await leaveTakenHistoryModel
      .find({
        status: "Approved",
        employeeId: { $in: employeeCodes },
      })
      .lean();

    // Build per-employee leave maps upfront for better performance
    const employeeLeavesMap = new Map();
    employeeCodes.forEach((code) => {
      employeeLeavesMap.set(code, new Map());
    });

    leaves.forEach((leave) => {
      const empCode = String(leave.employeeId);
      if (!employeeLeavesMap.has(empCode)) {
        employeeLeavesMap.set(empCode, new Map());
      }
      
      const startDate = new Date(leave.leaveStartDate);
      const endDate = new Date(leave.leaveEndDate);
      
      // Generate all dates in the leave range
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split("T")[0];
        const leaveDate = new Date(dateKey);
        
        // Only include dates within the target month
        if (leaveDate >= startOfMonth && leaveDate <= endOfMonth) {
          const empLeaveMap = employeeLeavesMap.get(empCode);
          if (!empLeaveMap.has(dateKey)) {
            empLeaveMap.set(dateKey, {
              employeeId: leave.employeeId,
              leaveType: leave.leaveType,
            });
          }
        }
      }
    });

    // Step 5: Fetch payroll data for the month
    const paySlipMonths = formatPaySlipMonth(yearNum, monthNum);
    const payrollRecords = await EmployeeSalary.find({
      "employee_basic_details.employee_code": { $in: employeeCodes },
      pay_slip_month: { $in: paySlipMonths },
    }).lean();

    const payrollMap = new Map();
    payrollRecords.forEach((payroll) => {
      const empCode = String(payroll.employee_basic_details?.employee_code || "");
      if (empCode && employeeCodes.includes(empCode)) {
        payrollMap.set(empCode, payroll);
      }
    });

    // Step 6: Group attendance by employee
    const attendanceByEmployee = new Map();
    attendanceRecords.forEach((record) => {
      const empCode = String(record.EmployeeCode);
      if (!attendanceByEmployee.has(empCode)) {
        attendanceByEmployee.set(empCode, []);
      }
      attendanceByEmployee.get(empCode).push(record);
    });

    // Step 7: Build response data
    const musterRollData = [];
    let totalPresent = 0;
    let totalPayableDays = 0;
    let totalGrossSalary = 0;
    let totalNetSalary = 0;

    for (const employee of employees) {
      const empCode = String(employee.employeeCode || employee.employeeId);
      const attendanceRecordsForEmp = attendanceByEmployee.get(empCode) || [];
      
      // Get leaves map for this employee (pre-built)
      const empLeavesMap = employeeLeavesMap.get(empCode) || new Map();

      // Calculate attendance summary
      const attendanceSummary = calculateAttendanceSummary(
        attendanceRecordsForEmp,
        monthDays,
        holidaysMap,
        empLeavesMap
      );

      // Build day-wise attendance map
      const attendanceDays = buildAttendanceDaysMap(
        attendanceRecordsForEmp,
        monthDays,
        holidaysMap,
        empLeavesMap
      );

      // Get payroll data
      const payroll = payrollMap.get(empCode);
      
      // Extract salary details
      const salaryDetails = payroll?.salary_details || {};
      const grossSalary = parseFloat(salaryDetails.total_gross_salary || salaryDetails.fixed_gross_salary || "0");
      const actualGrossSalary = parseFloat(salaryDetails.total_gross_salary || "0");
      const arrears = parseFloat(salaryDetails.arrears || "0");
      const bonusOrEL = parseFloat(salaryDetails.bonus_or_others || "0");
      
      const deductions = {
        epf: parseFloat(salaryDetails.employee_pf || "0"),
        esi: parseFloat(salaryDetails.employee_esi || "0"),
        tds: parseFloat(salaryDetails.tds || "0"),
        advance: parseFloat(salaryDetails.loan_advance || "0"),
        transport: parseFloat(salaryDetails.transport_or_others || "0"),
      };
      
      const totalDeductions = Object.values(deductions).reduce((sum, val) => sum + val, 0);
      const netSalary = parseFloat(salaryDetails.net_pay || "0") || (actualGrossSalary - totalDeductions);

      // Build employee data
      const employeeData = {
        employeeInfo: {
          employeeId: employee.employeeId,
          employeeCode: employee.employeeCode || employee.employeeId,
          employeeName: employee.employeeName,
          designation: employee.designation || "",
          employeeType: employee.employmentType || "Permanent",
        },
        attendanceDays,
        attendanceSummary,
        salary: {
          grossSalary,
          actualGrossSalary,
          arrears,
          deductions,
          bonusOrEL,
          netSalary,
        },
        remarks: "",
      };

      musterRollData.push(employeeData);

      // Update totals
      totalPresent += attendanceSummary.totalPresent;
      totalPayableDays += attendanceSummary.payableDays;
      totalGrossSalary += grossSalary;
      totalNetSalary += netSalary;
    }

    // Build summary
    const summary = {
      totalEmployees: employees.length,
      totalPresent: Math.round(totalPresent * 10) / 10,
      totalPayableDays: Math.round(totalPayableDays * 10) / 10,
      totalGrossSalary: Math.round(totalGrossSalary * 100) / 100,
      totalNetSalary: Math.round(totalNetSalary * 100) / 100,
    };

    return {
      data: musterRollData,
      summary,
    };
  } catch (error) {
    console.error("Error in getMusterRollData:", error);
    throw error;
  }
};

module.exports = {
  getMusterRollData,
  calculateAttendanceSummary,
  mapStatusCode,
};

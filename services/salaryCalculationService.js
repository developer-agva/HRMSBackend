const employeeModel = require("../models/employeeModel");
const AttendanceLogModel = require("../models/attendanceLogModel");
const holidaysModel = require("../models/holidayModel");
const leaveTakenHistoryModel = require("../models/leaveTakenHistoryModel");
const { calculateAttendanceSummary } = require("./musterRollService");

/**
 * Get number of days in a month
 */
const getDaysInMonth = (year, month) => {
  return new Date(year, month, 0).getDate();
};

/**
 * Calculate total payable days (working days excluding holidays and weekly offs)
 */
const calculatePayableDays = async (year, month) => {
  const monthDays = getDaysInMonth(year, month);
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

  // Fetch all holidays for the month
  const holidays = await holidaysModel.find({}).lean();
  const holidaysSet = new Set();
  
  holidays.forEach((holiday) => {
    let holidayDate;
    if (holiday.holidayDate instanceof Date) {
      holidayDate = holiday.holidayDate;
    } else {
      holidayDate = new Date(holiday.holidayDate);
    }
    
    if (!isNaN(holidayDate.getTime()) && holidayDate >= startOfMonth && holidayDate <= endOfMonth) {
      holidaysSet.add(holidayDate.toISOString().split("T")[0]);
    }
  });

  // Count working days (excluding weekends and holidays)
  let payableDays = 0;
  for (let day = 1; day <= monthDays; day++) {
    const currentDate = new Date(year, month - 1, day);
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
    const dateKey = currentDate.toISOString().split("T")[0];
    
    // Exclude weekends (Saturday = 6, Sunday = 0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      // Exclude holidays
      if (!holidaysSet.has(dateKey)) {
        payableDays++;
      }
    }
  }

  return payableDays;
};

/**
 * Round to 2 decimal places
 */
const roundToTwoDecimals = (value) => {
  return Math.round(value * 100) / 100;
};

/**
 * Calculate salary components from adjusted gross
 * Basic = 50% of Adjusted Gross
 * HRA = 40% of Basic
 * Travel Allowance = 20% of Basic
 * Special Allowance = 40% of Basic
 */
const calculateSalaryComponents = (adjustedGross) => {
  const basic = roundToTwoDecimals(adjustedGross * 0.5);
  const hra = roundToTwoDecimals(basic * 0.4);
  const travelAllowance = roundToTwoDecimals(basic * 0.2);
  const specialAllowance = roundToTwoDecimals(basic * 0.4);

  return {
    basic,
    hra,
    travel_allowance: travelAllowance,
    special_allowance: specialAllowance,
  };
};

/**
 * Calculate worked days from attendance records
 * Worked Days = (Present × 1) + (Half Day × 0.5)
 * Note: totalPresent from calculateAttendanceSummary already includes half days (0.5 each)
 */
const calculateWorkedDays = (attendanceSummary) => {
  // totalPresent already includes full days + (half days × 0.5)
  return roundToTwoDecimals(attendanceSummary.totalPresent || 0);
};

/**
 * Generate salary sheet for a single employee
 */
const generateEmployeeSalarySheet = async (employee, year, month) => {
  try {
    const empCode = String(employee.employeeCode || employee.employeeId);
    const monthDays = getDaysInMonth(year, month);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

    // Get gross salary from employee model
    // Calculate gross salary from components if total_gross_salary is not available
    let grossSalary = parseFloat(employee.salary_details?.total_gross_salary || employee.salary_details?.fixed_gross_salary || "0");
    
    // If gross salary is not directly available, calculate from components
    if (!grossSalary || grossSalary <= 0) {
      const basic = parseFloat(employee.salary_details?.basic_salary || "0");
      const hra = parseFloat(employee.salary_details?.hra || "0");
      const travelAllowance = parseFloat(employee.salary_details?.travel_allowances || "0");
      const specialAllowance = parseFloat(employee.salary_details?.special_allowances || "0");
      const arrears = parseFloat(employee.salary_details?.arrears || "0");
      const bonus = parseFloat(employee.salary_details?.bonus_or_others || "0");
      
      grossSalary = basic + hra + travelAllowance + specialAllowance + arrears + bonus;
    }
    
    if (!grossSalary || grossSalary <= 0) {
      console.log(`⚠️  Employee ${empCode}: No gross salary found (calculated: ${grossSalary})`);
      return null; // Skip employees with no salary
    }

    // Fetch attendance records for the month
    const attendanceRecords = await AttendanceLogModel.find(
      {
        EmployeeCode: empCode,
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

    // Build holidays map
    const holidays = await holidaysModel.find({}).lean();
    const holidaysMap = new Set();
    holidays.forEach((holiday) => {
      let holidayDate;
      if (holiday.holidayDate instanceof Date) {
        holidayDate = holiday.holidayDate;
      } else {
        holidayDate = new Date(holiday.holidayDate);
      }
      if (!isNaN(holidayDate.getTime()) && holidayDate >= startOfMonth && holidayDate <= endOfMonth) {
        holidaysMap.add(holidayDate.toISOString().split("T")[0]);
      }
    });

    // Fetch approved leaves for the employee
    const leaves = await leaveTakenHistoryModel
      .find({
        status: "Approved",
        employeeId: empCode,
      })
      .lean();

    // Build leaves map
    const leavesMap = new Map();
    leaves.forEach((leave) => {
      const startDate = new Date(leave.leaveStartDate);
      const endDate = new Date(leave.leaveEndDate);
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = d.toISOString().split("T")[0];
        const leaveDate = new Date(dateKey);
        if (leaveDate >= startOfMonth && leaveDate <= endOfMonth) {
          if (!leavesMap.has(dateKey)) {
            leavesMap.set(dateKey, {
              employeeId: leave.employeeId,
              leaveType: leave.leaveType,
            });
          }
        }
      }
    });

    // Calculate attendance summary using existing logic
    const attendanceSummary = calculateAttendanceSummary(
      attendanceRecords,
      monthDays,
      holidaysMap,
      leavesMap
    );

    // Calculate payable days (total working days excluding holidays and weekly offs)
    const payableDays = await calculatePayableDays(year, month);
    
    if (payableDays <= 0) {
      console.log(`⚠️  Employee ${empCode}: No payable days for ${month}/${year}`);
      return null; // Skip if no payable days
    }

    // Calculate worked days
    const workedDays = calculateWorkedDays(attendanceSummary);

    // Calculate daily rate
    const dailyRate = roundToTwoDecimals(grossSalary / payableDays);

    // Calculate adjusted gross
    const adjustedGross = roundToTwoDecimals(dailyRate * workedDays);

    // Calculate salary components
    const salaryComponents = calculateSalaryComponents(adjustedGross);

    // Get deductions from employee model
    const deductions = {
      employee_pf: parseFloat(employee.salary_details?.employee_pf || "0"),
      employee_esi: parseFloat(employee.salary_details?.employee_esi || "0"),
      tds: parseFloat(employee.salary_details?.tds || "0"),
      loan_advance: parseFloat(employee.salary_details?.loan_advance || "0"),
      penalty: parseFloat(employee.salary_details?.penalty || "0"),
      transport_or_others: parseFloat(employee.salary_details?.transport_or_others || "0"),
    };

    // Calculate total deductions
    const totalDeductions = roundToTwoDecimals(
      Object.values(deductions).reduce((sum, val) => sum + val, 0)
    );

    // Calculate net pay
    const netPay = roundToTwoDecimals(adjustedGross - totalDeductions);

    return {
      employee_id: employee._id,
      employee_code: empCode,
      month,
      year,
      payable_days: payableDays,
      worked_days: workedDays,
      gross_salary: roundToTwoDecimals(grossSalary),
      daily_rate: dailyRate,
      adjusted_gross: adjustedGross,
      salary_components: {
        basic: salaryComponents.basic,
        hra: salaryComponents.hra,
        travel_allowance: salaryComponents.travel_allowance,
        special_allowance: salaryComponents.special_allowance,
      },
      deductions: {
        employee_pf: roundToTwoDecimals(deductions.employee_pf),
        employee_esi: roundToTwoDecimals(deductions.employee_esi),
        tds: roundToTwoDecimals(deductions.tds),
        loan_advance: roundToTwoDecimals(deductions.loan_advance),
        penalty: roundToTwoDecimals(deductions.penalty),
        transport_or_others: roundToTwoDecimals(deductions.transport_or_others),
        total_deductions: totalDeductions,
      },
      net_pay: netPay,
      generated_at: new Date(),
      generated_by: "system",
      is_locked: false,
    };
  } catch (error) {
    console.error(`Error generating salary sheet for employee ${employee.employeeCode || employee.employeeId}:`, error);
    return null;
  }
};

/**
 * Generate salary sheets for all active employees for a given month and year
 */
const generateSalarySheets = async (year, month, generatedBy = "system") => {
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

    // Fetch all active employees
    const employees = await employeeModel
      .find(
        {
          accountStatus: "Active",
          isWorking: true,
        },
        {
          _id: 1,
          employeeId: 1,
          employeeCode: 1,
          salary_details: 1,
        }
      )
      .lean();

    if (employees.length === 0) {
      return {
        success: true,
        message: "No active employees found",
        totalEmployees: 0,
        processed: 0,
        skipped: 0,
        errors: [],
      };
    }

    const SalarySheet = require("../models/salarySheetModel");
    const results = {
      success: true,
      totalEmployees: employees.length,
      processed: 0,
      skipped: 0,
      errors: [],
      salarySheets: [],
    };

    // Process each employee
    for (const employee of employees) {
      try {
        const empCode = employee.employeeCode || employee.employeeId;
        
        // Check if salary sheet already exists
        const existingSheet = await SalarySheet.findOne({
          employee_id: employee._id,
          month: monthNum,
          year: yearNum,
        });

        if (existingSheet) {
          results.skipped++;
          console.log(`⏭️  Skipping ${empCode}: Salary sheet already exists`);
          continue; // Skip if already exists
        }

        // Generate salary sheet
        const salarySheet = await generateEmployeeSalarySheet(employee, yearNum, monthNum);

        if (!salarySheet) {
          results.skipped++;
          console.log(`⏭️  Skipping ${empCode}: No salary data or no payable days`);
          continue; // Skip employees with no salary or no payable days
        }

        // Set generated_by
        salarySheet.generated_by = generatedBy;

        // Save to database
        const savedSheet = await SalarySheet.create(salarySheet);
        results.salarySheets.push(savedSheet);
        results.processed++;
        console.log(`✅ Generated salary sheet for ${empCode}`);
      } catch (error) {
        const empCode = employee.employeeCode || employee.employeeId;
        console.error(`❌ Error processing ${empCode}:`, error.message);
        results.errors.push({
          employee_code: empCode,
          error: error.message,
        });
        results.skipped++;
      }
    }

    return results;
  } catch (error) {
    console.error("Error generating salary sheets:", error);
    throw error;
  }
};

module.exports = {
  generateSalarySheets,
  generateEmployeeSalarySheet,
  calculatePayableDays,
  calculateSalaryComponents,
  calculateWorkedDays,
};

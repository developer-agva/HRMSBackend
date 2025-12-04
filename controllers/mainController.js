// const { connectToDB } = require("../config/dbConfig");
const { duration } = require("moment");
const AttendanceLogModel = require("../models/attendanceLogModel");
const { format } = require("mysql");
const cron = require('node-cron');
const leaveTakenHistoryModel = require("../models/leaveTakenHistoryModel");
const holidaysModel = require("../models/holidayModel");
const employeeModel = require("../models/employeeModel");
const { DateTime } = require("mssql");
const moment = require("moment-timezone");
const attendanceLogModelForOutDuty = require("../models/attendanceLogModelForOutDuty");
const employeeSalaryModel = require("../models/employeeSalaryModel");
const jwt = require("jsonwebtoken");
const employeeLocationModel = require("../models/employeeLocationModel");
const trackolapAttendanceModel = require("../models/trackolapAttendanceModel");
const deleteUninformedLeaves = require('../utils/deleteUninformedLeaves');
const generateUninformedForSales = require('../utils/generateUninformedForSales');


// // Get all tables in the database
// const getTables = async (req, res) => {
//   try {
//     const pool = await connectToDB();
//     const result = await pool.request().query(`
//       SELECT TABLE_NAME 
//       FROM INFORMATION_SCHEMA.TABLES 
//       WHERE TABLE_TYPE = 'BASE TABLE'
//     `);
//     res.status(200).json(result.recordset);
//   } catch (err) {
//     console.error("Error fetching tables:", err.message);
//     res.status(500).send(err.message);
//   }
// };

// const getEmployees = async (req, res) => {
//   try {
//     const pool = await connectToDB();
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const offset = (page - 1) * limit;

//     let query = `
//       SELECT *
//       FROM Employees
//       WHERE Status = 'Working'
//       ORDER BY EmployeeName
//       OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
//     `;

//     // Query for total count of records
//     const countQuery = `
//       SELECT COUNT(*) AS TotalCount
//       FROM Employees
//       WHERE Status = 'Working'
//     `;

//     const result = await pool.request().query(query);
//     const resultCount = await pool.request().query(countQuery);

//     const totalCount = resultCount.recordset[0].TotalCount;
//     const totalPages = Math.ceil(totalCount/limit);


//     if (result.recordsets.length > 0) {
//       return res.status(200).json({
//         statusCode: 200,
//         statusValue: "SUCCESS",
//         message: "Employee list get successfully.",
//         data: result.recordset,
//         totalRecords: totalCount,
//         totalPages: totalPages,
//         currentPage: page,
//         limit: limit
//       });
//     } else {
//       return res.status(400).json({ 
//         statusCode: 400,
//         statusValue: "FAIL",
//         message: "No records found." 
//       });
//     }
//   } catch (err) {
//     console.error("Error fetching employees:", err.message);
//     res.status(500).send(err.message);
//   }
// };


//For PunchTime Details
// const getPunchTimeDetails = async (req, res) => {
//   try {
//     const pool = await connectToDB();
//     const result = await pool.request().query("SELECT * FROM PunchTimeDetails");
//     res.status(200).json(result.recordset);
//   } catch (err) {
//     console.error("Error fetching PunchTimeDetails:", err.message);
//     res.status(500).send(err.message);
//   }
// };


// Get all records from AttendanceLogs
// const getAllAttendanceLogs = async (req, res) => {
//   try {
//     const pool = await connectToDB();
//     // Extract EmployeeId, page, and limit from query parameters
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;

//     const offset = (page - 1) * limit;
//     let query = `
//       SELECT 
//       Employees.EmployeeName, 
//       Employees.EmployeeCode, 
//       Employees.Gender, 
//       Employees.Designation, 
//       Employees.CategoryId,  
//       Employees.EmployementType,  
//       Employees.EmployeeDevicePassword, 
//       Employees.FatherName, 
//       Employees.MotherName, 
//       Employees.ResidentialAddress, 
//       Employees.PermanentAddress, 
//       Employees.ContactNo, 
//       Employees.Email, 
//       Employees.DOB, 
//       Employees.Location, 
//       Employees.WorkPlace, 
//       Employees.ExtensionNo, 
//       Employees.LoginName, 
//       Employees.LoginPassword, 
//       Employees.EmployeePhoto,
//       AttendanceLogs.*
//       FROM AttendanceLogs
//       LEFT JOIN Employees ON AttendanceLogs.EmployeeId = Employees.EmployeeId
//       WHERE AttendanceLogs.AttendanceDate <= GETDATE()
//       ORDER BY AttendanceLogs.AttendanceDate DESC -- Minimal ordering to support OFFSET-FETCH
//       OFFSET ${offset} ROWS
//       FETCH NEXT ${limit} ROWS ONLY
//     `;
//     const result = await pool.request().query(query);

//     if (result.recordsets.length > 0) {
//       return res.status(200).json({
//         statusCode: 200,
//         statusValue: "SUCCESS",
//         message: "Attendance records get successfully.",
//         data :result.recordsets[0]
//       });
//     } else {
//       return res.status(400).json({ 
//         statusCode: 400,
//         statusValue: "FAIL",
//         message: "No records found for the given EmployeeId." 
//       });
//     }
//   } catch (err) {
//     console.error('Error fetching attendance logs:', err.message);
//     res.status(500).send(err.message);
//   }
// };

//Get AttendanceLogsUpdateDetails

// const getAttendanceLogsUpdateDetails = async (req, res) => {
//   try {
//     const pool = await connectToDB();
//     const result = await pool
//       .request()
//       .query("SELECT * FROM AttendanceLogUpdateDetails");

//     // console.log("RESULT IS",result);
//     res.status(200).json(result.recordset);
//   } catch (err) {
//     console.error("Error fetching attendance logs:", err.message);
//     res.status(500).send(err.message);
//   }
// };


// const getAllAttendanceLogs = async (req, res) => {
//   try {
//     const AttendanceLogModel = await AttendanceLogModel.find({})
//     const pool = await connectToDB();
//     // Extract query parameters
//     const dateTo = req.query.dateTo ? req.query.dateTo.toString() : null;
//     const dateFrom = req.query.dateFrom ? req.query.dateFrom.toString() : null;
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const offset = (page - 1) * limit;

//     // Build base query
//     let query = `
//       SELECT 
//           Employees.EmployeeName, 
//           Employees.EmployeeCode, 
//           Employees.Gender, 
//           Employees.Designation, 
//           Employees.CategoryId,  
//           Employees.EmployementType,  
//           Employees.EmployeeDevicePassword, 
//           Employees.FatherName, 
//           Employees.MotherName, 
//           Employees.ResidentialAddress, 
//           Employees.PermanentAddress, 
//           Employees.ContactNo, 
//           Employees.Email, 
//           Employees.DOB, 
//           Employees.Location, 
//           Employees.WorkPlace, 
//           Employees.ExtensionNo, 
//           Employees.LoginName, 
//           Employees.LoginPassword, 
//           Employees.EmployeePhoto,
//           AttendanceLogs.*
//       FROM AttendanceLogs
//       LEFT JOIN Employees ON AttendanceLogs.EmployeeId = Employees.EmployeeId
//     `;

//     // Add optional date filters
//     if (dateFrom && dateTo) {
//       query += ` WHERE AttendanceLogs.AttendanceDate BETWEEN '${dateFrom}' AND '${dateTo}' `;
//     }

//      // Add pagination
//     query += `
//       ORDER BY AttendanceLogs.AttendanceDate DESC
//       OFFSET ${offset} ROWS
//       FETCH NEXT ${limit} ROWS ONLY
//     `;

//     // Get total count for metadata
//     const countQuery = `
//       SELECT COUNT(*) AS totalCount
//       FROM AttendanceLogs
//       ${dateFrom && dateTo ? `WHERE AttendanceLogs.AttendanceDate BETWEEN '${dateFrom}' AND '${dateTo}'` : ""}
//     `;

//     const [dataResult, countResult] = await Promise.all([
//       pool.request().query(query),
//       pool.request().query(countQuery)
//     ]);

//     const totalRecords = countResult.recordset[0].totalCount;
//     const totalPages = Math.ceil(totalRecords / limit);

//     if (dataResult.recordset.length > 0) {
//       return res.status(200).json({
//         statusCode: 200,
//         statusValue: "SUCCESS",
//         message: "Attendance records fetched successfully.",
//         data: dataResult.recordset,
//         totalRecords,
//         totalPages,
//         currentPage: page,
//         limit,
//       });
//     } else {
//       return res.status(400).json({
//         statusCode: 400,
//         statusValue: "FAIL",
//         message: "No records found for the given filters."
//       });
//     }
//   } catch (err) {
//     console.error("Error fetching attendance logs:", err.message);
//     res.status(500).json({
//       statusCode: 500,
//       statusValue: "ERROR",
//       message: "An error occurred while fetching attendance logs.",
//       error: err.message
//     });
//   }
// };

const getAllAttendanceLogs = async (req, res) => {
  try {
    // Extract query parameters
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 31;
    const offset = (page - 1) * limit;

    // Build the filter object for MongoDB query
    let filter = {};

    // Apply date range filter
    if (dateFrom && dateTo) {
      filter.AttendanceDate = {
        $gte: dateFrom,
        $lte: dateTo
      };
    }

    // MongoDB query to fetch attendance records with pagination and filters
    const dataResult = await AttendanceLogModel.find(filter)
      .skip(offset)
      .limit(limit)
      .sort({ AttendanceDate: -1 });

    // Remove duplicates based on AttendanceDate and EmployeeCode
    const uniqueRecords = dataResult.reduce((acc, record) => {
      const uniqueKey = `${record.AttendanceDate.toISOString()}_${record.EmployeeCode}`;
      if (!acc.seen.has(uniqueKey)) {
        acc.seen.add(uniqueKey);
        acc.filtered.push(record);
      }
      return acc;
    }, { seen: new Set(), filtered: [] }).filtered;

    // get leave history
    const leaveData = await leaveTakenHistoryModel.find({ status: "Approved" }, { employeeId: 1, leaveType: 1, leaveStartDate: 1, leaveEndDate: 1 })
    // console.log(11, leaveData)
    const finalResult = uniqueRecords.map(attendance => {
      const attendanceObj = attendance.toObject();
      const matchingLeave = leaveData.find(leave => {
        const leaveStart = new Date(leave.leaveStartDate);
        const leaveEnd = new Date(leave.leaveEndDate);
        return (
          leave.employeeId === attendanceObj.EmployeeCode &&
          attendanceObj.AttendanceDate >= leaveStart &&
          attendanceObj.AttendanceDate <= leaveEnd
        );
      });

      if (matchingLeave) {
        return {
          ...attendanceObj,
          isLeaveTaken: true,
          leaveType: matchingLeave.leaveType
        };
      }
      return {
        ...attendanceObj,
        isLeaveTaken: false,
        leaveType: ""
      };
    });

    // console.log(11, finalResult)
    // Get the total count of records for pagination metadata
    const totalRecords = await AttendanceLogModel.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);

    if (uniqueRecords.length > 0) {
      return res.status(200).json({
        statusCode: 200,
        statusValue: "SUCCESS",
        message: "Attendance records fetched successfully.",
        data: finalResult,
        totalRecords,
        totalPages,
        currentPage: page,
        limit,
      });
    } else {
      return res.status(400).json({
        statusCode: 400,
        statusValue: "FAIL",
        message: "No records found for the given filters."
      });
    }
  } catch (err) {
    console.error("Error fetching attendance logs:", err.message);
    res.status(500).json({
      statusCode: 500,
      statusValue: "ERROR",
      message: "An error occurred while fetching attendance logs.",
      error: err.message
    });
  }
};


const approvedPendingLeaves = async (req, res) => {
  try {
    const { monthStart, monthEnd } = req.query;

    // Ensure default values if query params are missing
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = String(currentDate.getMonth() + 1).padStart(2, "0");

    // Default to the current month's start and end if query params are not provided
    const startDate = monthStart || `${currentYear}-${currentMonth}-01`;
    const endDate = monthEnd || `${currentYear}-${currentMonth}-31`;

    // Fetch pending leave requests within the given range
    const pendingLeaves = await leaveTakenHistoryModel.find(
      {
        status: "Pending",
        leaveStartDate: { $gte: startDate, $lte: endDate },
        leaveEndDate: { $gte: startDate, $lte: endDate },
      },
      { employeeId: 1, leaveType: 1, totalDays: 1, leaveStartDate: 1, leaveEndDate: 1, duration: 1 }
    );

    if (!pendingLeaves.length) {
      return res.status(200).json({
        statusCode: 200,
        statusValue: "SUCCESS",
        message: "No pending leaves found for the current month.",
      });
    }

    let approvedLeaves = [];
    let insufficientBalanceLeaves = [];

    const getIndiaCurrentDateTime = () => {
      const indiaTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
      const date = new Date(indiaTime);

      const pad = (n) => (n < 10 ? `0${n}` : n);

      const year = date.getFullYear();
      const month = pad(date.getMonth() + 1);
      const day = pad(date.getDate());
      const hours = pad(date.getHours());
      const minutes = pad(date.getMinutes());
      const seconds = pad(date.getSeconds());

      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    const dateTime = getIndiaCurrentDateTime();

    for (const leave of pendingLeaves) {
      const { employeeId, leaveType, totalDays, duration } = leave;

      // Find the employee record
      const employee = await employeeModel.findOne({ employeeId });

      if (!employee) {
        console.log(`Employee ${employeeId} not found.`);
        continue;
      }

      // Handle "vendor-meeting" leave type separately (auto-approve)
      if (leaveType === "vendor-meeting") {
        // Normalize duration based on string value
        let newDuration = leave.duration;

        if (["0.5", ".5", "first-half", "second-half"].includes(leave.duration)) {
          newDuration = "240";
        } else if (["1", "1.0", "full-day"].includes(leave.duration)) {
          newDuration = "500";
        }

        // Update the leave document
        await leaveTakenHistoryModel.updateOne(
          { _id: leave._id },
          {
            $set: {
              status: "Approved",
              approvedDateTime: dateTime,
              remarks: "Auto-approved: Vendor meeting",
              duration: newDuration
            },
          }
        );

        approvedLeaves.push({
          employeeId,
          leaveType,
          totalDays: leave.totalDays,
          duration: newDuration,
          leaveStartDate: leave.leaveStartDate,
          leaveEndDate: leave.leaveEndDate,
          status: "Approved",
          approvedDateTime: dateTime,
          remarks: "Auto-approved: Vendor meeting",
        });

        console.log(`Auto-approved vendor meeting for Employee ${employeeId} with updated duration ${newDuration}`);
        continue;
      }


      // Get current leave balance for the leaveType
      let availableLeaveBal = parseFloat(employee.leaveBalance[leaveType] || "0");
      let deductedDays = parseFloat(totalDays);

      // Ensure the leave can be deducted
      if (availableLeaveBal >= deductedDays) {
        availableLeaveBal -= deductedDays;

        // Update the employee's leave balance
        await employeeModel.updateOne(
          { employeeId },
          { $set: { [`leaveBalance.${leaveType}`]: availableLeaveBal.toString() } }
        );

        // Approve the leave request
        await leaveTakenHistoryModel.updateOne(
          { _id: leave._id },
          {
            $set: {
              status: "Approved",
              approvedDateTime: dateTime,
              remarks: "Action taken automatically at month end.",
            },
          }
        );

        console.log(`Approved leave for Employee ${employeeId}, Deducted ${deductedDays} from ${leaveType}.`);
        approvedLeaves.push({
          employeeId,
          leaveType,
          totalDays,
          leaveStartDate: leave.leaveStartDate,
          leaveEndDate: leave.leaveEndDate,
          status: "Approved",
          approvedDateTime: dateTime,
          remarks: "Action taken automatically at month end.",
        });
      } else {
        insufficientBalanceLeaves.push({
          employeeId,
          leaveType,
          totalDays,
          leaveStartDate: leave.leaveStartDate,
          leaveEndDate: leave.leaveEndDate,
          status: "Rejected",
          approvedDateTime: dateTime,
        });

        console.log(`Insufficient ${leaveType} balance for Employee ${employeeId}.`);
      }
    }

    return res.status(200).json({
      statusCode: 200,
      statusValue: "SUCCESS",
      message: "Pending leaves processed for the current month.",
      approvedLeaves,
      insufficientBalanceLeaves,
    });
  } catch (err) {
    console.error("Error processing pending leaves:", err);
    res.status(500).json({
      statusCode: 500,
      statusValue: "ERROR",
      message: "An error occurred while processing pending leaves.",
      error: err.message,
    });
  }
};



const generateUninformedLeave = async (req, res) => {
  try {

    // Extract query parameters
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;

    // Build the filter object for MongoDB query
    let filter = {};

    // Apply date range filter
    if (dateFrom && dateTo) {
      filter.AttendanceDate = {
        $gte: dateFrom,
        $lte: dateTo
      };
    }
    // Fetch attendance records
    const dataResult = await AttendanceLogModel.find(filter, {
      AttendanceDate: 1, EmployeeCode: 1, Duration: 1, Status: 1, EmployeeId: 1, InTime: 1
    });

    // Remove duplicate attendance records Absent
    const uniqueRecords = dataResult.reduce((acc, record) => {
      // Check for null values before processing
      if (!record.AttendanceDate || !record.EmployeeCode) {
        console.warn(`Skipping record with null AttendanceDate or EmployeeCode:`, record);
        return acc;
      }
      
      const uniqueKey = `${record.AttendanceDate.toISOString()}_${record.EmployeeCode}`;
      if (!acc.seen.has(uniqueKey)) {
        acc.seen.add(uniqueKey);
        acc.filtered.push(record);
      }
      return acc;
    }, { seen: new Set(), filtered: [] }).filtered;

    if (uniqueRecords.length === 0) {
      return res.status(200).json({
        statusCode: 200,
        statusValue: "SUCCESS",
        message: "No attendance records found in the given date range.",
        data: []
      });
    }

    // Fetch all employees to create employee-manager map
    const employeesData = await employeeModel.find({ accountStatus: "Active" }, { employeeId: 1, managerId: 1, workingDays: 1 });

    // Create employee-manager map
    const employeeManagerMap = new Map();
    employeesData.forEach(emp => {
      // Check for null employeeId before processing
      if (emp.employeeId) {
        employeeManagerMap.set(emp.employeeId.toString(), {
          managerId: emp.managerId,
          workingDays: emp.workingDays
        });
      }
    });

    // Fetch leave history (Approved)
    const leaveData = await leaveTakenHistoryModel.find(
      { $or: [{ status: "Pending" }, { status: "Approved" }] },
      { employeeId: 1, leaveType: 1, leaveStartDate: 1, leaveEndDate: 1 }
    );
    //  console.log(uniqueRecords) 
    // Filter records where leave does NOT match
    const notMatchingLeaves = uniqueRecords
      .filter(attendance => {
        return !leaveData.some(leave => {
          // Check for null values before comparison
          if (!leave.employeeId || !attendance.EmployeeCode) {
            return false;
          }
          return (
            leave.employeeId.toString() === attendance.EmployeeCode.toString() &&
            attendance.AttendanceDate >= leave.leaveStartDate &&
            attendance.AttendanceDate <= leave.leaveEndDate
          );
        });
      })
      .map(attendance => {
        const employeeData = employeeManagerMap.get(attendance.EmployeeCode?.toString()) || {};
        return {
          ...attendance.toObject(),
          managerId: employeeData.managerId || null,
          workingDays: employeeData.workingDays || null
        };
      });
    // console.log(11, notMatchingLeaves) 

    // Filter based on working hours and manager availability
    const filteredLeaves = notMatchingLeaves.filter(attendance => {
      if (attendance.managerId === null) return false;

      // Check Duration
      if (attendance.Duration < 500) return true;

      // Parse InTime and compare
      if (attendance.InTime) {
        const inTimeStr = attendance.InTime.split(" ")[1]; // Get the time part
        return inTimeStr > "09:15:59"; // Compare string times directly
      }

      return false;
    });

    // Fetch holiday list
    const holidayList = await holidaysModel.find({}, { holidayDate: 1 });
    const holidayDates = new Set(holidayList.map(holiday => holiday.holidayDate));

    // Remove weekend and holiday attendance records
    const filteredData = filteredLeaves.filter(record => {
      const attendanceDate = new Date(record.AttendanceDate);
      const dayOfWeek = attendanceDate.getUTCDay();
      const formattedDate = attendanceDate.toISOString().split("T")[0];

      if (record.workingDays === "5" && (dayOfWeek === 0 || dayOfWeek === 6)) {
        return false;
      }
      if (record.workingDays === "6" && dayOfWeek === 0) {
        return false;
      }
      if (holidayDates.has(formattedDate)) {
        return false;
      }

      return true;
    });

    const getIndiaCurrentDateTime = () => {
      const indiaTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
      const date = new Date(indiaTime);

      const pad = (n) => (n < 10 ? `0${n}` : n);

      const year = date.getFullYear();
      const month = pad(date.getMonth() + 1); // Months are 0-based
      const day = pad(date.getDate());
      const hours = pad(date.getHours());
      const minutes = pad(date.getMinutes());
      const seconds = pad(date.getSeconds());

      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    };

    const dateTime = getIndiaCurrentDateTime()

    // Create uninformed leave records
    const leaveRecords = filteredData.map(attendance => {
      // Check for null AttendanceDate before processing
      if (!attendance.AttendanceDate) {
        console.warn(`Skipping attendance record with null AttendanceDate:`, attendance);
        return null;
      }
      
      const attendanceDate = attendance.AttendanceDate.toISOString().split("T")[0];
      const totalDays =
        attendance.Duration < 240 ? "1" :
          attendance.Duration >= 240 && attendance.Duration < 500 ? "0.5" :
            attendance.InTime && attendance.InTime.split(" ")[1] > "09:15:59" ? "0.5" :
              "0";

      return {
        employeeId: attendance.EmployeeCode,
        leaveType: "uninformedLeave",
        leaveStartDate: attendanceDate,
        leaveEndDate: attendanceDate,
        totalDays,
        reason: "This is system-generated leave",
        approvedBy: attendance.managerId || "System",
        status: "Approved",
        dateTime,
        approvedDateTime: dateTime
      };
    }).filter(record => record !== null); // Remove null records
    // console.log(11, leaveRecords)
  
    // Insert into MongoDB
    if (leaveRecords.length > 0) {
      await leaveTakenHistoryModel.insertMany(leaveRecords);
    }

    const updatedLeaves = await leaveTakenHistoryModel.find(
      {},
      { employeeId: 1, leaveType: 1, leaveStartDate: 1, leaveEndDate: 1 }
    );

    const leaveMap = new Map();
    const uninformedLeaveMap = new Map();
    const leavesToDelete = [];
    
    // Step 1: Store other leave types in a Map
    updatedLeaves.forEach(leave => {
      const key = `${leave.employeeId}`;

      if (leave.leaveType !== "uninformedLeave") {
        if (!leaveMap.has(key)) leaveMap.set(key, []);
        leaveMap.get(key).push({
          startDate: new Date(leave.leaveStartDate),
          endDate: new Date(leave.leaveEndDate),
        });
      } else {
        // Collect uninformedLeave records separately
        if (!uninformedLeaveMap.has(key)) uninformedLeaveMap.set(key, []);
        uninformedLeaveMap.get(key).push({
          _id: leave._id,
          startDate: new Date(leave.leaveStartDate),
          endDate: new Date(leave.leaveEndDate),
        });
      }
    });

    // Step 2: Identify uninformedLeave records to delete
    uninformedLeaveMap.forEach((uninformedLeaves, employeeId) => {
      const existingLeaves = leaveMap.get(employeeId) || [];

      // Sort uninformedLeave records by date to handle duplicates
      uninformedLeaves.sort((a, b) => a.startDate - b.startDate);

      const keptUninformedLeaves = [];

      uninformedLeaves.forEach(leave => {
        const startDate = leave.startDate;
        const endDate = leave.endDate;

        // Check if this uninformedLeave overlaps with an existing leave
        const hasOverlap = existingLeaves.some(el => startDate >= el.startDate && endDate <= el.endDate);

        if (hasOverlap || keptUninformedLeaves.some(existing => existing.startDate.getTime() === startDate.getTime())) {
          // If it overlaps with another leave or is a duplicate uninformedLeave, mark for deletion
          leavesToDelete.push(leave._id);
        } else {
          // Otherwise, keep it as a valid uninformedLeave record
          keptUninformedLeaves.push(leave);
        }
      });
    });

    // Step 3: Delete the identified uninformedLeave records
    if (leavesToDelete.length > 0) {
      await leaveTakenHistoryModel.deleteMany({ _id: { $in: leavesToDelete } });
      console.log(`Deleted ${leavesToDelete.length} uninformedLeave records.`);
    } else {
      console.log("No uninformedLeave records to delete.");
    }
     
    // check and delete uninformed leave of trackolap data
    deleteUninformedLeaves();
    generateUninformedForSales();

    return res.status(200).json({
      statusCode: 200,
      statusValue: "SUCCESS",
      message: "Attendance records processed successfully.",
      data: leaveRecords,
      // data2: trackolapData
    });
  } catch (err) {
    console.error("Error fetching attendance logs:", err);
    res.status(500).json({
      statusCode: 500,
      statusValue: "ERROR",
      message: "An error occurred while processing attendance logs.",
      error: err.message
    });
  }
};


// const generateUninformedLeave = async (req, res) => {
//   try {

//     // Extract query parameters
//     const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
//     const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;

//     // Build the filter object for MongoDB query
//     let filter = {};

//     // Apply date range filter
//     if (dateFrom && dateTo) {
//       filter.AttendanceDate = {
//         $gte: dateFrom,
//         $lte: dateTo
//       };
//     }
//     // Fetch attendance records
//     const dataResult = await AttendanceLogModel.find(filter, {
//       AttendanceDate: 1, EmployeeCode: 1, Duration: 1, Status: 1, EmployeeId: 1
//     });

//     // Remove duplicate attendance records Absent
//     const uniqueRecords = dataResult.reduce((acc, record) => {
//       const uniqueKey = `${record.AttendanceDate.toISOString()}_${record.EmployeeCode}`;
//       if (!acc.seen.has(uniqueKey)) {
//         acc.seen.add(uniqueKey);
//         acc.filtered.push(record);
//       }
//       return acc;
//     }, { seen: new Set(), filtered: [] }).filtered;

//     if (uniqueRecords.length === 0) {
//       return res.status(200).json({
//         statusCode: 200,
//         statusValue: "SUCCESS",
//         message: "No attendance records found in the given date range.",
//         data: []
//       });
//     }

//     // Fetch all employees to create employee-manager map
//     const employeesData = await employeeModel.find({}, { employeeId: 1, managerId: 1, workingDays: 1 });

//     // Create employee-manager map
//     const employeeManagerMap = new Map();
//     employeesData.forEach(emp => {
//       employeeManagerMap.set(emp.employeeId.toString(), {
//         managerId: emp.managerId,
//         workingDays: emp.workingDays
//       });
//     });

//     // Fetch leave history (Approved)
//     const leaveData = await leaveTakenHistoryModel.find(
//       {$or:[{status:"Pending"},{status:"Approved"}]},
//       { employeeId: 1, leaveType: 1, leaveStartDate: 1, leaveEndDate: 1 }
//     );

//     // Filter records where leave does NOT match
//     const notMatchingLeaves = uniqueRecords
//       .filter(attendance => {
//         return !leaveData.some(leave => {
//           return (
//             leave.employeeId.toString() === attendance.EmployeeCode &&
//             attendance.AttendanceDate >= leave.leaveStartDate &&
//             attendance.AttendanceDate <= leave.leaveEndDate
//           );
//         });
//       })
//       .map(attendance => {
//         const employeeData = employeeManagerMap.get(attendance.EmployeeCode.toString()) || {};
//         return {
//           ...attendance.toObject(),
//           managerId: employeeData.managerId || null,
//           workingDays: employeeData.workingDays || null
//         };
//       });
//     // console.log(11, notMatchingLeaves) 

//     // Filter based on working hours and manager availability
//     const filteredLeaves = notMatchingLeaves.filter(attendance =>
//       attendance.Duration < 520 && attendance.managerId !== null
//     );

//     // Fetch holiday list
//     const holidayList = await holidaysModel.find({}, { holidayDate: 1 });
//     const holidayDates = new Set(holidayList.map(holiday => holiday.holidayDate));

//     // Remove weekend and holiday attendance records
//     const filteredData = filteredLeaves.filter(record => {
//       const attendanceDate = new Date(record.AttendanceDate);
//       const dayOfWeek = attendanceDate.getUTCDay();
//       const formattedDate = attendanceDate.toISOString().split("T")[0];

//       if (record.workingDays === "5" && (dayOfWeek === 0 || dayOfWeek === 6)) {
//         return false;
//       }
//       if (record.workingDays === "6" && dayOfWeek === 0) {
//         return false;
//       }
//       if (holidayDates.has(formattedDate)) {
//         return false;
//       }

//       return true;
//     });

//     const getIndiaCurrentDateTime = () => {
//       const indiaTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
//       const date = new Date(indiaTime);

//       const pad = (n) => (n < 10 ? `0${n}` : n);

//       const year = date.getFullYear();
//       const month = pad(date.getMonth() + 1); // Months are 0-based
//       const day = pad(date.getDate());
//       const hours = pad(date.getHours());
//       const minutes = pad(date.getMinutes());
//       const seconds = pad(date.getSeconds());

//       return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
//     };

//     const dateTime = getIndiaCurrentDateTime()

//     // Create uninformed leave records
//     const leaveRecords = filteredData.map(attendance => {
//       const attendanceDate = attendance.AttendanceDate.toISOString().split("T")[0];

//       return {
//         employeeId: attendance.EmployeeCode,
//         leaveType: "uninformedLeave",
//         leaveStartDate: attendanceDate,
//         leaveEndDate: attendanceDate,
//         totalDays: attendance.Duration < 270 ? "1" : attendance.Duration >= 270 && attendance.Duration < 520 ? "0.5" : "0",
//         reason: "This is system-generated leave",
//         approvedBy: attendance.managerId || "System",
//         status: "Approved",
//         dateTime: dateTime,
//         approvedDateTime: dateTime
//       };
//     });

//     // Insert into MongoDB
//     if (leaveRecords.length > 0) {
//       await leaveTakenHistoryModel.insertMany(leaveRecords);
//     }

//     const updatedLeaves = await leaveTakenHistoryModel.find(
//       {},
//       { employeeId: 1, leaveType: 1, leaveStartDate: 1, leaveEndDate: 1 }
//     );

//     const leaveMap = new Map();
//     const uninformedLeaveMap = new Map();
//     const leavesToDelete = [];

//     // Step 1: Store other leave types in a Map
//     updatedLeaves.forEach(leave => {
//       const key = `${leave.employeeId}`;

//       if (leave.leaveType !== "uninformedLeave") {
//         if (!leaveMap.has(key)) leaveMap.set(key, []);
//         leaveMap.get(key).push({
//           startDate: new Date(leave.leaveStartDate),
//           endDate: new Date(leave.leaveEndDate),
//         });
//       } else {
//         // Collect uninformedLeave records separately
//         if (!uninformedLeaveMap.has(key)) uninformedLeaveMap.set(key, []);
//         uninformedLeaveMap.get(key).push({
//           _id: leave._id,
//           startDate: new Date(leave.leaveStartDate),
//           endDate: new Date(leave.leaveEndDate),
//         });
//       }
//     });

//     // Step 2: Identify uninformedLeave records to delete
//     uninformedLeaveMap.forEach((uninformedLeaves, employeeId) => {
//       const existingLeaves = leaveMap.get(employeeId) || [];

//       // Sort uninformedLeave records by date to handle duplicates
//       uninformedLeaves.sort((a, b) => a.startDate - b.startDate);

//       const keptUninformedLeaves = [];

//       uninformedLeaves.forEach(leave => {
//         const startDate = leave.startDate;
//         const endDate = leave.endDate;

//         // Check if this uninformedLeave overlaps with an existing leave
//         const hasOverlap = existingLeaves.some(el => startDate >= el.startDate && endDate <= el.endDate);

//         if (hasOverlap || keptUninformedLeaves.some(existing => existing.startDate.getTime() === startDate.getTime())) {
//           // If it overlaps with another leave or is a duplicate uninformedLeave, mark for deletion
//           leavesToDelete.push(leave._id);
//         } else {
//           // Otherwise, keep it as a valid uninformedLeave record
//           keptUninformedLeaves.push(leave);
//         }
//       });
//     });

//     // Step 3: Delete the identified uninformedLeave records
//     if (leavesToDelete.length > 0) {
//       await leaveTakenHistoryModel.deleteMany({ _id: { $in: leavesToDelete } });
//       console.log(`Deleted ${leavesToDelete.length} uninformedLeave records.`);
//     } else {
//       console.log("No uninformedLeave records to delete.");
//     }


//     return res.status(200).json({
//       statusCode: 200,
//       statusValue: "SUCCESS",
//       message: "Attendance records processed successfully.",
//       // data: leaveRecords,
//       // data2: updatedLeaves
//     });
//   } catch (err) {
//     console.error("Error fetching attendance logs:", err);
//     res.status(500).json({
//       statusCode: 500,
//       statusValue: "ERROR",
//       message: "An error occurred while processing attendance logs.",
//       error: err.message
//     });
//   }
// };



const getAttendanceLogsTodays = async (req, res) => {
  try {
    const currentDate = new Date();
    const formattedCurrentDate = currentDate.toISOString().split('T')[0]; // Format as yyyy-mm-dd

    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : new Date(formattedCurrentDate);
    // MongoDB query to fetch attendance records
    const dataResult = await AttendanceLogModel.find({ Status: "Present ", AttendanceDate: dateTo }, {
      C1: 0, C2: 0, C3: 0, C4: 0, C5: 0, C6: 0, C7: 0, CategoryId: 0, LeaveRemarks: 0, LeaveType: 0, LeaveTypeId: 0, Location: 0, LoginName: 0, LoginPassword: 0,
      OverTime: 0, OverTimeE: 0, P1Status: 0, P2Status: 0, P3Status: 0, ExtensionNo: 0
    })

    // Remove duplicates based on AttendanceDate and EmployeeCode
    const uniqueRecords = dataResult.reduce((acc, record) => {
      const uniqueKey = `${record.AttendanceDate.toISOString()}_${record.EmployeeCode}`;
      if (!acc.seen.has(uniqueKey)) {
        acc.seen.add(uniqueKey);
        acc.filtered.push(record);
      }
      return acc;
    }, { seen: new Set(), filtered: [] }).filtered;

    // get leave history
    const leaveData = await leaveTakenHistoryModel.find({ status: "Approved" }, { employeeId: 1, leaveType: 1, leaveStartDate: 1, leaveEndDate: 1 })
    // console.log(11, leaveData)
    const finalResult = uniqueRecords.map(attendance => {
      const attendanceObj = attendance.toObject();
      const matchingLeave = leaveData.find(leave => {
        const leaveStart = new Date(leave.leaveStartDate);
        const leaveEnd = new Date(leave.leaveEndDate);
        return (
          leave.employeeId === attendanceObj.EmployeeCode &&
          attendanceObj.AttendanceDate >= leaveStart &&
          attendanceObj.AttendanceDate <= leaveEnd
        );
      });

      if (matchingLeave) {
        return {
          ...attendanceObj,
          isLeaveTaken: true,
          leaveType: matchingLeave.leaveType
        };
      }
      return {
        ...attendanceObj,
        isLeaveTaken: false,
        leaveType: ""
      };
    });

    // count total employee Rec
    const employeeCount = await employeeModel.countDocuments({});
    if (uniqueRecords.length > 0) {
      return res.status(200).json({
        statusCode: 200,
        statusValue: "SUCCESS",
        message: "Attendance records fetched successfully.",
        totalPresent: finalResult.length,
        totalEmployees: employeeCount,
        empAttendanceLogs: finalResult
      });
    } else {
      return res.status(400).json({
        statusCode: 400,
        statusValue: "FAIL",
        message: "No records found for the given filters."
      });
    }
  } catch (err) {
    console.error("Error fetching attendance logs:", err.message);
    res.status(500).json({
      statusCode: 500,
      statusValue: "ERROR",
      message: "An error occurred while fetching attendance logs.",
      error: err.message
    });
  }
};


// const getAttendanceLogsByEmployeeId = async (req, res) => {
//   try {
//     const pool = await connectToDB();

//     // Extract query parameters
//     const employeeId = req.params.employeeId;
//     const dateTo = req.query.dateTo ? req.query.dateTo.toString() : null;
//     const dateFrom = req.query.dateFrom ? req.query.dateFrom.toString() : null;
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 20;
//     const offset = (page - 1) * limit;

//     // Validate employeeId
//     if (!employeeId) {
//       return res.status(400).json({
//         statusCode: 400,
//         statusValue: "FAIL",
//         message: "EmployeeId is required to fetch attendance logs.",
//       });
//     }

//     // Build base query
//     let query = `
//     SELECT 
//         Employees.EmployeeName, 
//         Employees.EmployeeCode, 
//         Employees.Gender, 
//         Employees.Designation, 
//         Employees.CategoryId,  
//         Employees.EmployementType,  
//         Employees.EmployeeDevicePassword, 
//         Employees.FatherName, 
//         Employees.MotherName, 
//         Employees.ResidentialAddress, 
//         Employees.PermanentAddress, 
//         Employees.ContactNo, 
//         Employees.Email, 
//         Employees.DOB, 
//         Employees.Location, 
//         Employees.WorkPlace, 
//         Employees.ExtensionNo, 
//         Employees.LoginName, 
//         Employees.LoginPassword, 
//         Employees.EmployeePhoto,
//         AttendanceLogs.*
//         FROM AttendanceLogs
//         LEFT JOIN Employees 
//           ON AttendanceLogs.EmployeeId = Employees.EmployeeId
//         WHERE 
//           (Employees.EmployeeId = '${employeeId}' OR Employees.EmployeeCode = '${employeeId}')
//       `;

//     // Add optional date filters
//     if (dateFrom && dateTo) {
//       query += ` AND AttendanceLogs.AttendanceDate BETWEEN '${dateFrom}' AND '${dateTo}' `;
//     }

//     // Add pagination
//     query += `
//       ORDER BY AttendanceLogs.AttendanceDate DESC
//       OFFSET ${offset} ROWS
//       FETCH NEXT ${limit} ROWS ONLY
//     `;

//     // Get total count for metadata
//     const countQuery = `
//       SELECT COUNT(*) AS totalCount
//       FROM AttendanceLogs
//       LEFT JOIN Employees ON AttendanceLogs.EmployeeId = Employees.EmployeeId
//       WHERE (Employees.EmployeeId = '${employeeId}' OR Employees.EmployeeCode = '${employeeId}')
//       ${dateFrom && dateTo ? `AND AttendanceLogs.AttendanceDate BETWEEN '${dateFrom}' AND '${dateTo}'` : ""}
//     `;

//     const [dataResult, countResult] = await Promise.all([
//       pool.request().query(query),
//       pool.request().query(countQuery),
//     ]);

//     const totalRecords = countResult.recordset[0].totalCount;
//     const totalPages = Math.ceil(totalRecords / limit);

//     if (dataResult.recordset.length > 0) {
//       return res.status(200).json({
//         statusCode: 200,
//         statusValue: "SUCCESS",
//         message: "Attendance records fetched successfully.",
//         data: dataResult.recordset,
//         totalRecords,
//         totalPages,
//         currentPage: page,
//         limit,
//       });
//     } else {
//       return res.status(404).json({
//         statusCode: 404,
//         statusValue: "FAIL",
//         message: "No records found for the given employee or filters.",
//       });
//     }
//   } catch (err) {
//     console.error("Error fetching attendance logs:", err.message);
//     res.status(500).json({
//       statusCode: 500,
//       statusValue: "ERROR",
//       message: "An error occurred while fetching attendance logs.",
//       error: err.message,
//     });
//   }
// };

// const getAttendanceLogsByEmployeeId = async (req, res) => {
//   try {
//     const pool = await connectToDB();

//     // Extract query parameters
//     const employeeId = req.params.employeeId;
//     const dateTo = req.query.dateTo
//       ? new Date(req.query.dateTo).toISOString().split("T")[0]
//       : new Date().toISOString().split("T")[0]; // Default to current date if dateTo is not provided
//     const dateFrom = req.query.dateFrom
//       ? new Date(req.query.dateFrom).toISOString().split("T")[0]
//       : null; // No default for dateFrom
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 20;
//     const offset = (page - 1) * limit;

//     // Validate employeeId
//     if (!employeeId) {
//       return res.status(400).json({
//         statusCode: 400,
//         statusValue: "FAIL",
//         message: "EmployeeId is required to fetch attendance logs.",
//       });
//     }

//     // Ensure dateTo does not exceed the current date
//     const currentDate = new Date().toISOString().split("T")[0];
//     if (dateTo > currentDate) {
//       return res.status(400).json({
//         statusCode: 400,
//         statusValue: "FAIL",
//         message: "dateTo cannot be greater than the current date.",
//       });
//     }

//     // Build base query
//     let query = `
//     SELECT 
//         Employees.EmployeeName, 
//         Employees.EmployeeCode, 
//         Employees.Gender, 
//         Employees.Designation, 
//         Employees.CategoryId,  
//         Employees.EmployementType,  
//         Employees.EmployeeDevicePassword, 
//         Employees.FatherName, 
//         Employees.MotherName, 
//         Employees.ResidentialAddress, 
//         Employees.PermanentAddress, 
//         Employees.ContactNo, 
//         Employees.Email, 
//         Employees.DOB, 
//         Employees.Location, 
//         Employees.WorkPlace, 
//         Employees.ExtensionNo, 
//         Employees.LoginName, 
//         Employees.LoginPassword, 
//         Employees.EmployeePhoto,
//         AttendanceLogs.*
//         FROM AttendanceLogs
//         LEFT JOIN Employees 
//           ON AttendanceLogs.EmployeeId = Employees.EmployeeId
//         WHERE 
//           (Employees.EmployeeId = '${employeeId}' OR Employees.EmployeeCode = '${employeeId}')
//           AND AttendanceLogs.AttendanceDate <= '${dateTo}'
//       `;

//     // Add optional dateFrom filter
//     if (dateFrom) {
//       query += ` AND AttendanceLogs.AttendanceDate >= '${dateFrom}' `;
//     }

//     // Add pagination
//     query += `
//       ORDER BY AttendanceLogs.AttendanceDate DESC
//       OFFSET ${offset} ROWS
//       FETCH NEXT ${limit} ROWS ONLY
//     `;

//     // Get total count for metadata
//     const countQuery = `
//       SELECT COUNT(*) AS totalCount
//       FROM AttendanceLogs
//       LEFT JOIN Employees ON AttendanceLogs.EmployeeId = Employees.EmployeeId
//       WHERE (Employees.EmployeeId = '${employeeId}' OR Employees.EmployeeCode = '${employeeId}')
//       AND AttendanceLogs.AttendanceDate <= '${dateTo}'
//       ${dateFrom ? `AND AttendanceLogs.AttendanceDate >= '${dateFrom}'` : ""}
//     `;

//     const [dataResult, countResult] = await Promise.all([
//       pool.request().query(query),
//       pool.request().query(countQuery),
//     ]);

//     const totalRecords = countResult.recordset[0].totalCount;
//     const totalPages = Math.ceil(totalRecords / limit);

//     if (dataResult.recordset.length > 0) {
//       return res.status(200).json({
//         statusCode: 200,
//         statusValue: "SUCCESS",
//         message: "Attendance records fetched successfully.",
//         data: dataResult.recordset,
//         totalRecords,
//         totalPages,
//         currentPage: page,
//         limit,
//       });
//     } else {
//       return res.status(404).json({
//         statusCode: 404,
//         statusValue: "FAIL",
//         message: "No records found for the given employee or filters.",
//       });
//     }
//   } catch (err) {
//     console.error("Error fetching attendance logs:", err.message);
//     res.status(500).json({
//       statusCode: 500,
//       statusValue: "ERROR",
//       message: "An error occurred while fetching attendance logs.",
//       error: err.message,
//     });
//   }
// };

const getAttendanceLogsByEmployeeId = async (req, res) => {
  try {
    // Extract query parameters
    let employeeId = req.params.employeeId.toString();
    // check user exists or not
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : new Date(); // Default to current date if dateTo is not provided
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null; // No default for dateFrom
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 31;
    const offset = (page - 1) * limit;
    
    // console.log(page, limit)
    
    // Validate employeeId
    if (!employeeId) {
      return res.status(400).json({
        statusCode: 400,
        statusValue: "FAIL",
        message: "EmployeeId is required to fetch attendance logs.",
      });
    }

    // Ensure dateTo does not exceed the current date
    const currentDate = new Date();
    if (dateTo > currentDate) {
      return res.status(400).json({
        statusCode: 400,
        statusValue: "FAIL",
        message: "dateTo cannot be greater than the current date.",
      });
    }

    // check user exists or not
    // const getEmp = await employeeModel.find({employeeId:req.query.employeeId})
    // console.log(11, getEmp)

    // Convert employeeId to number for EmployeeId field comparison
    const employeeIdNum = !isNaN(employeeId) ? parseInt(employeeId) : null;

    // Build the filter object for MongoDB query
    let filter = {
      $or: [
        ...(employeeIdNum !== null ? [{ EmployeeId: employeeIdNum }] : []),
        { EmployeeCode: employeeId }
      ],
      AttendanceDate: { $lte: dateTo }
    };

    // Apply optional dateFrom filter
    if (dateFrom) {
      filter.AttendanceDate.$gte = dateFrom;
    }

    // Calculate priority score: higher score = better record
    // This function prioritizes records with actual attendance data
    const getPriority = (rec) => {
      let priority = 0;
      // Prioritize Present status over Absent
      if (rec.Status && rec.Status.trim().toLowerCase() === "present") priority += 100;
      // Prioritize records with Duration > 0
      if (rec.Duration && rec.Duration > 0) priority += 50;
      // Prioritize records with PunchRecords
      if (rec.PunchRecords && rec.PunchRecords.trim() !== "") priority += 30;
      // Prioritize records with InTime/OutTime not default
      if (rec.InTime && !rec.InTime.includes("1900-01-01")) priority += 20;
      if (rec.OutTime && !rec.OutTime.includes("1900-01-01")) priority += 20;
      // Prioritize more recently updated records
      if (rec.updatedAt) priority += 10;
      return priority;
    };

    // MongoDB query to fetch attendance records with pagination and filters
    // Increase limit before deduplication to ensure we get all records
    const dataResult = await AttendanceLogModel.find(filter)
      .skip(offset)
      .limit(limit * 3) // Fetch more records to account for duplicates
      .sort({ AttendanceDate: -1, updatedAt: -1 }); // Sort by date and update time to prioritize recent/updated records
    
    // Remove duplicates based on AttendanceDate and EmployeeCode
    // Prioritize records with actual attendance data (Present status, Duration > 0, PunchRecords not empty)
    const uniqueRecords = dataResult.reduce((acc, record) => {
      const uniqueKey = `${record.AttendanceDate.toISOString()}_${record.EmployeeCode}`;
      const existingRecord = acc.map.get(uniqueKey);
      
      if (!existingRecord) {
        acc.map.set(uniqueKey, record);
        acc.filtered.push(record);
      } else {
        // If we have a duplicate, keep the one with higher priority
        const existingPriority = getPriority(existingRecord);
        const newPriority = getPriority(record);
        
        if (newPriority > existingPriority) {
          // Replace the existing record with the better one
          const index = acc.filtered.findIndex(r => 
            r.AttendanceDate.toISOString() === record.AttendanceDate.toISOString() &&
            r.EmployeeCode === record.EmployeeCode
          );
          if (index !== -1) {
            acc.filtered[index] = record;
            acc.map.set(uniqueKey, record);
          }
        }
      }
      return acc;
    }, { map: new Map(), filtered: [] }).filtered;
    
    // Sort again and limit to requested page size
    const sortedUniqueRecords = uniqueRecords
      .sort((a, b) => {
        // Sort by date descending, then by priority
        const dateDiff = new Date(b.AttendanceDate) - new Date(a.AttendanceDate);
        if (dateDiff !== 0) return dateDiff;
        return getPriority(b) - getPriority(a);
      })
      .slice(0, limit);

    // get leave history
    const leaveData = await leaveTakenHistoryModel.find({ employeeId: employeeId, status: "Approved" }, { employeeId: 1, leaveType: 1, leaveStartDate: 1, leaveEndDate: 1 })
    // console.log(11, leaveData)
    const finalResult = sortedUniqueRecords.map(attendance => {
      const attendanceObj = attendance.toObject();
      const matchingLeave = leaveData.find(leave => {
        const leaveStart = new Date(leave.leaveStartDate);
        const leaveEnd = new Date(leave.leaveEndDate);
        return (
          leave.employeeId === attendanceObj.EmployeeCode &&
          attendanceObj.AttendanceDate >= leaveStart &&
          attendanceObj.AttendanceDate <= leaveEnd
        );
      });

      if (matchingLeave) {
        return {
          ...attendanceObj,
          isLeaveTaken: true,
          leaveType: matchingLeave.leaveType
        };
      }
      return {
        ...attendanceObj,
        isLeaveTaken: false,
        leaveType: ""
      };
    });
    // console.log(11, finalResult)
    // Get the total count of unique records for pagination metadata
    // Use aggregation to count unique combinations of AttendanceDate and EmployeeCode efficiently
    const uniqueCountResult = await AttendanceLogModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$AttendanceDate" } },
            employeeCode: "$EmployeeCode"
          }
        }
      },
      { $count: "total" }
    ]);
    const totalRecords = uniqueCountResult.length > 0 ? uniqueCountResult[0].total : 0;
    const totalPages = Math.ceil(totalRecords / limit);

    if (sortedUniqueRecords.length > 0) {
      return res.status(200).json({
        statusCode: 200,
        statusValue: "SUCCESS",
        message: "Attendance records fetched successfully.",
        data: finalResult,
        totalRecords,
        totalPages,
        currentPage: page,
        limit,
      });
    } else {
      return res.status(404).json({
        statusCode: 404,
        statusValue: "FAIL",
        message: "No records found for the given employee or filters.",
      });
    }
  } catch (err) {
    console.error("Error fetching attendance logs:", err.message);
    res.status(500).json({
      statusCode: 500,
      statusValue: "ERROR",
      message: "An error occurred while fetching attendance logs.",
      error: err.message,
    });
  }
};


const getAttendanceDaysByMonth = async (req, res) => {
  try {
    let employeeId = req.params.employeeId;
    // Define the mapping
    const employeeIdMapping = {
      // "27166": "CON004",
      // "27516": "CON020",
      // "25646": "CON006",
      // "27176": "CON005"
    };

    // Check if employeeId exists in the mapping and override it
    if (employeeIdMapping[employeeId]) {
      employeeId = employeeIdMapping[employeeId];
    }

    const yearMonth = req.query.yearMonth;
    const startOfMonth = new Date(`${yearMonth}-01T00:00:00.000Z`);
    const endOfMonth = new Date(new Date(startOfMonth).setMonth(startOfMonth.getMonth() + 1));
        
    const aggResult = await AttendanceLogModel.aggregate([
      {
        $match: {
          EmployeeCode: employeeId,
          AttendanceDate: {
            $gte: startOfMonth,
            $lt: endOfMonth,
          },
        },
      },
      {
        $lookup: {
          from: "employees",
          localField: "EmployeeCode",
          foreignField: "employeeId",
          as: "employeeInfo"
        }
      },
      {
        $addFields: {
          shiftTime: { $arrayElemAt: ["$employeeInfo.shiftTime", 0] },
          workingDays: { $arrayElemAt: ["$employeeInfo.workingDays", 0] },
        }
      },
      {
        $project: {
          "EmployeeCode": 1,
          "Duration": 1,
          "AttendanceDate": 1,
          "Status": 1,
          "shiftTime": 1,
          "InTime": 1,
          "OutTime": 1,
          "PunchRecords": 1,
          "workingDays":1,
          // "EmployeeId":1
        },
      },
    ]);
    
    const convertDuration = (durationInMinutes) => {
      const hours = Math.floor(durationInMinutes / 60);
      const minutes = durationInMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    };

    const getAttendanceStatus = (durationInMinutes, inTimeStr) => {
      const hours = Math.floor(durationInMinutes / 60);
      const minutes = durationInMinutes % 60;
      const totalMinutes = hours * 60 + minutes;

      const timeThreshold = "09:16:00";
      let isLate = false;

      if (inTimeStr && inTimeStr.includes(" ")) {
        const timePart = inTimeStr.split(" ")[1]; // e.g., "09:45:00"
        if (timePart > timeThreshold) {
          isLate = true;
        }
      }

      if (isLate) {
        return "Half Day"; // Late overrides Full Day
      } else if (totalMinutes >= 500) {
        return "Full Day";
      } else if (totalMinutes >= 240) {
        return "Half Day";
      } else {
        return "Absent";
      }
    };
    
    const updatedData = aggResult.map(entry => {
      const durationInHHMM = convertDuration(entry.Duration);
      const attendanceStatus = getAttendanceStatus(entry.Duration, entry.InTime);

      return {
        ...entry,
        Duration: durationInHHMM,
        AttendanceStatus: attendanceStatus
      };
    });

    const uniqueData = Object.values(
      updatedData.reduce((acc, entry) => {
        if (!acc[entry.AttendanceDate]) {
          acc[entry.AttendanceDate] = entry;
        }
        return acc;
      }, {})
    );
    // get data from leav history
    const leaveData = await leaveTakenHistoryModel.find({ status: "Approved" }, { employeeId: 1, leaveType: 1, leaveStartDate: 1, leaveEndDate: 1 });

    const finalResult = uniqueData.map(attendance => {
      const matchingLeave = leaveData.find(leave => {
        const leaveStart = new Date(leave.leaveStartDate);
        const leaveEnd = new Date(leave.leaveEndDate);
        return (
          leave.employeeId === attendance.EmployeeCode &&
          attendance.AttendanceDate >= leaveStart &&
          attendance.AttendanceDate <= leaveEnd
        );
      });

      if (matchingLeave) {
        return {
          ...attendance,
          isLeaveTaken: true,
          leaveType: matchingLeave.leaveType
        };
      }
      return {
        ...attendance,
        isLeaveTaken: false,
        leaveType: ""
      };
    });

    const holidaysData = await holidaysModel.find({}, { holidayName: 1, holidayDate: 1 });

    // Convert holiday dates to Date objects for comparison
    const holidaysMap = holidaysData.reduce((map, holiday) => {
      map[new Date(holiday.holidayDate).toISOString().split('T')[0]] = holiday.holidayName;
      return map;
    }, {});

    // Add isHoliday and holidayName to finalResult
    finalResult.forEach(record => {
      const attendanceDateKey = record.AttendanceDate.toISOString().split('T')[0];
      if (holidaysMap[attendanceDateKey]) {
        record.AttendanceStatus = holidaysMap[attendanceDateKey];
        // record.holidayName = holidaysMap[attendanceDateKey];
      } else {
        record.AttendanceStatus = record.AttendanceStatus
      }
    });

    let formattedResult = finalResult.map(item => {
      const date = new Date(item.AttendanceDate);
      const options = { day: 'numeric', month: 'long', year: 'numeric' };
      const formattedDate = new Intl.DateTimeFormat('en-GB', options).format(date);
      return { ...item, AttendanceDate: formattedDate };
    });

    const empData = await employeeModel.findOne({ employeeId: req.params.employeeId }, { shiftTime: 1 });
    if (empData && empData.shiftTime) {
      formattedResult = formattedResult.map(entry => ({
        ...entry,
        shiftTime: entry.shiftTime || empData.shiftTime
      }))
    }
    
    const totalWorkingDays = formattedResult.reduce((sum, entry) => {
      const status = entry.AttendanceStatus?.trim();
      const leaveType = entry.leaveType?.trim().toLowerCase();

      if (status === "Full Day") {
        return sum + 1;
      } else if (status === "Half Day") {
        if (leaveType === "regularized" || leaveType === "shortleave" || leaveType === "vendor-meeting") {
          return sum + 1; // Upgrade Half Day to Full Day
        }
        return sum + 0.5; // Normal Half Day
      }

      return sum; 
    }, 0);
    
    if (aggResult.length > 0) {
      return res.status(200).json({
        statusCode: 200,
        statusValue: "SUCCESS",
        message: "Attendance records fetched successfully.",
        data: formattedResult.reverse(),
        data2: { totalWorkingDays: totalWorkingDays.toString() }
      });
    } else {
      return res.status(404).json({
        statusCode: 404,
        statusValue: "FAIL",
        message: "No records found for the given employee or filters.",
      });
    }

  } catch (err) {
    console.error("Error fetching attendance logs:", err.message);
    res.status(500).json({
      statusCode: 500,
      statusValue: "ERROR",
      message: "An error occurred while fetching attendance logs.",
      error: err.message,
    });
  }
}


const removeDuplicateAttendance = async (req, res) => {
  try {
    if (!req.query) {
      const currentDate = new Date();
      const yearMonth = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;

      const startOfMonth = new Date(`${yearMonth}-01T00:00:00.000Z`);
      const endOfMonth = new Date(new Date(startOfMonth).setMonth(startOfMonth.getMonth() + 1));

      // const yearMonth = req.query.yearMonth; // e.g., '2025-01'
      // const startOfMonth = new Date(`${yearMonth}-01T00:00:00.000Z`);
      // const endOfMonth = new Date(new Date(startOfMonth).setMonth(startOfMonth.getMonth() + 1));

      const aggResult = await AttendanceLogModel.aggregate([
        {
          $match: {
            AttendanceDate: {
              $gte: startOfMonth,
              $lt: endOfMonth,
            },
          },
        },
        {
          $group: {
            _id: { EmployeeCode: "$EmployeeCode", AttendanceDate: "$AttendanceDate" },
            count: { $sum: 1 },
            ids: { $push: "$_id" },
          },
        },
        {
          $match: { count: { $gt: 1 } },
        },
      ]);
      // console.log(11, aggResult)


      for (const record of aggResult) {

        const [firstId, ...duplicateIds] = record.ids;

        await AttendanceLogModel.deleteMany({
          _id: { $in: duplicateIds },
        });
      }
      console.log("Duplicate attendance records removed successfully")
    } else if (req.query.yearMonth) {
      const yearMonth = req.query.yearMonth; // e.g., '2025-01'
      const startOfMonth = new Date(`${yearMonth}-01T00:00:00.000Z`);
      const endOfMonth = new Date(new Date(startOfMonth).setMonth(startOfMonth.getMonth() + 1));

      const aggResult = await AttendanceLogModel.aggregate([
        {
          $match: {
            AttendanceDate: {
              $gte: startOfMonth,
              $lt: endOfMonth,
            },
          },
        },
        {
          $group: {
            _id: { EmployeeId: "$EmployeeId", AttendanceDate: "$AttendanceDate" },
            count: { $sum: 1 },
            ids: { $push: "$_id" },
          },
        },
        {
          $match: { count: { $gt: 1 } },
        },
      ]);
      // console.log(11, aggResult)


      for (const record of aggResult) {

        const [firstId, ...duplicateIds] = record.ids;

        await AttendanceLogModel.deleteMany({
          _id: { $in: duplicateIds },
        });
      }
      res.status(200).json({
        message: "Duplicate attendance records removed successfully"
      })
    }
  } catch (err) {
    console.log("Error while removing duplicate records:", err);
    res.status(500).send({
      message: "Failed to remove duplicate records",
    });
  }
};

const startRemoveAttendanceDuplicateRecords = () => {
  cron.schedule("0 0 1 * *", async () => {
    console.log("Running cron job: calculating duplicate attendance records attendance logs...");
    await removeDuplicateAttendance();
  });
};


// const updateEmployeeDetailsByEmployeeId = async (req, res) => {
//   try {
//     const { employeeId, newPassword } = req.body;

//     if(!employeeId || !newPassword) {
//       return res.status(400).json({
//         statusCode: 400,
//         statusValue: "FAIL",
//         message: "EmployeeId and newPassword are required.",
//       });
//     }

//     const pool = await connectToDB();

//     // Update query
//     const query = `
//     UPDATE Employees
//     SET LoginPassword = @newPassword
//     WHERE EmployeeId = @employeeId;
//     `;
//     // Execute query

//     const result = await pool.request()
//     .input('newPassword', newPassword)
//     .input('employeeId', employeeId)
//     .query(query)

//     if(result.rowsAffected[0] > 0) {
//       return res.status(200).json({
//         statusCode: 200,
//         statusValue: "SUCCESS",
//         message: "LoginPassword updated successfully.",
//       });
//     } else {
//       return res.status(404).json({
//         statusCode: 404,
//         statusValue: "FAIL",
//         message: "EmployeeId not found.",
//       });
//     }
//   } catch (err) {
//     console.error("Error updating LoginPassword:", err.message);
//     return res.status(500).json({
//       statusCode: 500,
//       statusValue: "ERROR",
//       message: "An error occurred while updating the LoginPassword.",
//       error: err.message,
//     });
//   }
// }

// const getHolidayList = async (req, res) => {
//   try {
//     const pool = await connectToDB();
//     const result = await pool.request().query(`SELECT * FROM Holidays ORDER BY HolidayId ASC`);
//     res.status(200).json(result.recordset);
//   } catch (err) {
//     console.error("Error fetching tables:", err.message);
//     res.status(500).send(err.message);
//   }
// };



const removeDuplicateLogs = async (req, res) => {
  try {
    const dataResult = await AttendanceLogModel.find({})

  } catch (err) {

  }
};


const createAttendanceLogForOutDuty = async (req, res) => {
  try {
    const { employeeId, location, imageUrl, createdAt, updatedAt, InTime, AttendanceDate } = req.body;

    if (!employeeId || !location) {
      return res.status(400).json({
        message: "employeeId and location are required",
        statusCode: 400,
        statusValue: "error"
      });
    }

    // Use provided timestamps or current time as fallback
    const now = moment().tz("Asia/Kolkata");
    
    // Convert date strings to Date objects for MongoDB storage
    let providedCreatedAt, providedUpdatedAt, providedAttendanceDate;
    
    if (createdAt) {
      // If createdAt is provided as string, convert to Date
      providedCreatedAt = new Date(createdAt);
    } else {
      providedCreatedAt = new Date();
    }
    
    if (updatedAt) {
      // If updatedAt is provided as string, convert to Date
      providedUpdatedAt = new Date(updatedAt);
    } else {
      providedUpdatedAt = new Date();
    }
    
    if (AttendanceDate) {
      // If AttendanceDate is provided as string, convert to Date
      providedAttendanceDate = new Date(AttendanceDate);
    } else {
      providedAttendanceDate = new Date();
    }
    
    const providedInTime = InTime || now.format("YYYY-MM-DD HH:mm:ss");
    
    // Extract date from Date object for comparison
    const todayDate = moment(providedAttendanceDate).format("YYYY-MM-DD");
    const formattedTime = moment(providedInTime).format("HH:mm");
    const formattedCheckIn = providedInTime;

    // Only standard format for punch (no location here)
    const punchEntry = `${formattedTime}:in(IN),`;

    // Find existing log for today
    const existingLog = await attendanceLogModelForOutDuty.findOne({
      employeeId,
      InTime: { $regex: `^${todayDate}` }
    });
    
    if (existingLog) {
      const punchRecords = existingLog.PunchRecords || "";
      const punchArray = punchRecords.split(',').filter(Boolean);
      const lastPunch = punchArray[punchArray.length - 1];

      if (lastPunch && lastPunch.includes('in(IN)')) {
        return res.status(400).json({
          message: "First punch out before punch in again",
          statusCode: 400,
          statusValue: "error",
          punchRecords
        });
      }
      
      // Append punch
      existingLog.PunchRecords += punchEntry;

      //  Append location with ||
      const existingLocation = existingLog.location || "";
      existingLog.location = existingLocation.length
        ? `${existingLocation}||${location}`
        : location;

      existingLog.updatedAt = providedUpdatedAt;
      await existingLog.save();
      
      return res.status(200).json({
        message: "Punch In appended successfully",
        statusCode: 200,
        statusValue: "success",
        data: existingLog
      });
    }

    // No log exists — create new one
    const newLog = new attendanceLogModelForOutDuty({
      employeeId,
      AttendanceDate: providedAttendanceDate,
      location,
      InTime: formattedCheckIn,
      OutTime: "",
      PunchRecords: punchEntry,
      imageUrl: imageUrl || "NA",
      createdAt: providedCreatedAt,
      updatedAt: providedUpdatedAt
    });

    await newLog.save();

    return res.status(201).json({
      message: "Attendance log created successfully",
      statusCode: 201,
      statusValue: "success",
      data: newLog
    });

  } catch (error) {
    console.error("Error handling attendance punch:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      statusCode: 500,
      statusValue: "error"
    });
  }
};


const punchOutForOutDuty = async (req, res) => {
  try {
    const { id } = req.params;
    const { location, OutTime, updatedAt } = req.body;

    if (!id || !location) {
      return res.status(400).json({
        message: "Id and location are required",
        statusCode: 400,
        statusValue: "error"
      });
    }

    const now = moment().tz("Asia/Kolkata");
    const providedOutTime = OutTime || now.format("YYYY-MM-DD HH:mm:ss");
    
    // Convert string date to proper Date object
    let providedUpdatedAt;
    if (updatedAt) {
      providedUpdatedAt = new Date(updatedAt);
    } else {
      providedUpdatedAt = new Date();
    }
    
    const formattedOutTime = providedOutTime;
    const punchOutEntry = `${moment(providedOutTime).format("HH:mm")}:out(OUT),`;

    //  Find existing log by ID
    const existingLog = await attendanceLogModelForOutDuty.findById(id);

    if (!existingLog) {
      return res.status(404).json({
        message: "Attendance log not found",
        statusCode: 404,
        statusValue: "FAIL"
      });
    }

    const punchRecords = existingLog.PunchRecords || "";
    const punchArray = punchRecords.split(',').filter(Boolean);
    const lastPunch = punchArray[punchArray.length - 1];

    //  Only allow OUT if last punch is IN
    if (!lastPunch || !lastPunch.includes('in(IN)')) {
      return res.status(400).json({
        message: "First punch in before punching out",
        statusCode: 400,
        statusValue: "error",
        punchRecords
      });
    }

    //  Append OUT punch
    const updatedPunchRecords = punchRecords + punchOutEntry;

    //  Append to location using ||
    const existingLocation = existingLog.location || "";
    const updatedLocation = existingLocation.length
      ? `${existingLocation}||${location}`
      : location;

    //  Update log
    const updatedLog = await attendanceLogModelForOutDuty.findByIdAndUpdate(
      id,
      {
        $set: {
          OutTime: formattedOutTime,
          PunchRecords: updatedPunchRecords,
          location: updatedLocation,
          updatedAt: providedUpdatedAt
        }
      },
      { new: true }
    );

    return res.status(200).json({
      message: "Punch-out recorded successfully",
      statusCode: 200,
      statusValue: "success",
      data: updatedLog
    });

  } catch (error) {
    console.error("Error processing punch-out:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      statusCode: 500,
      statusValue: "error"
    });
  }
};



const updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    const { location, updatedAt } = req.body;

    // Validate required fields
    if (!id || !location) {
      return res.status(400).json({
        message: "Id and location are required",
        statusCode: 400,
        statusValue: "error"
      });
    }

    // Fetch existing log
    const existingLog = await attendanceLogModelForOutDuty.findById(id);
    if (!existingLog) {
      return res.status(404).json({
        statusCode: 404,
        statusValue: "FAIL",
        message: "Attendance log not found or invalid ID"
      });
    }

    // Extract and split existing locations
    const existingLocations = existingLog.location
      ? existingLog.location.split("||")
      : [];

    // Check for duplication
    if (existingLocations.includes(location)) {
      return res.status(200).json({
        message: "Location already exists. No update made.",
        statusCode: 200,
        statusValue: "info",
        data: existingLog
      });
    }

    // Append new location
    const updatedLocation = existingLocations.length
      ? `${existingLog.location}||${location}`
      : location;

    // Update the location field
    const now = moment().tz("Asia/Kolkata");
    
    // Convert string date to proper Date object
    let providedUpdatedAt;
    if (updatedAt) {
      providedUpdatedAt = new Date(updatedAt);
    } else {
      providedUpdatedAt = new Date();
    }
    
    const updatedLog = await attendanceLogModelForOutDuty.findByIdAndUpdate(
      id,
      { $set: { location: updatedLocation, updatedAt: providedUpdatedAt } },
      { new: true }
    );

    return res.status(200).json({
      message: "Location updated successfully",
      statusCode: 200,
      statusValue: "success",
      data: updatedLog
    });
  } catch (error) {
    console.error("Error updating location:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      statusCode: 500,
      statusValue: "error"
    });
  }
};


const getAttendanceLogForOutDutyById = async (req, res) => {
  try { 
    const { employeeId } = req.params;

    // Validate required fields
    if (!employeeId) {
      return res.status(400).json({
        message: "employeeId is required",
        statusCode: 400,
        statusValue: "error"
      });
    }
    
    // Get current date & time in India Standard Time (IST)
    const now = moment().tz("Asia/Kolkata");

    // Store AttendanceDate as YYYY-MM-DD string (IST date)
    const todayDate = now.format("YYYY-MM-DD");

    // Check if the employee has already logged attendance for today
    const dataRecords = await attendanceLogModelForOutDuty.findOne({
      employeeId,
      AttendanceDate: todayDate
    });

    return res.status(201).json({
      message: "Attendance log created successfully",
      statusCode: 201,
      statusValue: "success",
      data: dataRecords
    });
  } catch (error) {
    console.error("Error creating attendance log:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      statusCode: 500,
      statusValue: "error"
    });
  }
};


const getAllPunchRecordsForOutDuty = async (req, res) => {
  try {
    const { employeeId } = req.params;
    // Validate required fields
    if (!employeeId) {
      return res.status(400).json({
        message: "employeeId is required",
        statusCode: 400,
        statusValue: "error"
      });
    }

    const dataRecords = await attendanceLogModelForOutDuty.find({employeeId}).sort({createdAt:-1});
    if (dataRecords.length < 1) {
      return res.status(400).json({
        message: "Attendance log not found.",
        statusCode: 400,
        statusValue: "FAIL"
      });
    }
    return res.status(201).json({
      message: "Attendance log fetched successfully",
      statusCode: 200,
      statusValue: "SUCCESS",
      data: dataRecords
    });
  } catch (error) {
    console.error("Error creating attendance log:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      statusCode: 500,
      statusValue: "error"
    });
  }
};

const getAllOutDutyRecords = async (req, res) => {
  try {
    // Extract query parameters for filtering and pagination
    const { 
      employeeId, 
      page = 1, 
      limit = 10, 
      dateFrom, 
      dateTo, 
      status,
      source,
      all = false
    } = req.query;

    // Build query object
    let query = {};
    
    if (employeeId) {
      query.employeeId = employeeId;
    }
    
    if (dateFrom && dateTo) {
      query.AttendanceDate = {
        $gte: dateFrom,
        $lte: dateTo
      };
    }
    
    if (status) {
      query.Status = status;
    }
    
    if (source) {
      query.source = source;
    }

    // Get total count for pagination
    const totalRecords = await attendanceLogModelForOutDuty.countDocuments(query);

    let dataRecords;
    let paginationInfo;

    if (all === 'true' || all === true) {
      // Return all records without pagination
      dataRecords = await attendanceLogModelForOutDuty
        .find(query)
        .sort({ createdAt: -1 })
        .maxTimeMS(20000); // 20 second timeout for larger datasets
      
      paginationInfo = {
        message: "All records returned (no pagination)"
      };
    } else {
      // Calculate pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Fetch records with pagination and sorting
      dataRecords = await attendanceLogModelForOutDuty
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .maxTimeMS(10000); // 10 second timeout

      // Calculate pagination info
      const totalPages = Math.ceil(totalRecords / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      paginationInfo = {
        currentPage: pageNum,
        totalPages: totalPages,
        totalRecords: totalRecords,
        limit: limitNum,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage
      };
    }

    return res.status(200).json({
      message: "Out duty records fetched successfully",
      statusCode: 200,
      statusValue: "SUCCESS",
      data: dataRecords,
      pagination: paginationInfo
    });
  } catch (error) {
    console.error("Error fetching out duty records:", error);
    
    // Handle specific timeout errors
    if (error.name === 'MongoServerSelectionError' || error.message.includes('ETIMEDOUT')) {
      return res.status(503).json({
        success: false,
        message: "Database connection timeout. Please try again later.",
        statusCode: 503,
        statusValue: "error",
        error: "Database timeout"
      });
    }
    
    return res.status(500).json({
      message: "Internal Server Error",
      statusCode: 500,
      statusValue: "error",
      error: error.message
    });
  }
};


const createEmployeeSalary = async (req, res) => {
  try {
    const {
      pay_slip_month,
      company_address,
      employee_basic_details: {
        employee_name,
        employee_code,
        designation,
        date_of_joining,
        employee_pan,
        employee_aadhar,
        bank_name,
        bank_ifsc,
        bank_account,
        employee_uan,
        employee_esic,
        payment_mode
      } = {},
      leave_summary: {
        month_days,
        unpaid_days,
        payable_days,
        EL,
        CL,
        ML,
        D_EL,
        D_CL,
        D_ML,
        regularisation,
        shortLeave,
        halfDay,
        absent,
        workedDays,
        SD,
      } = {},
      salary_details: {
        basic_salary,
        hra,
        travel_allowances,
        special_allowances,
        arrears,
        bonus_or_others,
        total_gross_salary,
        employee_pf,
        employee_esi,
        tds,
        loan_advance,
        penalty,
        transport_or_others,
        total_deduction,
        net_pay,
        fixed_gross_salary,
      } = {},
    } = req.body;
    console.log(req.body)
    
    // Check for duplicate entry
    const existingSalary = await employeeSalaryModel.findOne({
      pay_slip_month,
      "employee_basic_details.employee_code": employee_code,
    });
    
    if (existingSalary) {
      return res.status(400).json({
        message: "Salary record already exists for this employee and month",
        statusCode: 400,
        statusValue: "FAIL",
      });
    }
    
    // Create new employee salary record
    const newSalary = await employeeSalaryModel.create(req.body);
   
    return res.status(201).json({
      message: "Employee salary record created successfully",
      statusCode: 201,
      statusValue: "SUCCESS",
      data: newSalary,
    });
  } catch (error) {
    console.error("Error creating employee salary record:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      statusCode: 500,
      statusValue: "ERROR",
    });
  }
};


const getAllEmployeeSalaries = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(400).json({
        statusCode: 400,
        statusValue: "FAIL",
        message: "Token is required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(400).json({
        statusCode: 400,
        statusValue: "FAIL",
        message: "Invalid token",
      });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limitNumber = parseInt(req.query.limit) || 200;
    const skip = (page - 1) * limitNumber;
    const search = req.query.search || "";
    
    let searchCondition = {};
    
    if (search) {
      searchCondition = {
        $or: [
          { pay_slip_month: { $regex: new RegExp(search, "i") } },
          { "employee_basic_details.employee_name": { $regex: new RegExp(search, "i") } },
          { "employee_basic_details.employee_code": { $regex: new RegExp(search, "i") } },
        ],
      };
    }
     
    // === Employee role ===
    if (decoded.role === "Employee" || decoded.role === "Manager") {
      const salaryRecords = await employeeSalaryModel.find({
        "employee_basic_details.employee_code": decoded.employeeId,
        ...searchCondition,
      }).sort({ createdAt: -1 });

      return res.status(200).json({
        message: "Employee salary records fetched successfully",
        statusCode: 200,
        statusValue: "success",
        data: salaryRecords,
      });

    } else if (decoded.role === "HR-Admin" || decoded.role === "Admin" || decoded.role === "Super-Admin") {
      const aggregatePipeline = [
        { $match: searchCondition },
        { $sort: { createdAt: -1 } },
        {
          $facet: {
            metadata: [{ $count: "totalRecords" }],
            data: [{ $skip: skip }, { $limit: limitNumber }],
          },
        },
      ];

      const result = await employeeSalaryModel.aggregate(aggregatePipeline);

      const totalRecords = result[0]?.metadata[0]?.totalRecords || 0;
      const records = result[0]?.data || [];

      return res.status(200).json({
        message: "All employee salary records fetched successfully",
        statusCode: 200,
        statusValue: "success",
        data: records,
        pagination: {
          totalRecords,
          currentPage: page,
          totalPages: Math.ceil(totalRecords / limitNumber),
        },
      });
    }

    // === Unauthorized role ===
    return res.status(403).json({
      statusCode: 403,
      statusValue: "FAIL",
      message: "You are not authorized to access this resource",
    });

  } catch (error) {
    console.error("Error fetching salary records:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      statusCode: 500,
      statusValue: "error",
    });
  }
};


// const moment = require("moment-timezone"); // Ensure this is installed
// npm install moment-timezone if needed

const saveEmpLocation = async (req, res) => {
  try {
    const {employeeId, trackPath, markers } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        message: "employeeId is required in query",
        statusCode: 400,
        statusValue: "error"
      });
    }

    if (!Array.isArray(trackPath) || trackPath.length === 0) {
      return res.status(400).json({
        message: "trackPath must be a non-empty array",
        statusCode: 400,
        statusValue: "error"
      });
    }

    if (!Array.isArray(markers)) {
      return res.status(400).json({
        message: "markers must be an array",
        statusCode: 400,
        statusValue: "error"
      });
    }

    // Validate trackPath
    const validatedTrackPath = trackPath.map((point, i) => {
      const { lat, lng, timestamp } = point;
      if (lat === undefined || lng === undefined || !timestamp) {
        throw new Error(`Missing required trackPath fields at index ${i}`);
      }
      return { lat, lng, timestamp };
    });

    // Validate markers
    const validatedMarkers = markers.map((m, i) => {
      const {
        type, lat, lng, time = '', locality = '', subLocality = '',
        duration = '', timestamp = '', distance = ''
      } = m;

      if (!type || lat === undefined || lng === undefined) {
        throw new Error(`Missing required marker fields at index ${i}`);
      }

      return {
        type, lat, lng, time, locality, subLocality,
        duration, timestamp, distance
      };
    });

    // Derive attendanceDate from first trackPath timestamp
    const attendanceDate = moment
      .tz(validatedTrackPath[0].timestamp, "Asia/Kolkata")
      .format("YYYY-MM-DD");

    // Upsert employee location
    const updated = await employeeLocationModel.findOneAndUpdate(
      { employeeId, attendanceDate },
      {
        $push: {
          trackPath: { $each: validatedTrackPath },
          markers: { $each: validatedMarkers }
        }
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({
      message: "Location data saved successfully",
      statusCode: 201,
      statusValue: "success",
      data: updated
    });
    
  } catch (error) {
    console.error("Error saving employee location:", error.message);
    return res.status(500).json({
      message: error.message || "Internal Server Error",
      statusCode: 500,
      statusValue: "error"
    });
  }
};










const recalculateDuration = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        message: "Attendance log ID is required",
        statusCode: 400,
        statusValue: "error"
      });
    }

    // Find the attendance log
    const attendanceLog = await attendanceLogModelForOutDuty.findById(id);
    if (!attendanceLog) {
      return res.status(404).json({
        message: "Attendance log not found",
        statusCode: 404,
        statusValue: "error"
      });
    }

    // Determine work_outside flag for this employee (default false)
    let isWorkOutside = false;
    try {
      const empDoc = await employeeModel.findOne({ employeeId: String(attendanceLog.employeeId) }, { work_outside: 1 });
      isWorkOutside = !!(empDoc && empDoc.work_outside);
    } catch (e) {
      isWorkOutside = false;
    }

    // Parse punch records
    const records = (attendanceLog.PunchRecords || "").split(",").filter(Boolean);
    const punches = records.map((entry) => {
      const type = entry.includes("in") ? "in" : "out";
      return { time: entry.slice(0, 5), type };
    });

    // Calculate duration with work_outside rule
    let totalDuration = 0;
    if (isWorkOutside) {
      let firstIn = null;
      let lastOut = null;
      for (const punch of punches) {
        if (punch.type === "in") {
          const t = moment(punch.time, "HH:mm");
          if (!firstIn || t.isBefore(firstIn)) firstIn = t;
        } else if (punch.type === "out") {
          const t = moment(punch.time, "HH:mm");
          if (!lastOut || t.isAfter(lastOut)) lastOut = t;
        }
      }
      if (firstIn && lastOut) {
        if (lastOut.isBefore(firstIn)) lastOut.add(1, "day");
        const span = lastOut.diff(firstIn, "minutes");
        totalDuration = span > 0 ? span : 0;
      }
    } else {
      let lastInTime = null;
      for (const punch of punches) {
        if (punch.type === "in") {
          lastInTime = punch.time;
        } else if (punch.type === "out" && lastInTime) {
          const inTime = moment(lastInTime, "HH:mm");
          const outTime = moment(punch.time, "HH:mm");
          if (outTime.isBefore(inTime)) outTime.add(1, "day");
          const duration = outTime.diff(inTime, "minutes");
          if (duration > 0) totalDuration += duration;
          lastInTime = null;
        }
      }
    }

    // Update the duration
    attendanceLog.Duration = totalDuration;
    await attendanceLog.save();

    return res.status(200).json({
      message: "Duration recalculated successfully",
      statusCode: 200,
      statusValue: "success",
      data: {
        _id: attendanceLog._id,
        employeeId: attendanceLog.employeeId,
        Duration: totalDuration,
        PunchRecords: attendanceLog.PunchRecords
      }
    });

  } catch (error) {
    console.error("Error recalculating duration:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      statusCode: 500,
      statusValue: "error"
    });
  }
};

/**
 * Trigger merge of all existing data (POST endpoint)
 */
const triggerMergeAllExistingData = async (req, res) => {
  try {
    console.log("🚀 API: Starting comprehensive merge of all existing data");
    
    // Import required models
    const AttendanceLogModel = require('../models/attendanceLogModel');
    const AttendanceLogForOutDutyModel = require('../models/attendanceLogModelForOutDuty');
    const EmployeeModel = require('../models/employeeModel');
    
    // Get actual data records
    const outDutyRecords = await AttendanceLogForOutDutyModel.find({}).limit(10).lean();
    const mergedRecords = await AttendanceLogModel.find({
      $or: [
        { DurationSource: "Office + Out Duty" },
        { DurationSource: "Out Duty Only" }
      ]
    }).limit(10).lean();
    const employees = await EmployeeModel.find({}).limit(10).lean();
    
    // Get counts
    const totalOutDutyRecords = await AttendanceLogForOutDutyModel.countDocuments();
    const totalAttendanceLogs = await AttendanceLogModel.countDocuments();
    const totalEmployees = await EmployeeModel.countDocuments();
    const existingMergedRecords = await AttendanceLogModel.countDocuments({
      $or: [
        { DurationSource: "Office + Out Duty" },
        { DurationSource: "Out Duty Only" }
      ]
    });
    
    // Calculate what needs to be processed
    const recordsToProcess = totalOutDutyRecords - existingMergedRecords;
    const coveragePercentage = totalOutDutyRecords > 0 ? 
      ((existingMergedRecords / totalOutDutyRecords) * 100).toFixed(1) : 0;
    
    // Return response with actual data
    res.status(200).json({
      statusCode: 200,
      statusValue: "SUCCESS",
      message: "Merge status retrieved successfully",
      timestamp: new Date().toISOString(),
      data: {
        summary: {
          totalOutDutyRecords,
          totalAttendanceLogs,
          totalEmployees,
          existingMergedRecords,
          recordsToProcess,
          coveragePercentage: coveragePercentage + "%"
        },
        actualData: {
          outDutyRecords: outDutyRecords,
          mergedRecords: mergedRecords,
          employees: employees
        },
        logs: [
          "📊 MERGE STATUS SUMMARY",
          `📈 Total Out-Duty Records: ${totalOutDutyRecords}`,
          `✅ Already Merged Records: ${existingMergedRecords}`,
          `⏳ Records to Process: ${recordsToProcess}`,
          `🎯 Current Coverage: ${coveragePercentage}%`,
          recordsToProcess > 0 ? "⚠️ Some records still need merging" : "🎉 All records are already merged!"
        ],
        recommendation: recordsToProcess > 0 ? 
          "Run the full merge process to process remaining records" : 
          "All out-duty records are already merged with attendance logs"
      }
    });
    
    // Start background merge process
    if (recordsToProcess > 0) {
      console.log("🔄 Starting background merge for remaining records");
      const { mergeAllExistingData } = require('../mergeAllExistingData');
      mergeAllExistingData().catch(error => {
        console.error("❌ Background merge process failed:", error);
      });
    }
    
  } catch (error) {
    console.error("❌ Error in merge process:", error);
    return res.status(500).json({
      statusCode: 500,
      statusValue: "ERROR",
      message: "Failed to get merge status",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Get merge results and statistics (GET endpoint)
 */
const getMergeResults = async (req, res) => {
  try {
    console.log("📊 API: Fetching merge results and statistics");
    
    // Import the statistics function
    const { showFinalStatistics } = require('../mergeAllExistingData');
    
    // Get basic counts first
    const AttendanceLogModel = require('../models/attendanceLogModel');
    const AttendanceLogForOutDutyModel = require('../models/attendanceLogModelForOutDuty');
    const EmployeeModel = require('../models/employeeModel');
    
    // Get actual data records (limit to 20 for performance)
    const outDutyRecords = await AttendanceLogForOutDutyModel.find({}).limit(20).lean();
    const mergedRecords = await AttendanceLogModel.find({
      $or: [
        { DurationSource: "Office + Out Duty" },
        { DurationSource: "Out Duty Only" }
      ]
    }).limit(20).lean();
    const allAttendanceRecords = await AttendanceLogModel.find({}).limit(20).lean();
    const employees = await EmployeeModel.find({}).limit(20).lean();
    
    // Get counts
    const totalOutDutyRecords = await AttendanceLogForOutDutyModel.countDocuments();
    const totalAttendanceLogs = await AttendanceLogModel.countDocuments();
    const totalEmployees = await EmployeeModel.countDocuments();
    
    // Get merged records count
    const mergedRecordsCount = await AttendanceLogModel.countDocuments({
      $or: [
        { DurationSource: "Office + Out Duty" },
        { DurationSource: "Out Duty Only" }
      ]
    });
    
    // Get unique employees with merged records
    const uniqueEmployeesWithMergedRecords = await AttendanceLogModel.distinct('EmployeeId', {
      $or: [
        { DurationSource: "Office + Out Duty" },
        { DurationSource: "Out Duty Only" }
      ]
    });
    
    // Get date range of merged records
    const dateRange = await AttendanceLogModel.aggregate([
      {
        $match: {
          $or: [
            { DurationSource: "Office + Out Duty" },
            { DurationSource: "Out Duty Only" }
          ]
        }
      },
      {
        $group: {
          _id: null,
          minDate: { $min: "$AttendanceDate" },
          maxDate: { $max: "$AttendanceDate" }
        }
      }
    ]);
    
    // Get status breakdown
    const statusBreakdown = await AttendanceLogModel.aggregate([
      {
        $match: {
          $or: [
            { DurationSource: "Office + Out Duty" },
            { DurationSource: "Out Duty Only" }
          ]
        }
      },
      {
        $group: {
          _id: "$Status",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    // Get source breakdown
    const sourceBreakdown = await AttendanceLogModel.aggregate([
      {
        $match: {
          $or: [
            { DurationSource: "Office + Out Duty" },
            { DurationSource: "Out Duty Only" }
          ]
        }
      },
      {
        $group: {
          _id: "$DurationSource",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);
    
    // Get duration statistics
    const durationStats = await AttendanceLogModel.aggregate([
      {
        $match: {
          $or: [
            { DurationSource: "Office + Out Duty" },
            { DurationSource: "Out Duty Only" }
          ],
          Duration: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: "$Duration" },
          minDuration: { $min: "$Duration" },
          maxDuration: { $max: "$Duration" },
          totalDuration: { $sum: "$Duration" }
        }
      }
    ]);
    
    // Prepare response
    const results = {
      summary: {
        totalOutDutyRecords,
        totalAttendanceLogs,
        totalEmployees,
        mergedRecords: mergedRecordsCount,
        uniqueEmployeesWithMergedRecords: uniqueEmployeesWithMergedRecords.length,
        coveragePercentage: totalOutDutyRecords > 0 ? 
          ((mergedRecordsCount / totalOutDutyRecords) * 100).toFixed(1) : 0
      },
      actualData: {
        outDutyRecords: outDutyRecords,
        mergedRecords: mergedRecords,
        allAttendanceRecords: allAttendanceRecords,
        employees: employees
      },
      dateRange: dateRange.length > 0 ? {
        earliest: dateRange[0].minDate,
        latest: dateRange[0].maxDate
      } : null,
      statusBreakdown: statusBreakdown.reduce((acc, item) => {
        acc[item._id || 'Unknown'] = item.count;
        return acc;
      }, {}),
      sourceBreakdown: sourceBreakdown.reduce((acc, item) => {
        acc[item._id || 'Unknown'] = item.count;
        return acc;
      }, {}),
      durationStatistics: durationStats.length > 0 ? {
        average: Math.round(durationStats[0].avgDuration),
        minimum: durationStats[0].minDuration,
        maximum: durationStats[0].maxDuration,
        total: durationStats[0].totalDuration
      } : null,
      lastUpdated: new Date().toISOString()
    };
    
    return res.status(200).json({
      statusCode: 200,
      statusValue: "SUCCESS",
      message: "Merge results fetched successfully",
      data: results
    });
    
  } catch (error) {
    console.error("❌ Error fetching merge results:", error);
    return res.status(500).json({
      statusCode: 500,
      statusValue: "ERROR",
      message: "Failed to fetch merge results",
      error: error.message
    });
  }
};

module.exports = {
  createAttendanceLogForOutDuty,
  punchOutForOutDuty,
  getAttendanceLogForOutDutyById,
  getAllAttendanceLogs,
  getAttendanceLogsByEmployeeId,
  removeDuplicateLogs,
  getAttendanceDaysByMonth,
  removeDuplicateAttendance,
  startRemoveAttendanceDuplicateRecords,
  getAttendanceLogsTodays,
  generateUninformedLeave,
  approvedPendingLeaves,
  createEmployeeSalary,
  getAllEmployeeSalaries,
  getAllPunchRecordsForOutDuty,
  getAllOutDutyRecords,
  updateLocation,
  saveEmpLocation,
  recalculateDuration,
  triggerMergeAllExistingData,
  getMergeResults
};

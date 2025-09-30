const express = require("express");
const mongoose = require("mongoose");
const employeeModel = require("../models/employeeModel");
const redisClient = require("../config/redisClient");
// console.log(redisClient)
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const blacklist = require("../utils/blacklist");
const leaveTakenHistoryModel = require("../models/leaveTakenHistoryModel");
const holidaysModel = require("../models/holidayModel");
// console.log(process.env.JWT_SECRET)
const moment = require("moment");
const CompOff = require("../models/compOffHistoryModel");
const AttendanceLogModel = require("../models/attendanceLogModel");



const applyLeave = async (req, res) => {
    try {
        const schema = Joi.object({
            leaveType: Joi.string().valid(
                "medicalLeave", "earnedLeave", "paternityLeave",
                "maternityLeave", "casualLeave", "compOffLeave",
                "optionalLeave", "bereavementLeave"
            ).required(),
            leaveStartDate: Joi.string().required(),
            leaveEndDate: Joi.string().allow("").optional(),
            totalDays: Joi.number().required(),
            reason: Joi.string().required(),
            approvedBy: Joi.string().allow("").optional(),
            shift: Joi.string().allow("").optional(),
            location: Joi.string().allow("").optional(),
        });
        let result = schema.validate(req.body);
        // console.log(req.body)
        // console.log(req.body)  
        if (result.error) {
            return res.status(400).json({
                statusValue: "FAIL",
                statusCode: 400,
                message: result.error.details[0].message,
            });
        }

        let { leaveStartDate, leaveEndDate, totalDays, reason, approvedBy, leaveType, shift, location, } = req.body;
        // Check if end date is not provided
        if (!leaveEndDate || leaveEndDate.trim() === "" || leaveEndDate === "undefined") {
            leaveEndDate = leaveStartDate;
        }


        // fun to validate leaves dates
        const validateLeaveDates = (leaveStartDate, leaveEndDate, leaveType) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0)  // normalize to midnight

            // convert normal input string into date obj
            const startDate = new Date(leaveStartDate);
            const endDate = new Date(leaveEndDate);

            // check date condition  
            if (startDate > endDate) {
                return {
                    isValid: false,
                    message: `${leaveStartDate} must be less than or equal to ${leaveEndDate}`
                }
            }

            // Restrict past dates for specific leave types
            const restrictedLeaveTypes = []
            if (restrictedLeaveTypes.includes(leaveType)) {
                if (startDate < today || endDate < today) {
                    return {
                        isValid: false,
                        message: `For ${leaveType}, you can only select the current date or future dates.`
                    }
                }
            }
            return {
                isValid: true,
                message: "Dates are valid"
            }
        }

        let leaveRes = validateLeaveDates(leaveStartDate, leaveEndDate, leaveType);
        if (!leaveRes.isValid) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: leaveRes.message,
            });
        }

        // Extract the token from the Authorization header
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Token is required",
            });
        }
        // Decode the token to get employee details
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Invalid token",
            });
        }
        // console.log(decoded)
        // get current date and time
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


        const availableBalance = await employeeModel.findOne(
            { $or: [{ employeeCode: req.params.employeeId }, { employeeId: req.params.employeeId }] },
            { employeeId: 1, leaveBalance: 1,}
        ).lean();
        
        const userDetails = await employeeModel.findOne({ $or: [{ employeeCode: req.params.employeeId }, { employeeId: req.params.employeeId }]}, {employeeId:1, managerId:1})
        // console.log("Available Balance:", availableBalance.leaveBalance);
        if (!availableBalance) {
            return res.status(404).json({
                message: "Employee not found",
                statusCode: 404,
                statusValue: "error"
            });
        }

        // Extract leaveType safely
        leaveType = req.body.leaveType?.trim();
        // console.log("Available Leave Balance:", availableBalance.leaveBalance);
        // console.log("Keys in Leave Balance:", Object.keys(availableBalance.leaveBalance));
        // console.log("Checking for leaveType:", leaveType);
        if (!leaveType || !availableBalance.leaveBalance || typeof availableBalance.leaveBalance !== "object" || !availableBalance.leaveBalance.hasOwnProperty(leaveType)) {
            return res.status(400).json({
                message: "Invalid leave type",
                statusCode: 400,
                statusValue: "error"
            });
        }

        // Fetch pending leaves of the same type for the employee
        const leaveHistory = await leaveTakenHistoryModel.find({
            employeeId: req.params.employeeId,
            status: "Pending",
            leaveType: leaveType  // Ensure comparison is done correctly
        });
        
        // Calculate total pending leave balance
        let totalPendingLeaveBal = leaveHistory.reduce((sum, leave) => sum + Number(leave.totalDays), 0);
        totalPendingLeaveBal += Number(req.body.totalDays);

        console.log('Total Pending Leave Balance:', totalPendingLeaveBal);

        // Convert available balance to number safely
        const availableLeaveBal = Number(availableBalance.leaveBalance[leaveType] || "0");

        console.log(`Available Leave Balance for ${leaveType}:`, availableLeaveBal);
        // Check if available balance is less than total pending leave balance
        if (availableLeaveBal < totalPendingLeaveBal) {
            return res.status(400).json({
                message: `Outreached pending ${leaveType} balance.`,
                statusCode: 400,
                statusValue: "error"
            });
        }
        // Proceed with leave request processing...
        // check already exists
        const isAlreadyExists = await leaveTakenHistoryModel.find({
            $and: [
                { employeeId: req.params.employeeId },
                // { leaveType: req.body.leaveType },
                { $or: [{ status: "Approved" }, { status: "Pending" }] },
                {
                    $or: [
                        {
                            $and: [
                                { leaveStartDate: { $lte: leaveEndDate } },
                                { leaveEndDate: { $gte: leaveStartDate } },
                            ]
                        },
                        {
                            $and: [
                                { leaveStartDate: { $lte: leaveStartDate } },
                                { leaveEndDate: { $gte: leaveEndDate } },
                            ]
                        }
                    ]
                }
            ]
        });

        // console.log(!!isAlreadyExists.length)
        if (!!isAlreadyExists.length > 0) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "You have already applied leave on same date",
                statusMessage: "You have already applied leave on same date",
            });
        }
        // console.log(decoded)

        const bodyDoc = new leaveTakenHistoryModel({
            employeeId: req.params.employeeId,
            leaveType: leaveType,
            leaveStartDate: leaveStartDate,
            leaveEndDate: leaveEndDate,
            totalDays: totalDays.toString(),
            reason: reason,
            approvedBy: userDetails.managerId || "NA",
            status: "Pending",
            dateTime: dateTime,
            shift: shift || "",
            location: req.body.location || ""
        })

        const saveDoc = await bodyDoc.save();
        if (saveDoc) {
            return res.status(201).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Leave applied successfully.",
            });
        }
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message,
            error: error.message,
        });
    }
}


const applyForRegularization = async (req, res) => {
  try {
    const schema = Joi.object({
      leaveType: Joi.string().valid("regularized", "shortLeave").required(),
      leaveStartDate: Joi.string().required(),
      reason: Joi.string().required(),
      approvedBy: Joi.string().allow("").optional(),
    });

    let result = schema.validate(req.body);
    if (result.error) {
      return res.status(400).json({
        statusValue: "FAIL",
        statusCode: 400,
        message: result.error.details[0].message,
      });
    }

    // Extract the token from the Authorization header
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(400).json({
        statusCode: 400,
        statusValue: "FAIL",
        message: "Token is required",
      });
    }

    // Decode the token to get employee details
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(400).json({
        statusCode: 400,
        statusValue: "FAIL",
        message: "Invalid token",
      });
    }

    const getUser = await employeeModel.findOne({
      employeeId: decoded.employeeId,
    });
    let { leaveStartDate, reason, approvedBy, leaveType } = req.body;

    if (
      !leaveStartDate ||
      !moment(leaveStartDate, "YYYY-MM-DD", true).isValid()
    ) {
      return res.status(400).json({
        statusValue: "FAIL",
        statusCode: 400,
        message: "Invalid date format for leaveStartDate. Use 'YYYY-MM-DD'.",
      });
    }

    const leaveDate = moment(leaveStartDate, "YYYY-MM-DD", true);
    const today = moment().endOf("day");
    const past35Days = moment().subtract(40, "days").startOf("day");

    if (!leaveDate.isBetween(past35Days, today, "day", "[]")) {
      return res.status(400).json({
        statusValue: "FAIL",
        statusCode: 400,
        message: `${leaveType} can only be applied within the last 35 days.`,
      });
    }

    // Get month range based on leaveStartDate
    const startOfMonth = moment(leaveStartDate, "YYYY-MM-DD").startOf("month");
    const endOfMonth = moment(leaveStartDate, "YYYY-MM-DD").endOf("month");

    // MongoDB query using $expr to compare string dates
    const checkMaxLimitReg = await leaveTakenHistoryModel.find({
      employeeId: req.params.employeeId,
      leaveType: leaveType,
      $expr: {
        $and: [
          { $lte: [{ $toDate: "$leaveStartDate" }, endOfMonth.toDate()] },
          { $gte: [{ $toDate: "$leaveEndDate" }, startOfMonth.toDate()] },
        ],
      },
    });

    // Check if the count exceeds the limit
    if (leaveType === "regularized") {
      const checkAttendance = await AttendanceLogModel.findOne({
        $and: [
          { AttendanceDate: new Date(req.body.leaveStartDate) },
          { EmployeeCode: req.params.employeeId },
        ],
      });

    //   if (checkAttendance && checkAttendance.Duration <= 480) {
    //     return res.status(400).json({
    //       message: "Your work duration is less than 8 hours.",
    //       statusCode: 400,
    //       statusValue: "VALIDATION_ERROR",
    //     });
    //   }

      if (checkMaxLimitReg.length >= 2) {
        return res.status(400).json({
          message:
            "You have already reached the maximum regularization limit for this month.",
          statusCode: 400,
          statusValue: "LIMIT_EXCEEDED",
        });
      }
    } else if (leaveType === "shortLeave") {
      if (checkMaxLimitReg.length >= 1) {
        return res.status(400).json({
          message:
            "You have already reached the maximum short leave limit for this month.",
          statusCode: 400,
          statusValue: "LIMIT_EXCEEDED",
        });
      }
    }

    // get current date and time (India timezone)
    const getIndiaCurrentDateTime = () => {
      const indiaTime = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
      });
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
    
    // check attendance for employee
    const checkAttendance = await AttendanceLogModel.findOne({
      $and: [
        { AttendanceDate: new Date(req.body.leaveStartDate) },
        { EmployeeCode: req.params.employeeId },
      ],
    });

    if (!checkAttendance) {
      return res.status(400).json({
        message: "We don't have your attendance log on this date.",
        statusCode: 400,
        statusValue: "false",
      });
    }

    const bodyDoc = new leaveTakenHistoryModel({
      employeeId: req.params.employeeId,
      leaveType: leaveType,
      leaveStartDate: leaveStartDate,
      leaveEndDate: leaveStartDate,
      totalDays: "1",
      reason: reason,
      approvedBy: getUser.managerId,
      status: "Pending",
      dateTime: dateTime,
    });

    const saveDoc = await bodyDoc.save();
    if (saveDoc) {
      return res.status(201).json({
        statusCode: 200,
        statusValue: "SUCCESS",
        message: "Leave applied successfully.",
      });
    }

    return res.status(400).json({
      message: "You have provided wrong id",
      statusCode: 400,
      statusValue: "FAIL",
    });
  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      statusValue: "FAIL",
      message: error.message,
      error: error.message,
    });
  }
};


const applyForVendorMeeting = async (req, res) => {
    try {
        const schema = Joi.object({
            leaveType: Joi.string().valid("vendor-meeting").required(),
            leaveStartDate: Joi.string().required(),
            leaveEndDate: Joi.string().required(),
            reason: Joi.string().required(),
            totalDays: Joi.string().required(),
            approvedBy: Joi.string().allow("").optional(),
            duration:Joi.string().allow("").optional(),
        });
        let result = schema.validate(req.body);
        // console.log(11, req.body) 
        if (result.error) {
            return res.status(400).json({
                statusValue: "FAIL",
                statusCode: 400,
                message: result.error.details[0].message,
            });
        }

        // Extract the token from the Authorization header
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Token is required",
            });
        }
        // Decode the token to get employee details
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Invalid token",
            });
        }
        const getUser = await employeeModel.findOne({ employeeId: decoded.employeeId })
        
        let { leaveStartDate, leaveEndDate, reason, approvedBy, leaveType, duration, totalDays } = req.body;
        
        // Check if already applied for the same date
        const alreadyApplied = await leaveTakenHistoryModel.findOne({
            employeeId: req.params.employeeId,
            leaveType: "vendor-meeting",
            leaveStartDate: leaveStartDate,
            status: {$in : ["Pending", "Approved"]}
        });
        
        if (alreadyApplied) {
            return res.status(400).json({
                statusValue: "FAIL",
                statusCode: 400,
                message: "You have already applied for vendor-meeting on this date.",
            })
        }
        
         // Handle duration automatically
        let finalDuration;
        if (parseFloat(totalDays) > 0.5) {
            finalDuration = "fullDay";
        } else if (totalDays === "0.5" || totalDays === ".5") {
            finalDuration = duration ? duration.toString() : "firstHalf"; 
        } else {
            finalDuration = "fullDay";
        }

        // get current date and time
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
        
         // Save document (all values stored as string)
        const bodyDoc = new leaveTakenHistoryModel({
            employeeId: decoded.employeeId.toString(),
            leaveType: leaveType.toString(),
            leaveStartDate: leaveStartDate.toString(),
            leaveEndDate: leaveEndDate.toString(),
            totalDays: totalDays.toString(),
            reason: reason.toString(),
            approvedBy: (getUser.managerId || "System").toString(),
            status: "Pending".toString(),
            dateTime: dateTime.toString(),
            duration: finalDuration.toString()
        });
        
        const saveDoc = await bodyDoc.save();
        if (saveDoc) {
            return res.status(201).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Leave applied successfully.",
            }); 
        }
        return res.status(400).json({
            message: "You have provided wrong id",
            statusCode: 400,
            statusValue: "FAIL",
        });
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message,
            error: error.message,
        });
    }
}


const actionForVendorMeeting = async (req, res) => {
    try {
        const schema = Joi.object({
            status: Joi.string().valid("Approved", "Rejected", "Pending").required(),
        });
        let result = schema.validate(req.body);
        // console.log(req.body) 
        if (result.error) {
            return res.status(400).json({
                statusValue: "FAIL",
                statusCode: 400,
                message: result.error.details[0].message,
            });
        }

        // Extract the token from the Authorization header
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Token is required",
            });
        }
        // Decode the token to get employee details
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Invalid token",
            });
        }
        const getUser = await employeeModel.findOne({ employeeId: decoded.employeeId })

        let { status } = req.body;
        // get current date and time
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
        const updateDoc = await leaveTakenHistoryModel.findOneAndUpdate(
            { _id: req.params.id },
            {
                approvedBy: getUser.employeeId,
                status: status,
                approvedDateTime: dateTime
            }
        )

        if (status === "Approved") {
            const leaveDate = new Date(updateDoc.leaveStartDate);
            leaveDate.setUTCHours(0, 0, 0, 0); // Ensure match on exact date

            const data1 = await AttendanceLogModel.findOneAndUpdate(
                {
                    EmployeeCode: updateDoc.employeeId,
                    AttendanceDate: leaveDate,
                },
                {
                    Status: "Present",
                    Duration: updateDoc.duration,
                },
                {
                    new: true,
                }
            );
            
            if (data1) {
                console.log("Attendance log updated:", data1);
            } else {
                console.log("No matching attendance log found to update.");
            }
        }

        if (updateDoc) {
            return res.status(201).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Data updated successfully.",
            });
        }
        return res.status(400).json({
            message: "You have provided wrong id",
            statusCode: 400,
            statusValue: "FAIL",
        });
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message,
            error: error.message,
        });
    }
}


const requestCompOff = async (req, res) => {
    try {
        const { compOffDate, reason, totalDayss } = req.body;
        const totalDaysStr = String(totalDayss).trim().toLowerCase();

        // Allowed values
        const allowedValues = ["0.5", ".5", "1", "1.0", "half-day", "full-day"];

        // Validate required fields & allowed values
        if (!req.params.employeeId || !compOffDate || !reason || !allowedValues.includes(totalDaysStr)) {
            return res.status(400).json({
                message: `Employee ID, Comp Off Date, Reason are required, and Total Days must be one of: ${allowedValues.join(", ")}`,
                statusCode: 400,
                statusValue: "error",
            });
        }

        // Normalize value
        let normalizedTotalDays;
        if (["0.5", ".5", "half-day"].includes(totalDaysStr)) {
            normalizedTotalDays = "0.5";
        } else {
            normalizedTotalDays = "1.0";
        }
        req.body.totalDayss = normalizedTotalDays;

        // Validate token
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "error",
                message: "Token is required",
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "error",
                message: "Invalid token",
            });
        }

        // Check duplicate comp-off
        const existingCompOff = await CompOff.findOne({
            employeeId: req.params.employeeId,
            compOffDate: compOffDate,
            totalDays: normalizedTotalDays,
        });

        if (existingCompOff) {
            return res.status(400).json({
                message: "Compensatory off already applied for the same date.",
                statusCode: 400,
                statusValue: "error",
            });
        }

        // Validate employee type
        const getUser = await employeeModel.findOne({ employeeId: decoded.employeeId });
        if (!getUser || getUser.employmentType?.trim().toLowerCase() === "contractual") {
            return res.status(400).json({
                message: "You cannot apply for a Comp-off request.",
                statusCode: 400,
                statusValue: "error",
            });
        }

        // Get current IST datetime
        const getIndiaCurrentDateTime = () => {
            const indiaTime = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
            const date = new Date(indiaTime);
            const pad = (n) => (n < 10 ? `0${n}` : n);

            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        };

        const dateTime = getIndiaCurrentDateTime();

        // Create comp-off request
        const compOffRequest = new CompOff({
            employeeId: req.params.employeeId,
            compOffDate,
            reason,
            approvedBy: getUser.managerId || "",
            appliedDate: dateTime,
            totalDays: normalizedTotalDays,
        });
        
        const savedCompOff = await compOffRequest.save();
        if (!savedCompOff) {
            return res.status(400).json({
                message: "Comp-off not generated.",
                statusCode: 400,
                statusValue: "error",
            });
        }

        return res.status(201).json({
            message: "Comp Off request created successfully.",
            statusCode: 201,
            statusValue: "success",
            data: savedCompOff,
        });
    } catch (error) {
        res.status(500).json({
            message: "An error occurred while requesting Comp Off.",
            statusCode: 500,
            statusValue: "error",
            error: error.message,
        });
    }
};


const actionCompOff = async (req, res) => {
    try {
        const id = req.params.id;
        if (!id) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Id is required",
            });
        }
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Token is required",
            });
        }
        const schema = Joi.object({
            status: Joi.string().valid("Approved", "Rejected").required(),
        });
        let result = schema.validate(req.body);
        // console.log(req.body) 
        if (result.error) {
            return res.status(400).json({
                statusValue: "FAIL",
                statusCode: 400,
                message: result.error.details[0].message,
            });
        }
        // Decode the token to get employee details
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Invalid token",
            });
        }
        const getUser = await employeeModel.findOne({ employeeId: decoded.employeeId }).lean();
        // const test = await CompOff.find({});
        // console.log(11, test)

        if (!getUser) {
            return res.status(404).json({
                statusCode: 404,
                statusValue: "FAIL",
                message: "User not found.",
            });
        }
        // console.log(11, getUser.role)
        // if (getUser.role !== "Manager" || !getUser.role !== "HR-Admin") {
        //     return res.status(403).json({
        //         statusCode: 403,
        //         statusValue: "FAIL",
        //         message: "You don't have access to this feature.",
        //     });
        // }
        // Get current date and time in IST
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

        const dateTime = getIndiaCurrentDateTime();
        const compOffData = await CompOff.findOne({ _id: req.params.id })
        const empData = await employeeModel.findOne({ employeeId: compOffData.employeeId })
        // Create a new Comp Off request
        const compOffRequest = await CompOff.findOneAndUpdate(
            { _id: req.params.id },
            {
                status: req.body.status,
                approvedDate: dateTime,
                comments: "Action taken by manager",
                approvedBy: empData?.managerId || "NA"
            },
            { new: true }
        );

        if (req.body.status === "Approved") {
            const compOffData = await CompOff.findById(req.params.id);
            if (!compOffData) {
                return res.status(404).json({
                    statusCode: 404,
                    statusValue: "FAIL",
                    message: "CompOff data not found."
                });
            }

            const totalDays = parseFloat(compOffData.totalDays, 10) || 0; // Convert string to integer safely

            await employeeModel.updateOne(
                { employeeId: compOffData.employeeId },
                [
                    {
                        $set: {
                            "leaveBalance.compOffLeave": {
                                $toString: {
                                    $add: [
                                        { $toDouble: "$leaveBalance.compOffLeave" },
                                        totalDays, // Add totalDays to earnedLeave balance
                                    ],
                                },
                            },
                        },
                    },
                ]
            );
        }
        if (!compOffRequest) {
            return res.status(400).json({
                message: 'Compoff request not updated.',
                statusCode: 400,
                statusValue: 'error',
            });
        }
        return res.status(200).json({
            message: 'Comp Off request updated successfully.',
            statusCode: 200,
            statusValue: 'SUCCESS',
            data: compOffRequest,
        });
    } catch (error) {
        res.status(500).json({
            message: 'An error occurred while requesting Comp Off.',
            statusCode: 500,
            statusValue: 'error',
            error: error.message,
        });
    }
};



const actionForLeavApplication = async (req, res) => {
    try {
        const schema = Joi.object({
            status: Joi.string().valid("Approved", "Rejected").required(),
            remarks: Joi.string().allow("").optional(),
        });
        let result = schema.validate(req.body);
        if (result.error) {
            return res.status(400).json({
                statusValue: "FAIL",
                statusCode: 400,
                message: result.error.details[0].message,
            });
        }

        // Extract the token from the Authorization header
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Token is required",
            });
        }
        // Decode the token to get employee details
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Invalid token",
            });
        }

        const loggedInUser = await employeeModel.findOne({ employeeId: decoded.employeeId }, { employeeName: 1, employeeId: 1, email: 1 })
        // Check leave data
        const leaveData = await leaveTakenHistoryModel.findOne({ _id: req.params.id });
        if (!leaveData) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Wrong id",
            });
        }

        // Get user leave balance
        const getUser = await employeeModel.findOne({ employeeId: leaveData.employeeId }, { leaveBalance: 1 });
        if (!getUser) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Employee not found.",
            });
        }

        // Get current date and time in IST
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

        const dateTime = getIndiaCurrentDateTime();

        // Check if status is "Approved" and update leave balance
        if (req.body.status === "Approved") {
            const { leaveType, totalDays } = leaveData;
            const leaveBalance = getUser.leaveBalance;

            // // Validate leaveType
            // if (!leaveBalance.hasOwnProperty(leaveType)) {
            //     return res.status(400).json({
            //         statusCode: 400,
            //         statusValue: "FAIL",
            //         message: `Invalid leave type: ${leaveType}`,
            //     });
            // }

            // Check sufficient balance
            const availableBalance = parseFloat(leaveBalance[leaveType]);
            const daysToDeduct = parseFloat(totalDays);

            if (availableBalance < daysToDeduct) {
                return res.status(400).json({
                    statusCode: 400,
                    statusValue: "FAIL",
                    message: `Insufficient balance for ${leaveType}. Available: ${availableBalance}, Required: ${daysToDeduct}`,
                });
            }

            // Deduct leave days
            const updatedBalance = (availableBalance - daysToDeduct).toString();

            // Update employee's leave balance
            const updateLeaveBalance = await employeeModel.findOneAndUpdate(
                { employeeId: leaveData.employeeId },
                { $set: { [`leaveBalance.${leaveType}`]: updatedBalance } }
            );

            if (!updateLeaveBalance) {
                return res.status(500).json({
                    statusCode: 500,
                    statusValue: "FAIL",
                    message: "Failed to update leave balance.",
                });
            }
        }

        // Update leave application status
        const updateDoc = await leaveTakenHistoryModel.findOneAndUpdate(
            { _id: req.params.id },
            {
                status: req.body.status,
                approvedDateTime: dateTime,
                approvedBy: getUser.employeeId,
                remarks: `Action taken by ${loggedInUser.employeeName}`
            }
        );

        if (updateDoc) {
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Leave updated successfully.",
            });
        }

        return res.status(400).json({
            statusCode: 400,
            statusValue: "FAIL",
            message: "Wrong id || Data not updated successfully.",
        });
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message,
            error: error.message,
        });
    }
};


const updateLeaveHistoryData = async (req, res) => {
  try {
    const { employeeId, leaveStartDate, status, leaveType } = req.body;
    // Ensure required identifiers
    if (!employeeId || !leaveStartDate) {
      return res.status(400).json({
        statusCode: 400,
        statusValue: "FAILED",
        message: "employeeId and leaveStartDate are required.",
      });
    }

    // Step 1: Check if the document exists
    const existingDoc = await leaveTakenHistoryModel.findOne({
      employeeId,
      leaveStartDate,
    });

    if (!existingDoc) {
      return res.status(404).json({
        statusCode: 404,
        statusValue: "FAILED",
        message: "Leave record not found.",
      });
    }

    // Step 2: Merge incoming fields with existing ones
    const updatedFields = {
      status: status ?? existingDoc.status,
      leaveType: leaveType ?? existingDoc.leaveType,
      leaveStartDate: leaveStartDate ?? existingDoc.leaveStartDate
    };

    // Step 3: Perform update
    const updatedDoc = await leaveTakenHistoryModel.findByIdAndUpdate(
      existingDoc._id,
      updatedFields,
      { new: true }
    );

    return res.status(200).json({
      statusCode: 200,
      statusValue: "SUCCESS",
      message: "Leave updated successfully.",
      data: updatedDoc,
    });
  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      statusValue: "FAIL",
      message: error.message,
    });
  }
};


const revertLeaveReq = async (req, res) => {
    try {
        const { revertedDays, id } = req.body;
        console.log(req.body)
        const schema = Joi.object({
            id: Joi.string().required(),
            revertedDays: Joi.string().required(),
        });
        let result = schema.validate(req.body);
        if (result.error) {
            return res.status(400).json({
                statusValue: "FAIL",
                statusCode: 400,
                message: result.error.details[0].message,
            });
        }
        // console.log(req.body)
        // Check leave data
        const leaveData = await leaveTakenHistoryModel.findOne({ _id: id }, { _id: 1, employeeId: 1, totalDays: 1, leaveType: 1 });
        if (!leaveData) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Wrong id",
            });
        }
        // Convert revertedDays and totalDays to float
        const revertedDaysFloat = parseFloat(revertedDays);
        const totalDaysFloat = parseFloat(leaveData.totalDays);

        // Validate if values are proper numbers
        if (isNaN(revertedDaysFloat) || isNaN(totalDaysFloat)) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Invalid leave days data.",
            });
        }

        // Validate if values are proper numbers
        if (isNaN(revertedDaysFloat) || isNaN(totalDaysFloat)) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Invalid leave days data.",
            });
        }

        // Check if reverted days exceed total leave days
        if (revertedDaysFloat > totalDaysFloat) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "You cannot apply for a revert leave req exceeding the total leave days.",
            });
        }

        const getUser = await employeeModel.findOne({ employeeId: leaveData.employeeId }, { leaveBalance: 1 });
        if (!getUser) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Employee not found.",
            });
        }

        // Get current date and time in IST
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
        const dateTime = getIndiaCurrentDateTime();

        const updateDoc = await leaveTakenHistoryModel.findOneAndUpdate(
            { _id: id },
            {
                "revertLeave.requestedDateTime": dateTime,
                "revertLeave.revertedDays": revertedDays || "",
                "revertLeave.status": "Pending",
            },
            { upsert: true }
        );

        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Data updated successfully.",
        });
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message,
            error: error.message,
        });
    }
};


const actionForRevertLeaveReq = async (req, res) => {
    try {
        const schema = Joi.object({
            status: Joi.string().valid("Approved", "Rejected").required(),
        });
        let result = schema.validate(req.body);
        if (result.error) {
            return res.status(400).json({
                statusValue: "FAIL",
                statusCode: 400,
                message: result.error.details[0].message,
            });
        }
        const { status } = req.body;
        const id = req.params.id;

        const leaveData = await leaveTakenHistoryModel.findOne({ _id: id }, { _id: 1, employeeId: 1, totalDays: 1, leaveType: 1, revertLeave: 1 });
        if (!leaveData) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Wrong id",
            });
        }
        if (leaveData?.revertLeave?.status === "Approved") {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Revert leave already Approved.",
            });
        }

        const getUser = await employeeModel.findOne({ employeeId: leaveData.employeeId }, { leaveBalance: 1 });
        if (!getUser) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Employee not found.",
            });
        }

        // Get current date and time in IST
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
        const dateTime = getIndiaCurrentDateTime();

        // Extract revertedDays
        const revertedDaysFloat = parseFloat(leaveData.revertLeave?.revertedDays || "0");
        if (isNaN(revertedDaysFloat) || revertedDaysFloat <= 0) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Invalid reverted days data.",
            });
        }

        // Update revertLeave status
        const updateDoc = await leaveTakenHistoryModel.findOneAndUpdate(
            { _id: id },
            {
                "revertLeave.approvedDateTime": dateTime,
                "revertLeave.status": status,
            },
            { new: true }
        );
        if (status === "Approved") {
            const leaveType = leaveData.leaveType;
            const currentLeaveBalance = parseFloat(getUser.leaveBalance?.[leaveType] || "0");
            const newLeaveBalance = (currentLeaveBalance + revertedDaysFloat).toString();

            const updateLeaveBalance = await employeeModel.findOneAndUpdate(
                { employeeId: leaveData.employeeId },
                { $set: { [`leaveBalance.${leaveType}`]: newLeaveBalance } }, // Store as string
                { new: true }
            );

            if (!updateLeaveBalance) {
                return res.status(400).json({
                    statusCode: 400,
                    statusValue: "FAIL",
                    message: "Failed to update leave balance.",
                });
            }
        }
        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Data updated successfully.",
        });

    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message,
            error: error.message,
        });
    }
};


const deleteLeavApplication = async (req, res) => {
    try {
        const updateDoc = await leaveTakenHistoryModel.findOneAndDelete({ _id: req.params.id });
        if (updateDoc) {
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Data deleted successfully.",
            });
        }

        return res.status(400).json({
            statusCode: 400,
            statusValue: "FAIL",
            message: "Wrong id || Data not deleted successfully.",
        });

    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message,
            error: error.message,
        });
    }
};


const getLeavesDataAsJson = async (req, res) => {
    try {
        const jsonData = await leaveTakenHistoryModel.find({ _id: { $type: "string" } }, { _id: 0, createdAt: 0, updatedAt: 0, __v: 0 })
        if (jsonData.length > 0) {
            await leaveTakenHistoryModel.insertMany(jsonData);
        }
        return res.status(400).json({
            statusCode: 400,
            statusValue: "FAIL",
            message: "Wrong id || Data not deleted successfully.",
            data: jsonData
        });
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message,
            error: error.message,
        });
    }
};


const deleteCompOffById = async (req, res) => {
    try {
        // Update leave application status
        const updateDoc = await CompOff.findOneAndDelete({ _id: req.params.id });
        if (updateDoc) {
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Data deleted successfully.",
            });
        }

        return res.status(400).json({
            statusCode: 400,
            statusValue: "FAIL",
            message: "Wrong id || Data not deleted successfully.",
        });
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message,
            error: error.message,
        });
    }
};


const actionForRegularization = async (req, res) => {
    try {
        const schema = Joi.object({
            status: Joi.string().valid("Approved", "Rejected").required(),
        });
        let result = schema.validate(req.body);

        if (result.error) {
            return res.status(400).json({
                statusValue: "FAIL",
                statusCode: 400,
                message: result.error.details[0].message,
            });
        }
        // console.log(11, req.params)
        // Get current date and time
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

        const dateTime = getIndiaCurrentDateTime();
        const { status } = req.body;

        // check if given req is Pending
        // Check if already Approved
        const isExists = await leaveTakenHistoryModel.findOne({
            _id: req.params.id,
            status: "Approved",
        });

        if (isExists) {
            return res.status(400).json({
                statusValue: "FAIL",
                statusCode: 400,
                message: "This request has already been approved.",
            });
        }

        const updateDoc = await leaveTakenHistoryModel.findOneAndUpdate(
            { _id: req.params.id },
            {
                status: req.body.status,
                approvedDateTime: dateTime,
            }
        );

        const leaveData = await leaveTakenHistoryModel.findOne({ _id: req.params.id });
        const employeeId = leaveData?.employeeId;
        if (status === "Approved") {
            if (leaveData.leaveType === "regularized") {
                const updatedEmployee = await employeeModel.findOneAndUpdate(
                    { employeeId: employeeId },
                    [
                        {
                            $set: {
                                maxRegularization: {
                                    $toString: { $subtract: [{ $toInt: "$maxRegularization" }, 1] },
                                },
                            },
                        },
                    ],
                    { new: true }
                );
                return res.status(200).json({
                    message: "Regularization updated successfully",
                    statusCode: 200,
                    statusValue: "Success",
                    data: updatedEmployee,
                });
            }
            const updatedEmployee = await employeeModel.findOneAndUpdate(
                { employeeId: employeeId },
                [
                    {
                        $set: {
                            maxShortLeave: {
                                $toString: { $subtract: [{ $toInt: "$maxShortLeave" }, 1] },
                            },
                        },
                    },
                ],
                { new: true }
            );

            if (updatedEmployee) {
                return res.status(200).json({
                    message: "Leave updated successfully",
                    statusCode: 200,
                    statusValue: "Success",
                    data: updatedEmployee,
                });
            } else {
                return res.status(404).json({
                    message: "Employee not found",
                    statusCode: 404,
                    statusValue: "Error",
                });
            }
        } else if (status === "Rejected") {
            return res.status(200).json({
                message: "Status is Rejected, no changes made",
                statusCode: 200,
                statusValue: "Success",
            });
        }

        return res.status(400).json({
            statusCode: 400,
            statusValue: "FAIL",
            message: "Data not updated successfully.",
        });
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message,
            error: error.message,
        });
    }
};


const updateLeaveStatus = async (req, res) => {
    try {
        const schema = Joi.object({
            status: Joi.string().valid("medicalLeave", "earnedLeave", "paternityLeave", "maternityLeave").required(),
        });
        let result = schema.validate(req.body);
        // console.log(req.body)  
        if (result.error) {
            return res.status(400).json({
                statusValue: "FAIL",
                statusCode: 400,
                message: result.error.details[0].message,
            });
        }

        // Extract the token from the Authorization header
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Token is required",
            });
        }
        // Decode the token to get employee details
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return res.status(400).json({
                statusCode: 400,

                statusValue: "FAIL",
                message: "Invalid token",
            });
        }
        // get current date and time
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

        // check already exists
        const isAlreadyExists = await leaveTakenHistoryModel.find({
            $and: [
                { employeeId: req.params.employeeId },
                { leaveType: req.body.leaveType },
                { leaveStartDate: req.body.leaveStartDate },
                // { eaveEndDate:req.body.leaveEndDate },
                { status: "Pending" }
            ]
        });
        // console.log(!!isAlreadyExists.length)
        if (!!isAlreadyExists.length > 0) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "You have already applied leave on same date",
            });
        }
        // console.log(decoded)
        const bodyDoc = new leaveTakenHistoryModel({
            employeeId: req.params.employeeId,
            leaveType: req.body.leaveType,
            leaveStartDate: req.body.leaveStartDate,
            leaveEndDate: req.body.leaveEndDate,
            totalDays: (req.body.totalDays).toString(),
            reason: req.body.reason,
            approvedBy: !!req.body.approvedBy ? req.body.approvedBy : "NA",
            status: "Pending",
            dateTime: dateTime
        })

        const saveDoc = await bodyDoc.save();
        if (saveDoc) {
            return res.status(201).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Leave applied successfully.",
            });
        }

    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "",
            error: error.message,
        });
    }
}


const getLeavesTakenByEmpId = async (req, res) => {
    try {
        // Extract the token from the Authorization header
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Token is required",
            });
        }

        // Decode the token to get employee details
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // console.log('emp', decoded);
        if (!decoded) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Invalid token",
            });
        }

        // Extract pagination parameters
        const pageNumber = parseInt(req.query.page, 10) || 1; // Default page is 1
        const limitNumber = parseInt(req.query.limit, 10) || 20; // Default limit is 10
        const skip = (pageNumber - 1) * limitNumber;

        // const aggregateLogic = [
        //     {
        //         $match: {
        //             employeeId: req.params.employeeId,
        //         },
        //     },
        //     {
        //         $lookup: {
        //             from: "employees",
        //             localField: "employeeId",
        //             foreignField: "employeeId",
        //             as: "employeeInfo",
        //         },
        //     },
        //     {
        //         $unwind: {
        //             path: "$employeeInfo",
        //             preserveNullAndEmptyArrays: false, // Ensures no documents with empty employeeInfo are returned
        //         },
        //     },
        //     {
        //         $addFields: {
        //             statusPriority: {
        //                 $switch: {
        //                     branches: [
        //                         { case: { $eq: ["$status", "Pending"] }, then: 1 },
        //                         { case: { $eq: ["$status", "Approved"] }, then: 2 },
        //                         { case: { $eq: ["$status", "Rejected"] }, then: 3 },
        //                     ],
        //                     default: 4, // Fallback priority for unexpected statuses
        //                 },
        //             },
        //         },
        //     },
        //     {
        //         $sort: { statusPriority: 1, updatedAt: -1 },
        //     },
        //     {
        //         $replaceRoot: {
        //             newRoot: {
        //                 $mergeObjects: [
        //                     { _id: "$_id" }, // Ensure the original _id is preserved
        //                     "$$ROOT",
        //                     {
        //                         employeeInfo: {
        //                             employeeName: "$employeeInfo.employeeName",
        //                             employeeCode: "$employeeInfo.employeeCode",
        //                             gender: "$employeeInfo.gender",
        //                             departmentId: "$employeeInfo.departmentId",
        //                             designation: "$employeeInfo.designation",
        //                             doj: "$employeeInfo.doj",
        //                             employmentType: "$employeeInfo.employmentType",
        //                             employeeStatus: "$employeeInfo.employeeStatus",
        //                             accountStatus: "$employeeInfo.accountStatus",
        //                             residentialAddress: "$employeeInfo.residentialAddress",
        //                             permanentAddress: "$employeeInfo.permanentAddress",
        //                             contactNo: "$employeeInfo.contactNo",
        //                             email: "$employeeInfo.email",
        //                             dob: "$employeeInfo.dob",
        //                             bloodGroup: "$employeeInfo.bloodGroup",
        //                             workPlace: "$employeeInfo.workPlace",
        //                             emergencyContact: "$employeeInfo.emergencyContact",
        //                             managerId: "$employeeInfo.managerId",
        //                             leaveBalance: "$employeeInfo.leaveBalance",
        //                             role: "$employeeInfo.role",
        //                         },
        //                     },
        //                 ],
        //             },
        //         },
        //     },            
        //     {
        //         $project: {
        //             employeeInfo: 1,
        //             leaveType: 1,
        //             leaveStartDate: 1,
        //             leaveEndDate: 1,
        //             totalDays: 1,
        //             reason: 1,
        //             status: 1,
        //             approvedBy: 1,
        //             approvedDateTime: 1,
        //             dateTime: 1,
        //             location:1,
        //             remarks:1,
        //             revertLeave:1
        //         },
        //     },
        //     {
        //         $facet: {
        //             metadata: [{ $count: "totalRecords" }],
        //             data: [{ $skip: skip }, { $limit: limitNumber }], // Apply pagination
        //         },
        //     },
        // ];
        const aggregateLogic = [
            {
                $match: {
                    employeeId: req.params.employeeId,
                },
            },
            {
                $lookup: {
                    from: "employees",
                    localField: "employeeId",
                    foreignField: "employeeId",
                    as: "employeeInfo",
                },
            },
            {
                $unwind: {
                    path: "$employeeInfo",
                    preserveNullAndEmptyArrays: false,
                },
            },
            {
                $addFields: {
                    statusPriority: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$status", "Pending"] }, then: 1 },
                                { case: { $eq: ["$status", "Approved"] }, then: 2 },
                                { case: { $eq: ["$status", "Rejected"] }, then: 3 },
                            ],
                            default: 4,
                        },
                    },
                    leaveStartDateConverted: {
                        $dateFromString: {
                            dateString: "$leaveStartDate",
                            format: "%Y-%m-%d",
                        },
                    },
                },
            },
            {
                $sort: { statusPriority: 1, leaveStartDateConverted: -1 },
            },
            {
                $replaceRoot: {
                    newRoot: {
                        $mergeObjects: [
                            { _id: "$_id" },
                            "$$ROOT",
                            {
                                employeeInfo: {
                                    employeeName: "$employeeInfo.employeeName",
                                    employeeCode: "$employeeInfo.employeeCode",
                                    gender: "$employeeInfo.gender",
                                    departmentId: "$employeeInfo.departmentId",
                                    designation: "$employeeInfo.designation",
                                    doj: "$employeeInfo.doj",
                                    employmentType: "$employeeInfo.employmentType",
                                    employeeStatus: "$employeeInfo.employeeStatus",
                                    accountStatus: "$employeeInfo.accountStatus",
                                    residentialAddress: "$employeeInfo.residentialAddress",
                                    permanentAddress: "$employeeInfo.permanentAddress",
                                    contactNo: "$employeeInfo.contactNo",
                                    email: "$employeeInfo.email",
                                    dob: "$employeeInfo.dob",
                                    bloodGroup: "$employeeInfo.bloodGroup",
                                    workPlace: "$employeeInfo.workPlace",
                                    emergencyContact: "$employeeInfo.emergencyContact",
                                    managerId: "$employeeInfo.managerId",
                                    leaveBalance: "$employeeInfo.leaveBalance",
                                    role: "$employeeInfo.role",
                                },
                            },
                        ],
                    },
                },
            },
            {
                $project: {
                    employeeInfo: 1,
                    leaveType: 1,
                    leaveStartDate: 1,
                    leaveEndDate: 1,
                    totalDays: 1,
                    reason: 1,
                    status: 1,
                    approvedBy: 1,
                    approvedDateTime: 1,
                    dateTime: 1,
                    location: 1,
                    remarks: 1,
                    revertLeave: 1
                    // No need to explicitly exclude leaveStartDateConverted
                },
            },
            {
                $facet: {
                    metadata: [{ $count: "totalRecords" }],
                    data: [{ $skip: skip }, { $limit: limitNumber }],
                },
            },
        ];

        const aggResult = await leaveTakenHistoryModel.aggregate(aggregateLogic);
        const totalRecords = aggResult[0]?.metadata[0]?.totalRecords || 0;
        const totalPages = Math.ceil(totalRecords / limitNumber);

        if (totalRecords > 0) {
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Data fetched successfully.",
                data: aggResult[0]?.data,
                totalRecords,
                totalPages,
                currentPage: pageNumber,
                limit: limitNumber
            });
        }

        return res.status(400).json({
            statusCode: 400,
            statusValue: "FAIL",
            message: "No data found.",
            data: []
        });

    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Internal server error.",
            error: error.message,
        });
    }
};

const getAllLeaves = async (req, res) => {
    try {
        // Extract the token from the Authorization header
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Token is required",
            });
        }

        // Decode the token to get employee details
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Invalid token",
            });
        }

        const getUser = await employeeModel.findOne({ employeeId: decoded.employeeId })
        // Extract pagination parameters
        const pageNumber = parseInt(req.query.page, 10) || 1; // Default page is 1
        const limitNumber = parseInt(req.query.limit, 10) || 10; // Default limit is 10
        const skip = (pageNumber - 1) * limitNumber;

        const aggregateLogic = [
            {
                $match: {
                    employeeId: getUser.employeeId,
                },
            },
            {
                $lookup: {
                    from: "employees",
                    localField: "employeeId",
                    foreignField: "employeeId",
                    as: "employeeInfo",
                },
            },
            {
                $unwind: {
                    path: "$employeeInfo",
                    preserveNullAndEmptyArrays: false, // Ensures no documents with empty employeeInfo are returned
                },
            },
            {
                $addFields: {
                    statusPriority: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$status", "Pending"] }, then: 1 },
                                { case: { $eq: ["$status", "Approved"] }, then: 2 },
                                { case: { $eq: ["$status", "Rejected"] }, then: 3 },
                            ],
                            default: 4, // Fallback priority for unexpected statuses
                        },
                    },
                },
            },
            {
                $sort: { statusPriority: 1, updatedAt: -1 },
            },
            {
                $replaceRoot: {
                    newRoot: {
                        $mergeObjects: [
                            "$$ROOT",
                            {
                                employeeInfo: {
                                    employeeName: "$employeeInfo.employeeName",
                                    employeeCode: "$employeeInfo.employeeCode",
                                    gender: "$employeeInfo.gender",
                                    departmentId: "$employeeInfo.departmentId",
                                    designation: "$employeeInfo.designation",
                                    doj: "$employeeInfo.doj",
                                    employmentType: "$employeeInfo.employmentType",
                                    employeeStatus: "$employeeInfo.employeeStatus",
                                    accountStatus: "$employeeInfo.accountStatus",
                                    residentialAddress: "$employeeInfo.residentialAddress",
                                    permanentAddress: "$employeeInfo.permanentAddress",
                                    contactNo: "$employeeInfo.contactNo",
                                    email: "$employeeInfo.email",
                                    dob: "$employeeInfo.dob",
                                    bloodGroup: "$employeeInfo.bloodGroup",
                                    workPlace: "$employeeInfo.workPlace",
                                    emergencyContact: "$employeeInfo.emergencyContact",
                                    managerId: "$employeeInfo.managerId",
                                    leaveBalance: "$employeeInfo.leaveBalance",
                                    role: "$employeeInfo.role",
                                },
                            },
                        ],
                    },
                },
            },
            {
                $project: {
                    employeeInfo: 1,
                    leaveType: 1,
                    leaveStartDate: 1,
                    leaveEndDate: 1,
                    totalDays: 1,
                    reason: 1,
                    status: 1,
                    approvedBy: 1,
                    approvedDateTime: 1,
                    dateTime: 1,
                    location: 1,
                    remarks: 1,
                    createdAt: 1,
                    updatedAt: 1
                },
            },
            {
                $facet: {
                    metadata: [{ $count: "totalRecords" }],
                    data: [{ $skip: skip }, { $limit: limitNumber }], // Apply pagination
                },
            },
        ];

        const aggResult = await leaveTakenHistoryModel.aggregate(aggregateLogic);

        // console.log('check', aggResult[0]?.metadata)

        const totalRecords = aggResult[0]?.metadata[0]?.totalRecords || 0;
        const totalPages = Math.ceil(totalRecords / limitNumber);

        if (totalRecords > 0) {
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Data fetched successfully.",
                data: aggResult[0].data,
                totalRecords,
                totalPages,
                currentPage: pageNumber,
                limit: limitNumber
            });
        }

        return res.status(404).json({
            statusCode: 404,
            statusValue: "FAIL",
            message: "No data found.",
            data: []
        });

    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Internal server error.",
            error: error.message,
        });
    }
};


const getAllVendorMeetingLogs = async (req, res) => {
    try {
        // Extract the token from the Authorization header
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Token is required",
            });
        }

        // Decode the token to get employee details
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Invalid token",
            });
        }

        // Extract pagination parameters
        var search = "";
        if (req.query.search && req.query.search !== "undefined") {
            search = req.query.search;
        }
        const pageNumber = parseInt(req.query.page, 10) || 1; // Default page is 1
        const limitNumber = parseInt(req.query.limit, 10) || 20; // Default limit is 20
        const skip = (pageNumber - 1) * limitNumber;

        // console.log(decoded)
        const getUser = await employeeModel.findOne({ employeeId: decoded.employeeId })
        // console.log(getUser)

        let searchCondition = {};
        if (search) {
            searchCondition = {
                $or: [
                    { "employeeInfo.employeeCode": { $regex: search.split("").join(".*"), $options: "i" } }, // Character search
                    { "employeeInfo.employeeName": { $regex: search.split("").join(".*"), $options: "i" } },  // Character search
                    { "employeeInfo.email": { $regex: search.split("").join(".*"), $options: "i" } },           // Character search
                    { "status": { $regex: search.split("").join(".*"), $options: "i" } }
                ]
            };
        }

        let aggregateLogic;
        if (getUser.role == "Manager") {
            // console.log(true)
            aggregateLogic = [
                {
                    $match: {
                        approvedBy: getUser.employeeId,
                        leaveType: "vendor-meeting"
                    },
                },
                {
                    $lookup: {
                        from: "employees",
                        localField: "employeeId",
                        foreignField: "employeeId",
                        as: "employeeInfo",
                    },
                },
                {
                    $unwind: {
                        path: "$employeeInfo",
                        preserveNullAndEmptyArrays: false, // Ensures no documents with empty employeeInfo are returned
                    },
                },
                {
                    $match: searchCondition, // Apply character search filter
                },
                {
                    $addFields: {
                        statusPriority: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$status", "Pending"] }, then: 1 },
                                    // { case: { $eq: ["$status", "Approved"] }, then: 2 },
                                    // { case: { $eq: ["$status", "Rejected"] }, then: 3 },
                                ],
                                default: 4, // Fallback priority for unexpected statuses
                            },
                        },
                    },
                },
                {
                    $sort: { statusPriority: 1, updatedAt: -1 },
                },
                {
                    $replaceRoot: {
                        newRoot: {
                            $mergeObjects: [
                                { _id: "$_id" },  // Ensure original _id is explicitly retained
                                "$$ROOT",
                                {
                                    employeeInfo: {
                                        employeeName: "$employeeInfo.employeeName",
                                        employeeCode: "$employeeInfo.employeeCode",
                                        employeeId: "$employeeInfo.employeeId",
                                        gender: "$employeeInfo.gender",
                                        // departmentId: "$employeeInfo.departmentId",
                                        // designation: "$employeeInfo.designation",
                                        // doj: "$employeeInfo.doj",
                                        // employmentType: "$employeeInfo.employmentType",
                                        // employeeStatus: "$employeeInfo.employeeStatus",
                                        // accountStatus: "$employeeInfo.accountStatus",
                                        // residentialAddress: "$employeeInfo.residentialAddress",
                                        // permanentAddress: "$employeeInfo.permanentAddress",
                                        contactNo: "$employeeInfo.contactNo",
                                        email: "$employeeInfo.email",
                                        // dob: "$employeeInfo.dob",
                                        // bloodGroup: "$employeeInfo.bloodGroup",
                                        // workPlace: "$employeeInfo.workPlace",
                                        // emergencyContact: "$employeeInfo.emergencyContact",
                                        // managerId: "$employeeInfo.managerId",
                                        // leaveBalance: "$employeeInfo.leaveBalance",
                                        // role: "$employeeInfo.role",
                                    },
                                },
                            ],
                        },
                    },
                },
                {
                    $project: {
                        _id: 1,
                        employeeInfo: 1,
                        leaveType: 1,
                        leaveStartDate: 1,
                        leaveEndDate: 1,
                        totalDays: 1,
                        reason: 1,
                        status: 1,
                        approvedBy: 1,
                        approvedDateTime: 1,
                        dateTime: 1,
                        location: 1,
                        remarks: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        revertLeave: 1
                    },
                },
                {
                    $facet: {
                        metadata: [{ $count: "totalRecords" }],
                        data: [{ $skip: skip }, { $limit: limitNumber }], // Apply pagination
                    },
                },
            ];

        } else if (getUser.role == "HR-Admin" || getUser.role == "Admin") {
            aggregateLogic = [
                {
                  $match: {
                    // approvedBy: getUser.employeeId,
                    leaveType: "vendor-meeting"
                  },
                },
                {
                    $lookup: {
                        from: "employees",
                        localField: "employeeId",
                        foreignField: "employeeId",
                        as: "employeeInfo",
                    },
                },
                {
                    $unwind: {
                        path: "$employeeInfo",
                        preserveNullAndEmptyArrays: false, // Ensures no documents with empty employeeInfo are returned
                    },
                },
                {
                    $match: searchCondition, // Apply character search filter
                },
                {
                    $addFields: {
                        statusPriority: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$status", "Pending"] }, then: 1 },
                                    { case: { $eq: ["$status", "Approved"] }, then: 2 },
                                    { case: { $eq: ["$status", "Rejected"] }, then: 3 },
                                ],
                                default: 4, // Fallback priority for unexpected statuses
                            },
                        },
                    },
                },
                {
                    $sort: { statusPriority: 1, createdAt: -1 },
                },
                {
                    $replaceRoot: {
                        newRoot: {
                            $mergeObjects: [
                                { _id: "$_id" },  // Ensure original _id is retained
                                "$$ROOT",
                                {
                                    employeeInfo: {
                                        employeeName: "$employeeInfo.employeeName",
                                        employeeCode: "$employeeInfo.employeeCode",
                                        employeeId: "$employeeInfo.employeeId",
                                        gender: "$employeeInfo.gender",
                                        // departmentId: "$employeeInfo.departmentId",
                                        // designation: "$employeeInfo.designation",
                                        // doj: "$employeeInfo.doj",
                                        // employmentType: "$employeeInfo.employmentType",
                                        // employeeStatus: "$employeeInfo.employeeStatus",
                                        // accountStatus: "$employeeInfo.accountStatus",
                                        // residentialAddress: "$employeeInfo.residentialAddress",
                                        // permanentAddress: "$employeeInfo.permanentAddress",
                                        contactNo: "$employeeInfo.contactNo",
                                        email: "$employeeInfo.email",
                                        // dob: "$employeeInfo.dob",
                                        // bloodGroup: "$employeeInfo.bloodGroup",
                                        // workPlace: "$employeeInfo.workPlace",
                                        // emergencyContact: "$employeeInfo.emergencyContact",
                                        // managerId: "$employeeInfo.managerId",
                                        // leaveBalance: "$employeeInfo.leaveBalance",
                                        // role: "$employeeInfo.role",
                                    },
                                },
                            ],
                        },
                    },
                },
                {
                    $project: {
                        employeeInfo: 1,
                        leaveType: 1,
                        leaveStartDate: 1,
                        leaveEndDate: 1,
                        totalDays: 1,
                        reason: 1,
                        status: 1,
                        approvedBy: 1,
                        approvedDateTime: 1,
                        dateTime: 1,
                        location: 1,
                        remarks: 1,
                        updatedAt: 1,
                        createdAt: 1,
                        revertLeave: 1
                    },
                },
                {
                    $facet: {
                        metadata: [{ $count: "totalRecords" }],
                        data: [{ $skip: skip }, { $limit: limitNumber }], // Apply pagination
                    },
                },
            ];

        } else if (getUser.role == "Super-Admin") {
            aggregateLogic = [
                {
                    $match: {
                        approvedBy: getUser.employeeId,
                        leaveType: "vendor-meeting" 
                    },
                },
                {
                    $lookup: {
                        from: "employees",
                        localField: "employeeId",
                        foreignField: "employeeId",
                        as: "employeeInfo",
                    },
                },
                {
                    $unwind: {
                        path: "$employeeInfo",
                        preserveNullAndEmptyArrays: false, // Ensures no documents with empty employeeInfo are returned
                    },
                },
                {
                    $match: searchCondition, // Apply character search filter
                },
                {
                    $addFields: {
                        statusPriority: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$status", "Pending"] }, then: 1 },
                                    { case: { $eq: ["$status", "Approved"] }, then: 2 },
                                    { case: { $eq: ["$status", "Rejected"] }, then: 3 },
                                ],
                                default: 4, // Fallback priority for unexpected statuses
                            },
                        },
                    },
                },
                {
                    $sort: { statusPriority: 1, createdAt: -1 },
                },
                {
                    $replaceRoot: {
                        newRoot: {
                            $mergeObjects: [
                                { _id: "$_id" },  // Ensure original _id is retained
                                "$$ROOT",
                                {
                                    employeeInfo: {
                                        employeeName: "$employeeInfo.employeeName",
                                        employeeCode: "$employeeInfo.employeeCode",
                                        employeeId: "$employeeInfo.employeeId",
                                        gender: "$employeeInfo.gender",
                                        // departmentId: "$employeeInfo.departmentId",
                                        // designation: "$employeeInfo.designation",
                                        // doj: "$employeeInfo.doj",
                                        // employmentType: "$employeeInfo.employmentType",
                                        // employeeStatus: "$employeeInfo.employeeStatus",
                                        // accountStatus: "$employeeInfo.accountStatus",
                                        // residentialAddress: "$employeeInfo.residentialAddress",
                                        // permanentAddress: "$employeeInfo.permanentAddress",
                                        contactNo: "$employeeInfo.contactNo",
                                        email: "$employeeInfo.email",
                                        // dob: "$employeeInfo.dob",
                                        // bloodGroup: "$employeeInfo.bloodGroup",
                                        // workPlace: "$employeeInfo.workPlace",
                                        // emergencyContact: "$employeeInfo.emergencyContact",
                                        // managerId: "$employeeInfo.managerId",
                                        // leaveBalance: "$employeeInfo.leaveBalance",
                                        // role: "$employeeInfo.role",
                                    },
                                },
                            ],
                        },
                    },
                },
                {
                    $project: {
                        employeeInfo: 1,
                        leaveType: 1,
                        leaveStartDate: 1,
                        leaveEndDate: 1,
                        totalDays: 1,
                        reason: 1,
                        status: 1,
                        approvedBy: 1,
                        approvedDateTime: 1,
                        dateTime: 1,
                        location: 1,
                        remarks: 1,
                        updatedAt: 1,
                        createdAt: 1,
                        revertLeave: 1
                    },
                },
                {
                    $facet: {
                        metadata: [{ $count: "totalRecords" }],
                        data: [{ $skip: skip }, { $limit: limitNumber }], // Apply pagination
                    },
                },
            ];
        }

        const aggResult = await leaveTakenHistoryModel.aggregate(aggregateLogic);
        // console.log('check', aggResult[0]?.metadata)

        const totalRecords = aggResult[0]?.metadata[0]?.totalRecords || 0;
        const totalPages = Math.ceil(totalRecords / limitNumber);


        if (totalRecords > 0) {
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Data fetched successfully.",
                data: aggResult[0].data,
                totalRecords,
                totalPages,
                currentPage: pageNumber,
                limit: limitNumber
            });
        }

        return res.status(404).json({
            statusCode: 404,
            statusValue: "FAIL",
            message: "No data found.",
            data: []
        });

    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Internal server error.",
            error: error.message,
        });
    }
};


const getVendorMeetingByUserId = async (req, res) => {
    try {
        // Extract the token from the Authorization header
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Token is required",
            });
        }

        // Decode the token to get employee details
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Invalid token",
            });
        }

        // Extract pagination parameters
        var search = "";
        if (req.query.search && req.query.search !== "undefined") {
            search = req.query.search;
        }
        const pageNumber = parseInt(req.query.page, 10) || 1; // Default page is 1
        const limitNumber = parseInt(req.query.limit, 10) || 20; // Default limit is 20
        const skip = (pageNumber - 1) * limitNumber;

        // console.log(decoded)
        const getUser = await employeeModel.findOne({ employeeId: decoded.employeeId })
        // console.log(getUser)

        let searchCondition = {};
        if (search) {
            searchCondition = {
                $or: [
                    { "employeeInfo.employeeCode": { $regex: search.split("").join(".*"), $options: "i" } }, // Character search
                    { "employeeInfo.employeeName": { $regex: search.split("").join(".*"), $options: "i" } },  // Character search
                    { "employeeInfo.email": { $regex: search.split("").join(".*"), $options: "i" } },           // Character search
                    { "status": { $regex: search.split("").join(".*"), $options: "i" } }
                ]
            };
        }

        let aggregateLogic = [
                {
                    $match: {
                        employeeId: getUser.employeeId,
                        leaveType: "vendor-meeting"
                    },
                },
                {
                    $lookup: {
                        from: "employees",
                        localField: "employeeId",
                        foreignField: "employeeId",
                        as: "employeeInfo",
                    },
                },
                {
                    $unwind: {
                        path: "$employeeInfo",
                        preserveNullAndEmptyArrays: false, // Ensures no documents with empty employeeInfo are returned
                    },
                },
                {
                    $match: searchCondition, // Apply character search filter
                },
                {
                    $addFields: {
                        statusPriority: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$status", "Pending"] }, then: 1 },
                                    // { case: { $eq: ["$status", "Approved"] }, then: 2 },
                                    // { case: { $eq: ["$status", "Rejected"] }, then: 3 },
                                ],
                                default: 4, // Fallback priority for unexpected statuses
                            },
                        },
                    },
                },
                {
                    $sort: { statusPriority: 1, updatedAt: -1 },
                },
                {
                    $replaceRoot: {
                        newRoot: {
                            $mergeObjects: [
                                { _id: "$_id" },  // Ensure original _id is explicitly retained
                                "$$ROOT",
                                {
                                    employeeInfo: {
                                        employeeName: "$employeeInfo.employeeName",
                                        employeeCode: "$employeeInfo.employeeCode",
                                        employeeId: "$employeeInfo.employeeId",
                                        gender: "$employeeInfo.gender",
                                        // departmentId: "$employeeInfo.departmentId",
                                        // designation: "$employeeInfo.designation",
                                        // doj: "$employeeInfo.doj",
                                        // employmentType: "$employeeInfo.employmentType",
                                        // employeeStatus: "$employeeInfo.employeeStatus",
                                        // accountStatus: "$employeeInfo.accountStatus",
                                        // residentialAddress: "$employeeInfo.residentialAddress",
                                        // permanentAddress: "$employeeInfo.permanentAddress",
                                        contactNo: "$employeeInfo.contactNo",
                                        email: "$employeeInfo.email",
                                        // dob: "$employeeInfo.dob",
                                        // bloodGroup: "$employeeInfo.bloodGroup",
                                        // workPlace: "$employeeInfo.workPlace",
                                        // emergencyContact: "$employeeInfo.emergencyContact",
                                        // managerId: "$employeeInfo.managerId",
                                        // leaveBalance: "$employeeInfo.leaveBalance",
                                        // role: "$employeeInfo.role",
                                    },
                                },
                            ],
                        },
                    },
                },
                {
                    $project: {
                        _id: 1,
                        employeeInfo: 1,
                        leaveType: 1,
                        leaveStartDate: 1,
                        leaveEndDate: 1,
                        totalDays: 1,
                        reason: 1,
                        status: 1,
                        approvedBy: 1,
                        approvedDateTime: 1,
                        dateTime: 1,
                        location: 1,
                        remarks: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        revertLeave: 1
                    },
                },
                {
                    $facet: {
                        metadata: [{ $count: "totalRecords" }],
                        data: [{ $skip: skip }, { $limit: limitNumber }], // Apply pagination
                    },
                },
            ];

        const aggResult = await leaveTakenHistoryModel.aggregate(aggregateLogic);
        // console.log('check', aggResult[0]?.metadata)

        const totalRecords = aggResult[0]?.metadata[0]?.totalRecords || 0;
        const totalPages = Math.ceil(totalRecords / limitNumber);


        if (totalRecords > 0) {
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Data fetched successfully.",
                data: aggResult[0].data,
                totalRecords,
                totalPages,
                currentPage: pageNumber,
                limit: limitNumber
            });
        }

        return res.status(404).json({
            statusCode: 404,
            statusValue: "FAIL",
            message: "No data found.",
            data: []
        });

    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Internal server error.",
            error: error.message,
        });
    }
};



const getAllPendingLeaves = async (req, res) => {
    try {
        // Extract the token from the Authorization header
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Token is required",
            });
        }

        // Decode the token to get employee details
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Invalid token",
            });
        }

        // Extract pagination parameters
        var search = "";
        if (req.query.search && req.query.search !== "undefined") {
            search = req.query.search;
        }
        const pageNumber = parseInt(req.query.page, 10) || 1; // Default page is 1
        const limitNumber = parseInt(req.query.limit, 10) || 10; // Default limit is 20
        const skip = (pageNumber - 1) * limitNumber;

        // console.log(decoded)
        const getUser = await employeeModel.findOne({ employeeId: decoded.employeeId })
        // console.log(getUser)

        let searchCondition = {};
        if (search) {
            searchCondition = {
                $or: [
                    { "employeeInfo.employeeCode": { $regex: search.split("").join(".*"), $options: "i" } }, // Character search
                    { "employeeInfo.employeeName": { $regex: search.split("").join(".*"), $options: "i" } },  // Character search
                    { "employeeInfo.email": { $regex: search.split("").join(".*"), $options: "i" } },           // Character search
                    { "status": { $regex: search.split("").join(".*"), $options: "i" } }
                ]
            };
        }

        let aggregateLogic;
        if (getUser.role == "Manager") {
            // console.log(true)
            aggregateLogic = [
                {
                    $match: {
                        approvedBy: getUser.employeeId,
                        leaveType: { $ne: "vendor-meeting" }
                    },
                },
                {
                    $lookup: {
                        from: "employees",
                        localField: "employeeId",
                        foreignField: "employeeId",
                        as: "employeeInfo",
                    },
                },
                {
                    $unwind: {
                        path: "$employeeInfo",
                        preserveNullAndEmptyArrays: false, // Ensures no documents with empty employeeInfo are returned
                    },
                },
                {
                    $match: searchCondition, // Apply character search filter
                },
                {
                    $addFields: {
                        statusPriority: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$status", "Pending"] }, then: 1 },
                                    // { case: { $eq: ["$status", "Approved"] }, then: 2 },
                                    // { case: { $eq: ["$status", "Rejected"] }, then: 3 },
                                ],
                                default: 4, // Fallback priority for unexpected statuses
                            },
                        },
                    },
                },
                {
                    $sort: { statusPriority: 1, updatedAt: -1 },
                },
                {
                    $replaceRoot: {
                        newRoot: {
                            $mergeObjects: [
                                { _id: "$_id" },  // Ensure original _id is explicitly retained
                                "$$ROOT",
                                {
                                    employeeInfo: {
                                        employeeName: "$employeeInfo.employeeName",
                                        employeeCode: "$employeeInfo.employeeCode",
                                        employeeId: "$employeeInfo.employeeId",
                                        gender: "$employeeInfo.gender",
                                        departmentId: "$employeeInfo.departmentId",
                                        designation: "$employeeInfo.designation",
                                        doj: "$employeeInfo.doj",
                                        employmentType: "$employeeInfo.employmentType",
                                        employeeStatus: "$employeeInfo.employeeStatus",
                                        accountStatus: "$employeeInfo.accountStatus",
                                        residentialAddress: "$employeeInfo.residentialAddress",
                                        permanentAddress: "$employeeInfo.permanentAddress",
                                        contactNo: "$employeeInfo.contactNo",
                                        email: "$employeeInfo.email",
                                        dob: "$employeeInfo.dob",
                                        bloodGroup: "$employeeInfo.bloodGroup",
                                        workPlace: "$employeeInfo.workPlace",
                                        emergencyContact: "$employeeInfo.emergencyContact",
                                        managerId: "$employeeInfo.managerId",
                                        leaveBalance: "$employeeInfo.leaveBalance",
                                        role: "$employeeInfo.role",
                                    },
                                },
                            ],
                        },
                    },
                },
                {
                    $project: {
                        _id: 1,
                        employeeInfo: 1,
                        leaveType: 1,
                        leaveStartDate: 1,
                        leaveEndDate: 1,
                        totalDays: 1,
                        reason: 1,
                        status: 1,
                        approvedBy: 1,
                        approvedDateTime: 1,
                        dateTime: 1,
                        location: 1,
                        remarks: 1,
                        createdAt: 1,
                        updatedAt: 1,
                        revertLeave: 1
                    },
                },
                {
                    $facet: {
                        metadata: [{ $count: "totalRecords" }],
                        data: [{ $skip: skip }, { $limit: limitNumber }], // Apply pagination
                    },
                },
            ];

        } else if (getUser.role == "HR-Admin" || getUser.role == "Admin") {
            aggregateLogic = [
                {
                  $match: {
                    // approvedBy: getUser.employeeId,
                    leaveType: { $ne: "vendor-meeting" }
                  },
                },
                {
                    $lookup: {
                        from: "employees",
                        localField: "employeeId",
                        foreignField: "employeeId",
                        as: "employeeInfo",
                    },
                },
                {
                    $unwind: {
                        path: "$employeeInfo",
                        preserveNullAndEmptyArrays: false, // Ensures no documents with empty employeeInfo are returned
                    },
                },
                {
                    $match: searchCondition, // Apply character search filter
                },
                {
                    $addFields: {
                        statusPriority: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$status", "Pending"] }, then: 1 },
                                    // { case: { $eq: ["$status", "Approved"] }, then: 2 },
                                    // { case: { $eq: ["$status", "Rejected"] }, then: 3 },
                                ],
                                default: 4, // Fallback priority for unexpected statuses
                            },
                        },
                    },
                },
                {
                    $sort: { statusPriority: 1, createdAt: -1 },
                },
                {
                    $replaceRoot: {
                        newRoot: {
                            $mergeObjects: [
                                { _id: "$_id" },  // Ensure original _id is retained
                                "$$ROOT",
                                {
                                    employeeInfo: {
                                        employeeName: "$employeeInfo.employeeName",
                                        employeeCode: "$employeeInfo.employeeCode",
                                        employeeId: "$employeeInfo.employeeId",
                                        gender: "$employeeInfo.gender",
                                        departmentId: "$employeeInfo.departmentId",
                                        designation: "$employeeInfo.designation",
                                        doj: "$employeeInfo.doj",
                                        employmentType: "$employeeInfo.employmentType",
                                        employeeStatus: "$employeeInfo.employeeStatus",
                                        accountStatus: "$employeeInfo.accountStatus",
                                        residentialAddress: "$employeeInfo.residentialAddress",
                                        permanentAddress: "$employeeInfo.permanentAddress",
                                        contactNo: "$employeeInfo.contactNo",
                                        email: "$employeeInfo.email",
                                        dob: "$employeeInfo.dob",
                                        bloodGroup: "$employeeInfo.bloodGroup",
                                        workPlace: "$employeeInfo.workPlace",
                                        emergencyContact: "$employeeInfo.emergencyContact",
                                        managerId: "$employeeInfo.managerId",
                                        leaveBalance: "$employeeInfo.leaveBalance",
                                        role: "$employeeInfo.role",
                                    },
                                },
                            ],
                        },
                    },
                },
                {
                    $project: {
                        employeeInfo: 1,
                        leaveType: 1,
                        leaveStartDate: 1,
                        leaveEndDate: 1,
                        totalDays: 1,
                        reason: 1,
                        status: 1,
                        approvedBy: 1,
                        approvedDateTime: 1,
                        dateTime: 1,
                        location: 1,
                        remarks: 1,
                        updatedAt: 1,
                        createdAt: 1,
                        revertLeave: 1
                    },
                },
                {
                    $facet: {
                        metadata: [{ $count: "totalRecords" }],
                        data: [{ $skip: skip }, { $limit: limitNumber }], // Apply pagination
                    },
                },
            ];

        } else if (getUser.role == "Super-Admin") {
            aggregateLogic = [
                {
                    $match: {
                        approvedBy: getUser.employeeId,
                        leaveType: { $ne: "vendor-meeting" }
                    },
                },
                {
                    $lookup: {
                        from: "employees",
                        localField: "employeeId",
                        foreignField: "employeeId",
                        as: "employeeInfo",
                    },
                },
                {
                    $unwind: {
                        path: "$employeeInfo",
                        preserveNullAndEmptyArrays: false, // Ensures no documents with empty employeeInfo are returned
                    },
                },
                {
                    $match: searchCondition, // Apply character search filter
                },
                {
                    $addFields: {
                        statusPriority: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$status", "Pending"] }, then: 1 },
                                    { case: { $eq: ["$status", "Approved"] }, then: 2 },
                                    { case: { $eq: ["$status", "Rejected"] }, then: 3 },
                                ],
                                default: 4, // Fallback priority for unexpected statuses
                            },
                        },
                    },
                },
                {
                    $sort: { statusPriority: 1, createdAt: -1 },
                },
                {
                    $replaceRoot: {
                        newRoot: {
                            $mergeObjects: [
                                { _id: "$_id" },  // Ensure original _id is retained
                                "$$ROOT",
                                {
                                    employeeInfo: {
                                        employeeName: "$employeeInfo.employeeName",
                                        employeeCode: "$employeeInfo.employeeCode",
                                        employeeId: "$employeeInfo.employeeId",
                                        gender: "$employeeInfo.gender",
                                        departmentId: "$employeeInfo.departmentId",
                                        designation: "$employeeInfo.designation",
                                        doj: "$employeeInfo.doj",
                                        employmentType: "$employeeInfo.employmentType",
                                        employeeStatus: "$employeeInfo.employeeStatus",
                                        accountStatus: "$employeeInfo.accountStatus",
                                        residentialAddress: "$employeeInfo.residentialAddress",
                                        permanentAddress: "$employeeInfo.permanentAddress",
                                        contactNo: "$employeeInfo.contactNo",
                                        email: "$employeeInfo.email",
                                        dob: "$employeeInfo.dob",
                                        bloodGroup: "$employeeInfo.bloodGroup",
                                        workPlace: "$employeeInfo.workPlace",
                                        emergencyContact: "$employeeInfo.emergencyContact",
                                        managerId: "$employeeInfo.managerId",
                                        leaveBalance: "$employeeInfo.leaveBalance",
                                        role: "$employeeInfo.role",
                                    },
                                },
                            ],
                        },
                    },
                },
                {
                    $project: {
                        employeeInfo: 1,
                        leaveType: 1,
                        leaveStartDate: 1,
                        leaveEndDate: 1,
                        totalDays: 1,
                        reason: 1,
                        status: 1,
                        approvedBy: 1,
                        approvedDateTime: 1,
                        dateTime: 1,
                        location: 1,
                        remarks: 1,
                        updatedAt: 1,
                        createdAt: 1,
                        revertLeave: 1
                    },
                },
                {
                    $facet: {
                        metadata: [{ $count: "totalRecords" }],
                        data: [{ $skip: skip }, { $limit: limitNumber }], // Apply pagination
                    },
                },
            ];
        }

        const aggResult = await leaveTakenHistoryModel.aggregate(aggregateLogic);
        // console.log('check', aggResult[0]?.metadata)

        const totalRecords = aggResult[0]?.metadata[0]?.totalRecords || 0;
        const totalPages = Math.ceil(totalRecords / limitNumber);


        if (totalRecords > 0) {
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Data fetched successfully.",
                data: aggResult[0].data,
                totalRecords,
                totalPages,
                currentPage: pageNumber,
                limit: limitNumber
            });
        }

        return res.status(404).json({
            statusCode: 404,
            statusValue: "FAIL",
            message: "No data found.",
            data: []
        });

    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Internal server error.",
            error: error.message,
        });
    }
};


const getAllPendingCompoff = async (req, res) => {
    try {
        // Extract the token from the Authorization header
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Token is required",
            });
        }

        // Decode the token to get employee details
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Invalid token",
            });
        }

        // Extract pagination parameters
        const pageNumber = parseInt(req.query.page, 10) || 1; // Default page is 1
        const limitNumber = parseInt(req.query.limit, 10) || 20; // Default limit is 10
        const skip = (pageNumber - 1) * limitNumber;

        // console.log(decoded)
        const getUser = await employeeModel.findOne({ employeeId: decoded.employeeId })
        // console.log('check-user', decoded)
        // check Role
        let aggregateLogic;
        if (getUser.role == "Manager" || getUser.role == "Super-Admin") {
            aggregateLogic = [
                {
                    $match: {
                        approvedBy: getUser.employeeId,
                        // leaveType: {$ne:"vendor-meeting"}
                    },
                },
                {
                    $lookup: {
                        from: "employees",
                        localField: "employeeId",
                        foreignField: "employeeId",
                        as: "employeeInfo",
                    },
                },
                {
                    $unwind: {
                        path: "$employeeInfo",
                        preserveNullAndEmptyArrays: false, // Ensures no documents with empty employeeInfo are returned
                    },
                },
                {
                    $addFields: {
                        statusPriority: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$status", "Pending"] }, then: 1 },
                                    { case: { $eq: ["$status", "Approved"] }, then: 2 },
                                    { case: { $eq: ["$status", "Rejected"] }, then: 3 },
                                ],
                                default: 4, // Fallback priority for unexpected statuses
                            },
                        },
                    },
                },
                {
                    $sort: { statusPriority: 1, updatedAt: -1 },
                },
                {
                    $replaceRoot: {
                        newRoot: {
                            $mergeObjects: [
                                "$$ROOT",
                                {
                                    employeeInfo: {
                                        employeeName: "$employeeInfo.employeeName",
                                        employeeCode: "$employeeInfo.employeeCode",
                                        gender: "$employeeInfo.gender",
                                        departmentId: "$employeeInfo.departmentId",
                                        designation: "$employeeInfo.designation",
                                        doj: "$employeeInfo.doj",
                                        employmentType: "$employeeInfo.employmentType",
                                        employeeStatus: "$employeeInfo.employeeStatus",
                                        contactNo: "$employeeInfo.contactNo",
                                        email: "$employeeInfo.email",
                                        managerId: "$employeeInfo.managerId",
                                        leaveBalance: "$employeeInfo.leaveBalance",
                                        role: "$employeeInfo.role",
                                    },
                                },
                            ],
                        },
                    },
                },
                {
                    $project: {
                        employeeInfo: 1,
                        appliedDate: 1,
                        compOffDate: 1,
                        reason: 1,
                        status: 1,
                        comments: 1,
                        totalDays: 1,
                        createdAt: 1,
                        updatedAt: 1
                    },
                },
                {
                    $facet: {
                        metadata: [{ $count: "totalRecords" }],
                        data: [{ $skip: skip }, { $limit: limitNumber }], // Apply pagination
                    },
                },
            ];

        } else if (getUser.role == "HR-Admin" || getUser.role == "Admin") {
            aggregateLogic = [
                // {
                //   $match: {
                //     // approvedBy: getUser.employeeId,
                //     leaveType: {$ne:"vendor-meeting"}
                //   },
                // },
                {
                    $lookup: {
                        from: "employees",
                        localField: "employeeId",
                        foreignField: "employeeId",
                        as: "employeeInfo",
                    },
                },
                {
                    $unwind: {
                        path: "$employeeInfo",
                        preserveNullAndEmptyArrays: false, // Ensures no documents with empty employeeInfo are returned
                    },
                },
                {
                    $addFields: {
                        statusPriority: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$status", "Pending"] }, then: 1 },
                                    { case: { $eq: ["$status", "Approved"] }, then: 2 },
                                    { case: { $eq: ["$status", "Rejected"] }, then: 3 },
                                ],
                                default: 4, // Fallback priority for unexpected statuses
                            },
                        },
                    },
                },
                {
                    $sort: { statusPriority: 1, updatedAt: -1 },
                },
                {
                    $replaceRoot: {
                        newRoot: {
                            $mergeObjects: [
                                "$$ROOT",
                                {
                                    employeeInfo: {
                                        employeeName: "$employeeInfo.employeeName",
                                        employeeCode: "$employeeInfo.employeeCode",
                                        gender: "$employeeInfo.gender",
                                        departmentId: "$employeeInfo.departmentId",
                                        designation: "$employeeInfo.designation",
                                        doj: "$employeeInfo.doj",
                                        employmentType: "$employeeInfo.employmentType",
                                        employeeStatus: "$employeeInfo.employeeStatus",
                                        contactNo: "$employeeInfo.contactNo",
                                        email: "$employeeInfo.email",
                                        managerId: "$employeeInfo.managerId",
                                        leaveBalance: "$employeeInfo.leaveBalance",
                                        role: "$employeeInfo.role",
                                    },
                                },
                            ],
                        },
                    },
                },
                {
                    $project: {
                        employeeInfo: 1,
                        appliedDate: 1,
                        compOffDate: 1,
                        reason: 1,
                        status: 1,
                        comments: 1,
                        totalDays: 1,
                        createdAt: 1,
                        updatedAt: 1
                    },
                },
                {
                    $facet: {
                        metadata: [{ $count: "totalRecords" }],
                        data: [{ $skip: skip }, { $limit: limitNumber }], // Apply pagination
                    },
                },
            ];

        } else if (getUser.role == "Employee") {
            aggregateLogic = [
                {
                    $match: {
                        employeeId: getUser.employeeId,
                         leaveType: {$ne:"vendor-meeting"}
                    },
                },
                {
                    $lookup: {
                        from: "employees",
                        localField: "employeeId",
                        foreignField: "employeeId",
                        as: "employeeInfo",
                    },
                },
                {
                    $unwind: {
                        path: "$employeeInfo",
                        preserveNullAndEmptyArrays: false, // Ensures no documents with empty employeeInfo are returned
                    },
                },
                {
                    $addFields: {
                        statusPriority: {
                            $switch: {
                                branches: [
                                    { case: { $eq: ["$status", "Pending"] }, then: 1 },
                                    { case: { $eq: ["$status", "Approved"] }, then: 2 },
                                    { case: { $eq: ["$status", "Rejected"] }, then: 3 },
                                ],
                                default: 4, // Fallback priority for unexpected statuses
                            },
                        },
                    },
                },
                {
                    $sort: { statusPriority: 1, createdAt: -1 },
                },
                {
                    $replaceRoot: {
                        newRoot: {
                            $mergeObjects: [
                                "$$ROOT",
                                {
                                    employeeInfo: {
                                        employeeName: "$employeeInfo.employeeName",
                                        employeeCode: "$employeeInfo.employeeCode",
                                        gender: "$employeeInfo.gender",
                                        departmentId: "$employeeInfo.departmentId",
                                        designation: "$employeeInfo.designation",
                                        doj: "$employeeInfo.doj",
                                        employmentType: "$employeeInfo.employmentType",
                                        employeeStatus: "$employeeInfo.employeeStatus",
                                        contactNo: "$employeeInfo.contactNo",
                                        email: "$employeeInfo.email",
                                        managerId: "$employeeInfo.managerId",
                                        leaveBalance: "$employeeInfo.leaveBalance",
                                        role: "$employeeInfo.role",
                                    },
                                },
                            ],
                        },
                    },
                },
                {
                    $project: {
                        employeeInfo: 1,
                        appliedDate: 1,
                        compOffDate: 1,
                        reason: 1,
                        status: 1,
                        comments: 1,
                        totalDays: 1,
                        createdAt: 1,
                        updatedAt: 1
                    },
                },
                {
                    $facet: {
                        metadata: [{ $count: "totalRecords" }],
                        data: [{ $skip: skip }, { $limit: limitNumber }], // Apply pagination
                    },
                },
            ];
        }

        const aggResult = await CompOff.aggregate(aggregateLogic);
        // console.log('check', aggResult[0]?.metadata)

        const totalRecords = aggResult[0]?.metadata[0]?.totalRecords || 0;
        const totalPages = Math.ceil(totalRecords / limitNumber);

        if (totalRecords > 0) {
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Data fetched successfully.",
                data: aggResult[0].data,
                totalRecords,
                totalPages,
                currentPage: pageNumber,
                limit: limitNumber
            });
        }

        return res.status(404).json({
            statusCode: 404,
            statusValue: "FAIL",
            message: "No data found.",
            data: []
        });

    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Internal server error.",
            error: error.message,
        });
    }
};


const getOwnCompoffHistory = async (req, res) => {
    try {
        // Extract the token from the Authorization header
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Token is required",
            });
        }

        // Decode the token to get employee details
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Invalid token",
            });
        }

        // Extract pagination parameters
        const pageNumber = parseInt(req.query.page, 10) || 1; // Default page is 1
        const limitNumber = parseInt(req.query.limit, 10) || 10; // Default limit is 10
        const skip = (pageNumber - 1) * limitNumber;

        // console.log(decoded)
        const getUser = await employeeModel.findOne({ employeeId: decoded.employeeId })
        // console.log('check-user', decoded)
        // check Role
        let aggregateLogic;
        aggregateLogic = [
            {
                $match: {
                    employeeId: getUser.employeeId,
                },
            },
            {
                $lookup: {
                    from: "employees",
                    localField: "employeeId",
                    foreignField: "employeeId",
                    as: "employeeInfo",
                },
            },
            {
                $unwind: {
                    path: "$employeeInfo",
                    preserveNullAndEmptyArrays: false,
                },
            },
            {
                $addFields: {
                    statusPriority: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$status", "Pending"] }, then: 1 },
                                { case: { $eq: ["$status", "Approved"] }, then: 2 },
                                { case: { $eq: ["$status", "Rejected"] }, then: 3 },
                            ],
                            default: 4, // Fallback priority for unexpected statuses
                        },
                    },
                },
            },
            {
                $sort: { statusPriority: 1, createdAt: -1 },
            },
            {
                $replaceRoot: {
                    newRoot: {
                        $mergeObjects: [
                            "$$ROOT",
                            {
                                employeeInfo: {
                                    employeeName: "$employeeInfo.employeeName",
                                    employeeCode: "$employeeInfo.employeeCode",
                                    employeeId: "$employeeInfo.employeeId",
                                    gender: "$employeeInfo.gender",
                                    departmentId: "$employeeInfo.departmentId",
                                    designation: "$employeeInfo.designation",
                                    doj: "$employeeInfo.doj",
                                    employmentType: "$employeeInfo.employmentType",
                                    employeeStatus: "$employeeInfo.employeeStatus",
                                    contactNo: "$employeeInfo.contactNo",
                                    email: "$employeeInfo.email",
                                    managerId: "$employeeInfo.managerId",
                                    leaveBalance: "$employeeInfo.leaveBalance",
                                    role: "$employeeInfo.role",
                                },
                            },
                        ],
                    },
                },
            },
            {
                $project: {
                    employeeInfo: 1,
                    appliedDate: 1,
                    compOffDate: 1,
                    reason: 1,
                    status: 1,
                    comments: 1,
                    totalDays: 1,
                },
            },
            {
                $facet: {
                    metadata: [{ $count: "totalRecords" }],
                    data: [{ $skip: skip }, { $limit: limitNumber }], // Apply pagination
                },
            },
        ];

        const aggResult = await CompOff.aggregate(aggregateLogic);
        // console.log('check', aggResult[0]?.metadata)

        const totalRecords = aggResult[0]?.metadata[0]?.totalRecords || 0;
        const totalPages = Math.ceil(totalRecords / limitNumber);

        if (totalRecords > 0) {
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Data fetched successfully.",
                data: aggResult[0].data,
                totalRecords,
                totalPages,
                currentPage: pageNumber,
                limit: limitNumber
            });
        }

        return res.status(404).json({
            statusCode: 404,
            statusValue: "FAIL",
            message: "No data found.",
            data: []
        });

    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Internal server error.",
            error: error.message,
        });
    }
};

module.exports = {
    applyLeave,
    getLeavesTakenByEmpId,
    getAllLeaves,
    applyForRegularization,
    actionForRegularization,
    actionForLeavApplication,
    getAllPendingLeaves,
    requestCompOff,
    getAllPendingCompoff,
    getOwnCompoffHistory,
    actionCompOff,
    deleteLeavApplication,
    deleteCompOffById,
    revertLeaveReq,
    actionForRevertLeaveReq,
    getLeavesDataAsJson,
    applyForVendorMeeting,
    actionForVendorMeeting,
    getAllVendorMeetingLogs,
    getVendorMeetingByUserId,
    updateLeaveHistoryData
}
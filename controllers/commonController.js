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
const eventModel = require("../models/eventModel");
const AttendanceLogModel = require("../models/attendanceLogModel");
// console.log(process.env.JWT_SECRET)
const moment = require('moment');
const trackolapAttendanceModel = require("../models/trackolapAttendanceModel");
const taxDeclarationModel = require("../models/taxDeclarationModel"); // Replace with your model
const actionLogModel = require("../models/actionLogModel");
const employeeDocModel = require("../models/employeeDocsModel");


const addNewHoliday = async (req, res) => {
    try {
        const schema = Joi.object({
            holidayName: Joi.string().required(),
            holidayDate: Joi.string().required(),
            description: Joi.string().required(),
            holiday_id: Joi.string().required(),
            location: Joi.string().allow("").optional(),
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
        // check already added or not
        const isAlreadyExists = await holidaysModel.find({ holidayDate: req.body.holidayDate });
        if (isAlreadyExists.length > 0) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "List already added on same date",
            });
        }
        const bodyDoc = new holidaysModel({
            holidayName: req.body.holidayName,
            holidayDate: req.body.holidayDate,
            description: req.body.description,
            holiday_id: req.body.holiday_id,
            location: req.body.location
        })

        const saveDoc = await bodyDoc.save();
        if (saveDoc) {
            return res.status(201).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Leave applied successfully.",
                data: saveDoc
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


const updateHoliday = async (req, res) => {
    try {
        const holiday_id = req.params.holiday_id;
        if (!holiday_id) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Validation Error ! id is required.",
            });
        }
        const { holidayName, holidayDate, description, location } = req.body;
        // check already added or not
        const isAlreadyExists = await holidaysModel.findOne({holiday_id:holiday_id});
        if (!isAlreadyExists) {
            return res.status(404).json({
                statusCode: 404,
                statusValue: "FAIL",
                message: "You have provided wrong id",
            });
        }

        const updateDoc = await holidaysModel.findOneAndUpdate(
            {
                holiday_id:holiday_id
            },
            {
                holidayName: holidayName || isAlreadyExists.holidayName,
                holidayDate: holidayDate || isAlreadyExists.holidayDate,
                description: description || isAlreadyExists.description,
                location: location || isAlreadyExists.location,
            },
            { new: true }
        )
        if (updateDoc) {
            return res.status(201).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Data updated successfully.",
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


const updateEventById = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ID
        if (!id) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Validation Error! Event ID is required.",
            });
        }
        
        // Joi Schema for request validation
        const schema = Joi.object({
            title: Joi.string().optional(),
            description: Joi.string().optional(),
            location: Joi.string().allow("").optional(),
            dateTime: Joi.string().optional(),
            imageUrl: Joi.string().allow("").optional(),
        });
        
        let result = schema.validate(req.body);
        if (result.error) {
            return res.status(400).json({
                statusValue: "FAIL",
                statusCode: 400,
                message: result.error.details[0].message,
            });
        }

        // Check if event exists
        const existingEvent = await eventModel.findById(id); 
        if (!existingEvent) {
            return res.status(404).json({
                statusCode: 404,
                statusValue: "FAIL",
                message: "Event not found with the provided ID.",
            });
        }

        // Update the event
        const updatedEvent = await eventModel.findByIdAndUpdate(
            id,
            {
                title: req.body.title || existingEvent.title,
                description: req.body.description || existingEvent.description,
                location: req.body.location || existingEvent.location,
                dateTime: req.body.dateTime || existingEvent.dateTime,
                imageUrl: req.body.imageUrl || existingEvent.imageUrl,
            },
            { new: true }
        );

        if (updatedEvent) {
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Event updated successfully.",
                data: updatedEvent,
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
};


const deleteHoliday = async (req, res) => {
    try {
        const holiday_id = req.params.holiday_id
        if (!holiday_id) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Validation Error ! id is required.",
            });
        }
        // check already added or not
        const isAlreadyExists = await holidaysModel.findOne({ holiday_id: holiday_id});
        if (!isAlreadyExists) {
            return res.status(404).json({
                statusCode: 404,
                statusValue: "FAIL",
                message: "You have provided wrong id",
            });
        }

        const deleteDoc = await holidaysModel.findOneAndDelete(
            { holiday_id: holiday_id}
        )
        if (deleteDoc) {
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Data deleted successfully.",
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


const getHolidayList = async (req, res) => {
    try {
        // check already added or not
        const getData = await holidaysModel.find({});
        if (getData.length < 1) {
            return res.status(404).json({
                statusCode: 404,
                statusValue: "FAIL",
                message: "data not found",
            });
        }

        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Holidays list get successfully.",
            data: getData
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


const addNewEvent = async (req, res) => {
    try {
        const schema = Joi.object({
            title: Joi.string().required(),
            description: Joi.string().required(),
            location: Joi.string().allow("").optional(),
            dateTime: Joi.string().required(),
            imageUrl: Joi.string().allow("").optional(),
        });

        let result = schema.validate(req.body);
        if (result.error) {
            return res.status(400).json({
                statusValue: "FAIL",
                statusCode: 400,
                message: result.error.details[0].message,
            });
        }
        // Create a new event document
        const newEvent = new eventModel({
            title: req.body.title,
            description: req.body.description,
            location: req.body.location,
            dateTime: req.body.dateTime,
            imageUrl: req.body.imageUrl,
        });
        
        // Save the event in MongoDB
        const savedEvent = await newEvent.save();
        
        if (savedEvent) {
            return res.status(201).json({
                statusCode: 201,
                statusValue: "SUCCESS",
                message: "Event created successfully.",
                data: savedEvent,
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
};


const getEventList = async (req, res) => {
    try {
        // check already added or not
        const getData = await eventModel.find({}).sort({createdAt:-1});
        if (getData.length < 1) {
            return res.status(404).json({
                statusCode: 404,
                statusValue: "FAIL",
                message: "data not found",
            });
        }

        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Holidays list get successfully.",
            data: getData
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




const deleteEvent = async (req, res) => {
    try {
        const {id} = req.params
        if (!id) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Validation Error ! id is required.",
            });
        }
        // check already added or not
        const isExists = await eventModel.findOne({ _id: id});
        if (!isExists) {
            return res.status(404).json({
                statusCode: 404,
                statusValue: "FAIL",
                message: "You have provided wrong id",
            });
        }

        const deleteDoc = await eventModel.findOneAndDelete(
            { _id: id}
        )
        if (deleteDoc) {
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Data deleted successfully.",
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


const getEmpDataCount = async (req, res) => {
    try {
        // check already added or not
        const totalEmpCount = await employeeModel.find({accountStatus:"Active"})

        const newEmpCount = await employeeModel.find({accountStatus:"Active", isProbation: true})
        const noticePeriodEmpCount = await employeeModel.find({accountStatus:"Active", isNotice:true})
        const inHouseEmpCount = await employeeModel.find({accountStatus:"Active", isInhouse:true})
        const fieldEmpCount = await employeeModel.find({accountStatus:"Active", isInhouse:false})
        
        if (totalEmpCount.length < 1) {
            return res.status(404).json({
                statusCode: 404,
                statusValue: "FAIL",
                message: "data not found",
            });
        }
        
        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Holidays list get successfully.",
            data: {
                totalEmployeeCount: totalEmpCount.length,
                newEmployeeCount: newEmpCount.length,
                employeeOnNoticePeriod: noticePeriodEmpCount.length,
                inHouseEmpCount: inHouseEmpCount.length,
                fieldEmpCount: fieldEmpCount.length,
            }
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


const getEmpAttendanceCount = async (req, res) => {
    try {
        const startDate = new Date("2025-01-01T00:00:00.000Z");
        const endDate = moment().endOf("month").toDate();

        const result = await AttendanceLogModel.aggregate([
            // Step 1: Match from Jan-2025 till now
            {
                $match: {
                    AttendanceDate: { $gte: startDate, $lte: endDate },
                    $expr: {
                        $in: [
                            { $trim: { input: "$Status" } },
                            ["Present", "Absent"]
                        ]
                    }
                }
            },
            // Step 2: Add duration (month) and dateOnly
            {
                $addFields: {
                    duration: {
                        $dateToString: { format: "%b-%Y", date: "$AttendanceDate" }
                    },
                    dateOnly: {
                        $dateToString: { format: "%Y-%m-%d", date: "$AttendanceDate" }
                    },
                    status: { $trim: { input: "$Status" } }
                }
            },
            // Step 3: Group by date and count present/absent for that day 
            {
                $group: {
                    _id: {
                        duration: "$duration", 
                        dateOnly: "$dateOnly"
                    },
                    presentCount: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "Present"] }, 1, 0]
                        }
                    },
                    absentCount: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "Absent"] }, 1, 0]
                        }
                    }
                }
            },
            // Step 4: Group by month to get max present and absent counts
            {
                $group: {
                    _id: "$_id.duration",
                    presentCount: { $max: "$presentCount" },
                    absentCount: { $max: "$absentCount" }
                }
            },
            // Step 5: Format result
            {
                $project: {
                    _id: 0,
                    duration: "$_id",
                    presentCount: 1,
                    absentCount: 1
                }
            },
            // Step 6: Sort by month
            {
                $addFields: {
                    sortKey: {
                        $dateFromString: {
                            dateString: { $concat: ["01-", "$duration"] },
                            format: "%d-%b-%Y"
                        }
                    }
                }
            },
            { $sort: { sortKey: 1 } },
            { $project: { sortKey: 0 } }
        ]);

        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Attendance counts get successfully.",
            data: result
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


const getEmpLeaveCount = async (req, res) => {
    try {
        // Format as string 'YYYY-MM-DD' because your DB stores leaveStartDate as a string
        const startOfLastMonthStr = moment().subtract(1, 'months').startOf('month').format('YYYY-MM-DD'); // e.g. '2025-05-01'
        const endOfLastMonthStr = moment().subtract(1, 'months').endOf('month').format('YYYY-MM-DD');     // e.g. '2025-05-31'

        const leaveHistoryData = await leaveTakenHistoryModel.find({
            leaveStartDate: { $gte: startOfLastMonthStr, $lte: endOfLastMonthStr }
        }, {
            employeeId: 1,
            leaveStartDate: 1,
            leaveEndDate: 1,
            leaveType: 1,
            status: 1
        }).sort({ createdAt: -1 });
        // console.log(11, leaveHistoryData[0])

        let pendingReqs = await leaveTakenHistoryModel.aggregate([
            { $match: { status: "Pending" } },
            { $group: { _id: "$employeeId" } },
            { $count: "pendingReq" }
        ])

        // calculate unplanned leaves
        const uninformedLeaveEmpIds = new Set();
        leaveHistoryData.forEach(entry => {
            if (entry.leaveType === "uninformedLeave") {
                uninformedLeaveEmpIds.add(entry.employeeId)
            }
        })

        // calculate planned leave count
        const plannedLeaveEmpIds = new Set();
        leaveHistoryData.forEach(entry => {
            if (entry.leaveType === "earnedLeave" || entry.leaveType === "casualLeave" || entry.leaveType === "compOffLeave") {
                plannedLeaveEmpIds.add(entry.employeeId)
            }
        })
        // console.log("Last month leave history:", pendingReqs);
        const attendanceRec = await AttendanceLogModel.find(
            { Status: "Present " },
            { InTime: 1, Status: 1, EmployeeCode: 1 }
        ).sort({ _id: -1 }).limit(500);

        // Assuming attendanceRec is your array
        const currentDate = moment().format("YYYY-MM-DD");
        const presentToday = attendanceRec.filter(entry => {
            const inDate = moment(entry.InTime, "YYYY-MM-DD HH:mm:ss").format("YYYY-MM-DD");
            return inDate === currentDate && entry.Status.trim() === "Present";
        });

        // To count unique EmployeeCode
        const uniqueEmployees = new Set(presentToday.map(entry => entry.EmployeeCode));

        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Attendance counts get successfully.",
            data: {
                pendingReqCount: pendingReqs[0]?.pendingReq || 0,
                unplannedLeaveCount: uninformedLeaveEmpIds.size,
                plannedLeaveCount: plannedLeaveEmpIds.size,
                todayPresentCount: uniqueEmployees.size
            }
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


const getTrackolapAttendance = async (req, res) => {
    try {
        if (req.query.month) {
            const [year, month] = req.query.month.split("-");
            const startDateStr = `${year}-${month}-01`;
            const endDate = new Date(startDateStr);
            endDate.setMonth(endDate.getMonth() + 1);
            const endDateStr = endDate.toISOString().split("T")[0]; // Converts to "yyyy-mm-dd"

            attendanceLogs = await trackolapAttendanceModel.find({
                date: {
                    $gte: startDateStr,
                    $lt: endDateStr
                }
            });
        } else {
            attendanceLogs = await trackolapAttendanceModel.find({});
        }

        if (attendanceLogs.length === 0) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "We don't have attendance logs."
            });
        }

        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Data retrieved successfully.",
            data: attendanceLogs
        });
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Internal Server Error",
            error: error.message
        });
    }
};


const addTrackolapAttendance = async (req, res) => {
  try {
    const schema = Joi.object({
      employeeId: Joi.string().required(),
      employeeName: Joi.string().required(),
      date: Joi.string().required(),
      status: Joi.string().required()
    });
    
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        statusValue: "FAIL",
        statusCode: 400,
        message: error.details[0].message
      });
    }
    
    const { employeeId, employeeName, date, status } = value;

    // Check for duplicate entry
    const existingEntry = await trackolapAttendanceModel.findOne({
      employeeId: employeeId.trim(),
      date: date.trim()
    });

    if (existingEntry) {
      return res.status(409).json({
        statusCode: 409,
        statusValue: "FAIL",
        message: "Duplicate entry: Attendance for this employee on this date already exists.",
        data: existingEntry
      });
    }

    // Save new entry
    const newAttendance = new trackolapAttendanceModel({
      employeeId: employeeId.trim(),
      employeeName: employeeName.trim(),
      date: date.trim(),
      status: status.trim()
    });

    const savedAttendance = await newAttendance.save();

    return res.status(201).json({
      statusCode: 201,
      statusValue: "SUCCESS",
      message: "Data saved successfully.",
      data: savedAttendance
    });
  } catch (error) {
    return res.status(500).json({
      statusCode: 500,
      statusValue: "FAIL",
      message: "Internal Server Error",
      error: error.message
    });
  }
};


const addTaxDeclaration = async (req, res) => {
    try {
        // Base schema (common to both regimes)
        const baseSchema = {
            taxRegime: Joi.string().valid("Old", "New").required(),
            employeeName: Joi.string().required(),
            employeeId: Joi.string().required(),
            designation: Joi.string().required(),
            dateOfJoining: Joi.string().required(),
            gender: Joi.string().required(),
            panNumber: Joi.string().required(),
            contactNumber: Joi.string().required()
        };

        // Old Tax Regime extra fields
        const oldRegimeExtraSchema = {
            residentialAddress: Joi.string().allow("").optional(),
            rentPayablePerMonth: Joi.string().allow("").optional(),
            rentStartDate: Joi.string().allow("").optional(),
            changesInRentAmount: Joi.string().allow("").optional(),
            landlordName: Joi.string().allow("").optional(),
            landlordPan: Joi.string().allow("").optional(),
            completeAddressOfRentedProperty: Joi.string().allow("").optional(),
            deductions: Joi.object().optional(),
            housingLoan: Joi.object().optional(),
            declaration: Joi.object().optional()
        };

        // Select schema based on taxRegime
        let schema;
        if (req.body.taxRegime === "Old") {
            schema = Joi.object({ ...baseSchema, ...oldRegimeExtraSchema });
        } else {
            schema = Joi.object(baseSchema);
        }

        // Validate request body
        const result = schema.validate(req.body);
        if (result.error) {
            return res.status(400).json({
                statusValue: "FAIL",
                statusCode: 400,
                message: result.error.details[0].message
            });
        }

        // Auto-remove old regime fields if New Tax Regime is selected
        let cleanedData = { ...req.body };
        if (req.body.taxRegime === "New") {
            delete cleanedData.residentialAddress;
            delete cleanedData.rentPayablePerMonth;
            delete cleanedData.rentStartDate;
            delete cleanedData.changesInRentAmount;
            delete cleanedData.landlordName;
            delete cleanedData.landlordPan;
            delete cleanedData.completeAddressOfRentedProperty;
            delete cleanedData.deductions;
            delete cleanedData.housingLoan;
            delete cleanedData.declaration;
        }

        // Save to MongoDB
        const newDeclaration = new taxDeclarationModel(cleanedData);
        const savedDeclaration = await newDeclaration.save();

        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Tax declaration submitted successfully.",
            data: savedDeclaration
        });

    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message
        });
    }
};


const getAllTaxDeclarations = async (req, res) => {
    try {
        const allDeclarations = await taxDeclarationModel.find();

        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Tax declarations fetched successfully.",
            data: allDeclarations
        });
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message
        });
    }
};

// POST API to add a log entry
const addLogData = async (req, res) => {
  try {
    const { employeeId, description, actionType, entityType } = req.body;
    const empDetails = await employeeModel.findOne({employeeId})

    const newLog = new actionLogModel({
      employeeId: employeeId || "",
      description: description || "",
      actionType: actionType || "",
      entityType: entityType || "",
      managerId: empDetails.managerId || ""
    });

    const savedLog = await newLog.save();

    return res.status(201).json({
      message: "Log data added successfully",
      statusCode: 201,
      statusValue: "SUCCESS",
      data: savedLog
    });
  } catch (error) {
    return res.status(500).json({
      message: "Something went wrong",
      statusCode: 500,
      statusValue: "ERROR",
      error: error.message
    });
  }
};


// GET API → fetch logs based on role
const getAllLogs = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(400).json({
        statusCode: 400,
        statusValue: "FAIL",
        message: "Token is required",
      });
    }

    // Decode token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      return res.status(400).json({
        statusCode: 400,
        statusValue: "FAIL",
        message: "Invalid token",
      });
    }

    let ownLogs = [];
    let teamLogs = [];
    let allLogs = [];

    if (decoded.role === "Employee") {
      // Employee → only own logs
      ownLogs = await actionLogModel
        .find({ employeeId: decoded.employeeId })
        .sort({ createdAt: -1 });

    } else if (decoded.role === "Manager") {
      // Manager → own logs + team logs
      ownLogs = await actionLogModel
        .find({ employeeId: decoded.employeeId })
        .sort({ createdAt: -1 });

      teamLogs = await actionLogModel
        .find({
          managerId: decoded.managerId,
          managerId: { $ne: "" },
          employeeId: { $ne: decoded.employeeId }, // avoid duplicating own logs
        })
        .sort({ createdAt: -1 });

    } else if (decoded.role === "HR-Admin" || decoded.role === "Super-Admin") {
      // HR-Admin & Super-Admin → all logs
      allLogs = await actionLogModel
        .find()
        .sort({ createdAt: -1 });
    }

    return res.status(200).json({
      message: "Logs fetched successfully",
      statusCode: 200,
      statusValue: "SUCCESS",
      ownLogs: ownLogs.length ? ownLogs : undefined,
      teamLogs: teamLogs.length ? teamLogs : undefined,
      allLogs: allLogs.length ? allLogs : undefined,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Something went wrong",
      statusCode: 500,
      statusValue: "ERROR",
      error: error.message,
    });
  }
};

const getAllPrivateDocuments = async (req, res) => {
    try {
        const aggregateData = await employeeDocModel.aggregate([
            { 
                $match: { docType: "Private" } 
            },
            // Normalize employeeId (handle "", null, or invalid values safely)
            {
                $addFields: {
                    employeeIdNorm: {
                        $toString: {
                            $convert: {
                                input: "$employeeId",
                                to: "int",
                                onError: null, // if conversion fails
                                onNull: null   // if value is null
                            }
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: "employees",
                    let: { empId: "$employeeIdNorm" },
                    pipeline: [
                        {
                            $addFields: {
                                employeeIdNorm: {
                                    $toString: {
                                        $convert: {
                                            input: "$employeeId",
                                            to: "int",
                                            onError: null,
                                            onNull: null
                                        }
                                    }
                                }
                            }
                        },
                        {
                            $match: { $expr: { $eq: ["$employeeIdNorm", "$$empId"] } }
                        }
                    ],
                    as: "employeeInfo"
                }
            },
            {
                $unwind: {
                    path: "$employeeInfo",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    _id: 1,
                    employeeId: "$employeeIdNorm", // normalized value like "49"
                    documentName: { $ifNull: ["$documentName", ""] },
                    location: { $ifNull: ["$location", ""] },
                    employeeName: { $ifNull: ["$employeeInfo.employeeName", ""] },
                    email: { $ifNull: ["$employeeInfo.email", ""] },
                    designation: { $ifNull: ["$employeeInfo.designation", ""] },
                    docType: { $ifNull: ["$docType", ""] }
                }
            }
        ]);

        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Private documents fetched successfully.",
            data: aggregateData
        });
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message
        });
    }
};







module.exports = {
    addNewHoliday,
    getHolidayList,
    updateHoliday,
    deleteHoliday,
    addNewEvent,
    getEventList,
    deleteEvent,
    updateEventById,
    getEmpDataCount,
    getEmpAttendanceCount,
    getEmpLeaveCount,
    addTrackolapAttendance,
    getTrackolapAttendance,
    addTaxDeclaration,
    getAllTaxDeclarations,
    addLogData,
    getAllLogs,
    getAllPrivateDocuments
}
const leaveTakenHistoryModel = require("../models/leaveTakenHistoryModel");
const employeeModel = require("../models/employeeModel");

const leaveResolvers = {
  Query: {
    leaves: async (
      _,
      { employeeId, dateFrom, dateTo, page = 1, limit = 20 }
    ) => {
      const filter = {};
      if (employeeId) {
        filter.employeeId = employeeId;
      }
      if (dateFrom && dateTo) {
        filter.leaveStartDate = { $gte: dateFrom };
        filter.leaveEndDate = { $lte: dateTo };
      }

      const skip = (page - 1) * limit;
      const total = await leaveTakenHistoryModel.countDocuments(filter);
      const data = await leaveTakenHistoryModel
        .find(filter)
        .skip(skip)
        .limit(limit)
        .sort({ leaveStartDate: -1 });

      return { total, page, limit, data };
    },
    
    employeeWithLeaves: async (_, {employeeId}) => {
      const result = await employeeModel.aggregate([
        { $match: { employeeId } },
        {
      $lookup: {
        from: "leavetakenhistories", // collection name in MongoDB
        localField: "employeeId",
        foreignField: "employeeId",
        as: "leaves"
      }
    }
      ]);
      if (!result.length) {
    throw new Error(`Employee with ID ${employeeId} not found`);
  }
  
  return result[0];
    }

  },

  Mutation: {
    createLeave: async (
      _,
      {
        employeeId,
        leaveType,
        leaveStartDate,
        leaveEndDate,
        totalDays,
        reason,
        approvedBy,
        location,
        remarks,
        shift,
      }
    ) => {
      // Step 1: Find employee by employeeId (string)
      const employee = await employeeModel.findOne(
        { employeeId: employeeId.trim() },
        { _id: 1, employeeId: 1, leaveBalance: 1 }
      );
      console.log(employee);
      if (!employee) {
        throw new Error(`Employee with ID ${employeeId} not found`);
      }

      // Step 2: Check leave balance
      const currentBalance = parseFloat(
        employee.leaveBalance[leaveType] || "0"
      );
      const leaveDays = parseFloat(totalDays || "0");

      if (currentBalance < leaveDays) {
        throw new Error(`Insufficient ${leaveType} balance`);
      }

      // Step 3: Deduct leave days directly in MongoDB
      await employeeModel.updateOne(
        { employeeId: employeeId.trim() },
        {
          $set: {
            [`leaveBalance.${leaveType}`]: (
              currentBalance - leaveDays
            ).toString(),
          },
        }
      );

      // Step 4: Create leave record
      const leave = new leaveTakenHistoryModel({
        employeeId, // store as string, not ObjectId
        leaveType,
        leaveStartDate,
        leaveEndDate,
        totalDays,
        reason,
        approvedBy,
        location,
        remarks,
        shift,
        status: "Pending",
        dateTime: new Date().toISOString(),
      });

      await leave.save();
      return leave;
    },
  },

  // Field-level resolver for LeaveTakenHistory type
  LeaveTakenHistory: {
    id: (parent) => parent._id.toString(),
  },
};

module.exports = leaveResolvers;

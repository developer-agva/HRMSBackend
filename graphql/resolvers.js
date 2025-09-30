const AttendanceLogModel = require('../models/attendanceLogModel');

const resolvers = {
  Query: {
    attendanceLogs: async (_, { employeeCode, employeeId, dateFrom, dateTo, page = 1, limit = 20 }) => {
      const filter = {};
      if (employeeCode) {
        filter.EmployeeCode = employeeCode;
      } else if (employeeId) {
        filter.EmployeeId = Number(employeeId);
      }

      if (dateFrom && dateTo) {
        filter.AttendanceDate = {
          $gte: new Date(`${dateFrom}T00:00:00.000Z`),
          $lte: new Date(`${dateTo}T23:59:59.999Z`)
        };
      }

      return getPaginatedAttendanceLogs(filter, page, limit);
    },

    attendanceLogsByNameOrEmail: async (_, { employeeName, email, dateFrom, dateTo, page = 1, limit = 20 }) => {
      const filter = {};

      if (employeeName) {
        filter.EmployeeName = { $regex: employeeName, $options: "i" }; 
      }
      if (email) {
        filter.Email = { $regex: `^${email}$`, $options: "i" };
      }

      if (dateFrom && dateTo) {
        filter.AttendanceDate = {
          $gte: new Date(`${dateFrom}T00:00:00.000Z`),
          $lte: new Date(`${dateTo}T23:59:59.999Z`)
        };
      }

      return getPaginatedAttendanceLogs(filter, page, limit);
    }
  },

  AttendanceLog: {
    id: (parent) => parent._id.toString(),
    AttendanceDate: (parent) =>
      parent.AttendanceDate?.toISOString().split('T')[0],
  }
};

async function getPaginatedAttendanceLogs(filter, page, limit) {
  const maxLimit = 100;
  limit = Math.min(limit, maxLimit);
  const skip = (page - 1) * limit;

  const total = await AttendanceLogModel.countDocuments(filter);
  const data = await AttendanceLogModel.find(filter)
    .skip(skip)
    .limit(limit)
    .sort({ AttendanceDate: -1 });

  return { data, total, page, limit };
}

module.exports = resolvers;

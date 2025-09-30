// utils/deleteUninformedLeaves.js
const trackolapAttendanceModel = require('../models/trackolapAttendanceModel');
const leaveTakenHistoryModel = require('../models/leaveTakenHistoryModel');

const deleteUninformedLeaves = async () => {
  try {
    const trackolapData = await trackolapAttendanceModel.find({ status: "Present" });
    const leaveTakenData = await leaveTakenHistoryModel.find({ leaveType: "uninformedLeave" });

    const toDelete = [];

    for (const leave of leaveTakenData) {
      const match = trackolapData.find(attendance =>
        attendance.employeeId === leave.employeeId &&
        attendance.date === leave.leaveStartDate
      );

      if (match) {
        toDelete.push(leave._id);
      }
    }

    if (toDelete.length > 0) {
      await leaveTakenHistoryModel.deleteMany({ _id: { $in: toDelete } });
      console.log(` Deleted ${toDelete.length} uninformedLeave records.`);
    } else {
      console.log("No matching uninformedLeave records found.");
    }
  } catch (error) {
    console.error(" Error in deleting uninformed leaves:", error);
  }
};

module.exports = deleteUninformedLeaves;

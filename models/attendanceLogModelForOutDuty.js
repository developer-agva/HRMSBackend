
const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema({
    employeeId: { type: String, required: true },
    // description: { type: String, required: true },
    AttendanceDate: { type: String, required: true },
    location: { type: String, default: "" },
    InTime: { type: String, default: ""},
    OutTime: { type: String, default: "" },
    PunchRecords: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    Status: { type: String, default: "Present " },
    Duration: { type: String, default: "" },
    source: { type: String, default: "app" },
    createdAt: { type: String, default: "" }, 
    updatedAt: { type: String, default: "" },
});

module.exports = mongoose.model('AttendanceLogForOutDuty', attendanceLogSchema);




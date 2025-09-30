const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    employeeId: { type: String, default: "" }, 
    employeeName: { type: String, default: "" },   
    date:  { type: String, default: "" },
    status: { type: String, default: "" }
});

module.exports = mongoose.model('trackolap_attendance', attendanceSchema);

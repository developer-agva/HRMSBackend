const express = require('express');
const rateLimit = require("express-rate-limit");

const { 
    getAllAttendanceLogs,    
    getAttendanceLogsByEmployeeId,
    getAttendanceDaysByMonth,
    removeDuplicateAttendance,
    getAttendanceLogsTodays,
    generateUninformedLeave, 
    approvedPendingLeaves,
    createAttendanceLogForOutDuty,
    getAttendanceLogForOutDutyById,
    punchOutForOutDuty,
    createEmployeeSalary,
    getAllEmployeeSalaries,
    getAllPunchRecordsForOutDuty,
    getAllOutDutyRecords,
    updateLocation,
    saveEmpLocation,
    recalculateDuration
} = require('../controllers/mainController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();
// rate limit
// Define the rate limiter
const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minutes window
    max: 5, // Allow only 5 requests per window per IP
    message: {
        statusCode: 429,
        statusValue: "Too Many Requests",
        message: "You have exceeded the max request limit. Please try again later."
    }
});



// Route to fetch all tables
// router.get('/tables', getTables);  // temp-used
// router.get('/attendanceLogUpdateDetails',getAttendanceLogsUpdateDetails); // un-used

// Route to fetch attendance logs
router.get('/attendance-logs', authLimiter, getAllAttendanceLogs); // used
router.get('/attendance-logs/:employeeId', getAttendanceLogsByEmployeeId); // used
router.get('/attendance-logs-day-wise', authLimiter, getAttendanceLogsTodays);  // get todays present employee list
router.get('/attendance-days-by-month/:employeeId', getAttendanceDaysByMonth); // used
router.get('/remove-duplicate-attendance-logs-by-month', removeDuplicateAttendance);


// router.get('/holidays-list', getHolidayList);
router.get('/generate-uninformed-leave', generateUninformedLeave);
router.get('/approve-pending-leaves-by-system', approvedPendingLeaves);

router.post('/punch-in', createAttendanceLogForOutDuty);
router.post('/punch-out/:id', punchOutForOutDuty);
router.put('/update-location/:id', updateLocation);
router.get('/get-log-records/:employeeId', getAttendanceLogForOutDutyById);
router.get('/get-all-punch-records/:employeeId', getAllPunchRecordsForOutDuty);
router.get('/get-all-out-duty-records', authMiddleware, getAllOutDutyRecords);
router.post('/save-emp-location', saveEmpLocation);
router.post('/recalculate-duration/:id', recalculateDuration);



router.post('/save-salary-data', createEmployeeSalary);
router.get('/all-employee-salary-data', authMiddleware, getAllEmployeeSalaries);

// router.get('/punchTime',getPunchTimeDetails);  // temp-used

// Employee routes
// router.get('/employees',getEmployees);  // used
// router.put('/update-employee-details', updateEmployeeDetailsByEmployeeId); // used

module.exports = router;

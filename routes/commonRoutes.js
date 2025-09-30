const express = require('express');
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require('../middlewares/authMiddleware');
const commonController = require("../controllers/commonController");

// holiday route
router.post('/add-holiday', commonController.addNewHoliday); 
router.get('/get-holiday-list', commonController.getHolidayList);
router.put('/update-holiday/:holiday_id', commonController.updateHoliday);
router.delete('/delete-holiday/:holiday_id', commonController.deleteHoliday);

// event routes
router.post('/add-event', commonController.addNewEvent); 
router.get('/get-event-list', commonController.getEventList);
router.delete('/delete-event/:id', commonController.deleteEvent);
router.put('/update-event/:id', commonController.updateEventById);

// Dashboard API
router.get('/get-emp-data-count', commonController.getEmpDataCount);
router.get('/get-emp-attendance-count', commonController.getEmpAttendanceCount);
router.get('/get-emp-leaves-count', commonController.getEmpLeaveCount);


router.post('/add-trackolap-attendance', commonController.addTrackolapAttendance);
router.get('/get-trackolap-attendance', commonController.getTrackolapAttendance); 

// Emp tds routes 
router.post('/add-declaration', commonController.addTaxDeclaration);
router.get('/tax-declarations', commonController.getAllTaxDeclarations);

// for logger only
router.post('/save-log-data', commonController.addLogData);
router.get('/get-logs-data', authMiddleware, commonController.getAllLogs);

// for private documents
router.get('/get-all-private-documents', commonController.getAllPrivateDocuments);


module.exports = router;
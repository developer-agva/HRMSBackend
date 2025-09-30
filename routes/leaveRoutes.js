const express = require('express');
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require('../middlewares/authMiddleware');
const leaveController = require("../controllers/leaveController");

// Leave routes
router.post('/apply-leave/:employeeId', authMiddleware, leaveController.applyLeave);

router.put('/update-leave-hisotry-data', leaveController.updateLeaveHistoryData); // oodo dev

router.put('/action-for-leave-application/:id', authMiddleware, leaveController.actionForLeavApplication);
router.post('/revert-leave-req', authMiddleware, leaveController.revertLeaveReq);
router.put('/action-for-revert-leave-req/:id', authMiddleware, leaveController.actionForRevertLeaveReq);

router.delete('/delete-leave-application/:id', authMiddleware, leaveController.deleteLeavApplication);

router.delete('/delete-compOff/:id', authMiddleware, leaveController.deleteCompOffById);

router.get('/get-employee-leave/:employeeId', authMiddleware, leaveController.getLeavesTakenByEmpId);
router.get('/get-all-leaves', authMiddleware, leaveController.getAllLeaves);  // for users only

router.get('/get-all-pending-leaves', authMiddleware, leaveController.getAllPendingLeaves);   // for Manager and HR-Admin
router.get('/get-all-json-leaves', leaveController.getLeavesDataAsJson);   // for Manager and HR-Admin


// for apply regularization
router.post('/apply-for-regularization/:employeeId', authMiddleware, leaveController.applyForRegularization);

router.post('/apply-for-vendor-meeting/:employeeId', authMiddleware, leaveController.applyForVendorMeeting);
router.put('/action-for-vendor-meeting/:id', authMiddleware, leaveController.actionForVendorMeeting);
router.get('/get-all-vendor-meeting-logs', authMiddleware, leaveController.getAllVendorMeetingLogs);
router.get('/get-all-vendor-meeting-logs/:employeeId', authMiddleware, leaveController.getVendorMeetingByUserId);

// req for compoff
router.post('/generate-compoff/:employeeId', authMiddleware, leaveController.requestCompOff);
router.get('/get-all-pending-compoff', authMiddleware, leaveController.getAllPendingCompoff);
router.get('/get-own-compoff-history', authMiddleware, leaveController.getOwnCompoffHistory);
router.put('/action-for-compoff-request/:id', authMiddleware, leaveController.actionCompOff);

// accept or reject 
router.put('/action-for-regularization/:id', authMiddleware, leaveController.actionForRegularization);


module.exports = router;
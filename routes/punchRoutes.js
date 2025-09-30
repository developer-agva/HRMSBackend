const express = require('express'); 
const router = express.Router();
const punchController = require('../controllers/punchController');
const authMiddleware = require('../middlewares/authMiddleware');

// Protect the route with JWT middleware
router.get('/punch-records', authMiddleware, punchController.getPunchRecords);

module.exports = router;

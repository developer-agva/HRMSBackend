const express = require('express');
const router = express.Router();
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");

const authController = require("../controllers/authController");
const authMiddleware = require('../middlewares/authMiddleware');

const authLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minutes window
    max: 50, // Allow only 5 requests per window per IP
    message: {
        statusCode: 429,
        statusValue: "Too Many Requests",
        message: "You have exceeded the max request limit. Please try again later."
    }
});


// Employee routes
router.post('/register', authController.registerEmployee);    
router.post('/login', authLimiter, authController.employeeLogin);
router.post('/logout', authMiddleware, authController.logout);
router.post('/reset-password', authLimiter, authController.resetForgetPassword);  // reset password step 1
router.post("/verify-otp", authController.verifyOtp);  // reset password step 2
router.put("/generate-newpassword", authController.generateNewPassword);  // reset password step final   


router.put('/update/:employeeId', authController.updateEmployeeById);  
router.put('/update-emp-salary-details/:employeeId', authController.updateEmpSalaryDetailsById);  
router.get('/get-all', authLimiter, authController.getAllEmployeeList);

router.get('/get-emp-list-by-manager', authMiddleware, authController.getEmployeeListByManagerId); 
router.get('/get-employee-details/:employeeId', authMiddleware, authController.getEmpDetailsById);
router.get('/get-employee-details-v2/:employeeId', authController.getEmpDetailsById);  // public api
router.delete('/delete-employee/:employeeId', authController.deleteEmpById);
router.delete('/delete-employee/:employeeId', authController.deleteEmpById);   

// get employee list on today
router.get('/get-today-onleave-emp-list', authController.getTodayOnleaveList);  



// Swagger API documentation
/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: Employee authentication endpoints
 */

/**
 * @swagger
 * /api/employee/login:
 *   post:
 *     summary: Employee Login
 *     description: Authenticate an employee using email and password, and return a JWT token upon successful login.
 *     tags: 
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: Employee's email or unique identifier
 *                 example: "353"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Employee's password
 *                 example: "12345"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 statusCode:
 *                   type: integer
 *                   example: 200
 *                 statusValue:
 *                   type: string
 *                   example: "SUCCESS"
 *                 token:
 *                   type: string
 *                   description: JWT authentication token
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Invalid email or password"
 *                 statusCode:
 *                   type: integer
 *                   example: 400
 *                 statusValue:
 *                   type: string
 *                   example: "FAIL"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 *                 statusCode:
 *                   type: integer
 *                   example: 500
 *                 statusValue:
 *                   type: string
 *                   example: "Error"
 *                 error:
 *                   type: string
 *                   example: "Error message details"
 */

/**
 * @swagger
 * /api/employee/logout:
 *   post:
 *     summary: Employee Logout
 *     description: Logs out an employee by invalidating the JWT token.
 *     tags: 
 *       - Authentication
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *         description: Bearer token required for authentication
 *         example: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbXBsb3llZUlkIjoxMjM0NTY3LCJyb2xlIjpbIkVtcGxveWVlIl0sImlhdCI6MTczMzgxMjgxMCwiZXhwIjoxNzM1MTA4ODEwfQ.1URrGAE1cFvHfH8f5y0fgbbhcQKViQ7B2OtFddrvULY"
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logout successful"
 *                 statusCode:
 *                   type: integer
 *                   example: 200
 *                 statusValue:
 *                   type: string
 *                   example: "SUCCESS"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Unauthorized: Invalid token"
 *                 statusCode:
 *                   type: integer
 *                   example: 401
 *                 statusValue:
 *                   type: string
 *                   example: "FAIL"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 *                 statusCode:
 *                   type: integer
 *                   example: 500
 *                 statusValue:
 *                   type: string
 *                   example: "Error"
 *                 error:
 *                   type: string
 *                   example: "Error message details"
 */




module.exports = router;
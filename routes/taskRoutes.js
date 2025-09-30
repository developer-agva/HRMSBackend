const express = require('express');
const router = express.Router();
const authController = require("../controllers/authController");
const authMiddleware = require('../middlewares/authMiddleware');
const taskController = require("../controllers/taskController");

/**
 * @swagger
 * /api/task/add-project:
 *   post:
 *     summary: Add a new project
 *     description: Create a new project with details such as name, assigned users, start and end dates, and task count.
 *     tags: 
 *       - Projects
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *                 description: Unique project ID (if not provided, an OTP will be generated)
 *                 example: 1090
 *               name:
 *                 type: string
 *                 description: Name of the project
 *                 example: "AgVa Intelli"
 *               user_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: List of user IDs assigned to the project
 *                 example: [191]
 *               assignes_emails:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: List of assigned users' emails
 *                 example: ["shivprakash@agvahealthtech.com", "rohanrana@agvahealthtech.com"]
 *               date_start:
 *                 type: string
 *                 format: date-time
 *                 description: Project start date (ISO format)
 *                 example: "2024-08-02T11:00:00.000Z"
 *               date_end:
 *                 type: string
 *                 format: date-time
 *                 description: Project end date (ISO format)
 *                 example: "2024-08-30T17:00:00.000Z"
 *               tasks_count:
 *                 type: integer
 *                 description: Total number of tasks in the project
 *                 example: 3
 *               description:
 *                 type: string
 *                 description: Brief description of the project
 *                 example: "This is a test project for AgVa Intelli."
 *               create_date:
 *                 type: string
 *                 format: date-time
 *                 description: Project creation date (ISO format)
 *                 example: "2024-08-02T11:13:23.884Z"
 *               task_creator_email:
 *                 type: string
 *                 format: email
 *                 description: Email of the user who created the project
 *                 example: "admin@agvahealthtech.com"
 *     responses:
 *       201:
 *         description: Project added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Project added successfully"
 *                 statusCode:
 *                   type: integer
 *                   example: 201
 *                 statusValue:
 *                   type: string
 *                   example: "SUCCESS"
 *                 project:
 *                   type: object
 *                   description: Project details
 *       400:
 *         description: Error while adding project
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Error while adding project"
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
 *                   example: "Internal server error."
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



// project route
router.post('/add-project', taskController.addProject);
router.put('/update-project/:id', taskController.updateProjectById);
router.get('/get-projects', authMiddleware, taskController.getProjects);
router.get('/get-all-project', taskController.getProjects2);

// task routes
router.post('/add-task', taskController.addTask);
router.put('/update-task/:id', taskController.updateTaskById);
router.get('/get-tasks', authMiddleware, taskController.getTasks);
router.get('/get-tasks-v2', taskController.getTasks2);
router.get('/get-tasks/:project_id', authMiddleware, taskController.getTasksByProjectId);
router.get('/get-task-details/:id', authMiddleware, taskController.getTasksById);


module.exports = router;
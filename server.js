const express = require("express")
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const connectToMongoDB = require("./config/mongoConfig");
// const {connectToDB} = require("./config/dbConfig");
const morgan = require("morgan");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
// for swagger
const swaggerJsDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

dotenv.config();
const cors = require("cors")
const cron = require('node-cron');
const fs = require("fs");
const path = require("path");
// const {startAttendanceCronJob, startUpdateAttendanceCronJob} = require("./utils/attendanceCronJob.js");
const { startRemoveAttendanceDuplicateRecords } = require("./controllers/mainController.js");

// for raphql
const { ApolloServer } = require('apollo-server-express');
const schema = require('./graphql/schema');

async function startApolloServer() {
  const server = new ApolloServer({
    schema
  });
  
  await server.start();
  server.applyMiddleware({ app });
}

startApolloServer();
// end for graphql  



const app = express();
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json());

// const cors = require("cors");

// Define CORS options
// const corsOptions = {
//   origin: (origin, callback) => {
//     const allowedOrigins = [
//       "https://13.238.217.82",
//       "http://13.238.217.82"
//     ];

//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
//   methods: ["GET", "POST", "PUT", "DELETE"]
// };

// // Apply CORS middleware
// app.use(cors(corsOptions));

app.use(cors());



connectToMongoDB();  // for mongo conn
// connectToDB();  // for sql conn  


// Swagger Configuration
const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "HRMS API's",
            version: "1.0.0",
            description: "API documentation for managing projects, tasks, and employee data",
        },
        servers: [
            {
                url: `http://localhost:${PORT}`,
                description: "Local Development Server",
            },
            {
                url: `http://172.23.100.211:${PORT}`,
                description: "Production Server",
            },
        ],
    },
    apis: ["./routes/*.js"], // Ensure all your route files have Swagger annotations
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// end swagger 

// Route
const mainRoutes = require('./routes/mainRoutes.js');
const authRoutes = require('./routes/authRoutes.js');
const leaveRoutes = require('./routes/leaveRoutes.js');
const commonRoutes = require("./routes/commonRoutes.js");
const indexRoutes = require("./routes/index.js");
const taskRoutes = require("./routes/taskRoutes.js");
const punchRoutes = require("./routes/punchRoutes.js");


const logRequestDetails = (req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next(); // Pass control to the next middleware/handler
};

app.use(morgan("combined"));
// Middleware to log request details
app.use(logRequestDetails);
// Use the main route file


app.use('/api', mainRoutes);
app.use('/api/employee', authRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/common', commonRoutes);
app.use('/api/s3', indexRoutes);
app.use('/api/task', taskRoutes);
app.use('/api', punchRoutes);

// cron job
const employeeModel = require("./models/employeeModel");
const CompOff = require("./models/compOffHistoryModel.js");
const moment = require("moment");
const AttendanceLogModel = require("./models/attendanceLogModel.js");
// const leaveTakenHistoryModel = require("./models/leaveTakenHistoryModel.js");
const AttendanceLogForOutDuty = require("./models/attendanceLogModelForOutDuty.js");
const holidaysModel = require("./models/holidayModel.js");
const trackolapAttendanceModel = require("./models/trackolapAttendanceModel.js");

// Backup dir
const BACKUP_DIR = path.join(__dirname, "db_backup");

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Function to back up a collection in JSON format
const backupCollectionToJson = async (Model, fileName) => {
    try {
        const data = await Model.find().lean();
        if (data.length === 0) {
            console.log(`No data to back up for ${fileName}`);
            return;
        }
        
        const backupFilePath = path.join(BACKUP_DIR, `${fileName}_${moment().format("YYYY-MM-DD")}.json`);
        fs.writeFileSync(backupFilePath, JSON.stringify(data, null, 2));
        
        console.log(`Backup successful: ${backupFilePath}`);
    } catch (error) {
        console.error(`Error backing up ${fileName}:`, error);
    }
}


// Function to delete backups older than 7 days
const deleteOldBackups = () => {
    const files = fs.readdirSync(BACKUP_DIR);

    files.forEach(file => {
        // Extract date from filename (assuming format: "fileName_YYYY-MM-DD.json")
        const match = file.match(/\d{4}-\d{2}-\d{2}/);
        if (match) {
            const fileDate = moment(match[0], "YYYY-MM-DD");
            const sevenDaysAgo = moment().subtract(7, "days");

            if (fileDate.isBefore(sevenDaysAgo)) {
                const filePath = path.join(BACKUP_DIR, file);
                fs.unlinkSync(filePath);
                console.log(`Deleted old backup: ${filePath}`);
            }
        }
    });
};


// Schedule the backup cron job (Runs daily at midnight)
cron.schedule("50 17 * * *", async () => {
    console.log("Starting daily backup...");

    await backupCollectionToJson(employeeModel, "employeeModel_backup");
    await backupCollectionToJson(CompOff, "compOffHistoryModel_backup");
    await backupCollectionToJson(AttendanceLogModel, "attendanceLogModel_backup");
    await backupCollectionToJson(leaveTakenHistoryModel, "leaveTakenHistoryModel_backup");

    console.log("Daily JSON backup completed.");

    // Run cleanup after backup
    // deleteOldBackups();
});

const backupAllCollections = async () => {
    console.log("Starting daily backup..."); 

    await backupCollectionToJson(employeeModel, "employeeModel_backup");
    await backupCollectionToJson(CompOff, "compOffHistoryModel_backup");
    await backupCollectionToJson(AttendanceLogModel, "attendanceLogModel_backup");
    await backupCollectionToJson(leaveTakenHistoryModel, "leaveTakenHistoryModel_backup");

    console.log("Daily JSON backup completed.");

    // Run cleanup after backup
    // deleteOldBackups();
};

// Call this function whenever you want to backup
// backupAllCollections();   // start backup fun

const filePatterns = [
    "employeeModel_backup_",
    "compOffHistoryModel_backup_",
    "leaveTakenHistoryModel_backup_"
];
const backupDir = path.join(__dirname, "db_backup");

// GET API to fetch JSON data by date
app.get("/api/get-json", (req, res) => {
    const { date } = req.query;
    
    if (!date) {
        return res.status(400).json({
            message: "Date query parameter is required (yyyy-mm-dd)",
            statusCode: 400,
            statusValue: "error"
        });
    } 
        
    let results = [];
    let errors = [];
    
    
    // Read all matching files
    filePatterns.forEach((pattern) => {
        const jsonFilePath = path.join(backupDir, `${pattern}${date}.json`);
        
        if (fs.existsSync(jsonFilePath)) {
            try {
                const data = fs.readFileSync(jsonFilePath, "utf8");
                results.push({
                    filename: path.basename(jsonFilePath),
                    data: JSON.parse(data)
                });
            } catch (err) {
                errors.push({
                    filename: path.basename(jsonFilePath),
                    error: err.message
                });
            }
        } else {
            errors.push({
                filename: `${pattern}${date}.json`,
                error: "File not found"
            });
        }
    });
    
    res.status(200).json({
        message: "JSON data fetched successfully",
        statusCode: 200,
        statusValue: "success",
        data: results,
        errors: errors.length > 0 ? errors : undefined
    });
});

// startUpdateAttendanceCronJob();
startRemoveAttendanceDuplicateRecords();

// Cron job for automatic approved regularization request
// Schedule the cron job to run every day at midnight
// cron.schedule("0 0 * * *", async () => {
//     try {
//         // Get today's date minus 3 days, formatted as YYYY-MM-DD
//         const threeDaysAgo = moment().subtract(3, "days").format("YYYY-MM-DD");

//         // Find all comp-off requests with compOffDate older than or equal to 3 days ago and still pending
//         const compOffRequests = await CompOff.find({
//             compOffDate: { $lte: threeDaysAgo },
//             status: "Pending"
//         });

//         for (const compOff of compOffRequests) {
//             // Approve the comp-off request
//             const updatedCompOff = await CompOff.findByIdAndUpdate(
//                 compOff._id,
//                 {
//                     status: "Approved",
//                     approvedDate: moment().format("YYYY-MM-DD HH:mm:ss"),
//                     comments: "Action taken automatically after 3 days"
//                 },
//                 { new: true }
//             );

//             // Update the employee's leave balance
//             await Employee.updateOne(
//                 { employeeId: compOff.employeeId },
//                 {
//                     $set: {
//                         "leaveBalance.earnedLeave": {
//                             $toString: {
//                                 $add: [
//                                     { $toInt: "$leaveBalance.earnedLeave" },
//                                     parseInt(compOff.totalDays, 10)
//                                 ]
//                             }
//                         }
//                     }
//                 }
//             );

//             console.log(`CompOff request approved for employee ID: ${compOff.employeeId}`);
//         }

//         console.log("Cron job completed successfully.");
//     } catch (error) {
//         console.error("Error during cron job execution:", error);
//     }
// });


// run cron job daily at mid night 12:30 for auto regularization
cron.schedule("30 0 * * *", async () => {
    try {
        const threeDaysAgo = moment().subtract(3, "days").format("YYYY-MM-DD");
        console.log("running job")
        // Find all regularization requests older than or equal to 3 days ago and still pending
        const regularizationRequests = await leaveTakenHistoryModel.find({
            leaveStartDate: { $lte: threeDaysAgo },
            leaveType: "regularized",
            status: "Pending",
        });
        
        for (const regReq of regularizationRequests) {
            // Approve the regularization request
            const updatedReq = await leaveTakenHistoryModel.findByIdAndUpdate(
                regReq._id,
                {
                    status: "Approved",
                    approvedDateTime: moment().format("YYYY-MM-DD HH:mm:ss"),
                    remarks: "Action taken automatically after 3 days",
                },
                { new: true }
            );
             
            // Update the employee's leave balance only if maxRegularization is less than or equal to 2
            const employee = await employeeModel.findOne({ employeeId: regReq.employeeId });
            
            if (employee && parseInt(employee.maxRegularization) <= 2) {
                await employeeModel.updateOne(
                    { employeeId: regReq.employeeId },
                    {
                        $set: {
                            maxRegularization: (
                                parseInt(employee.maxRegularization) - 1
                            ).toString(),
                        },
                    }
                );
            }
            
            console.log(
                `Regularization request approved for employee ID: ${regReq.employeeId}`
            );
        }
        console.log("Cron job completed successfully.");
    } catch (error) {
        console.error("Error during cron job execution:", error);
    }
});


// run cron job daily at mid night 12:35 for auto approved shortLeave req
cron.schedule("35 0 * * *", async () => {
    try {
        console.log("Running auto-approval cron job...");
        // Get the date 3 days ago as an ISO string
        const threeDaysAgo = moment().subtract(3, "days").startOf("day").toISOString();

        // Approve all pending short leave requests older than 3 days
        const updatedRequests = await leaveTakenHistoryModel.updateMany(
            {
                leaveStartDate: { $lte: threeDaysAgo },
                leaveType: "shortLeave",
                status: "Pending",
            },
            {
                $set: {
                    status: "Approved",
                    approvedDateTime: moment().format("YYYY-MM-DD HH:mm:ss"),
                    remarks: "Action taken automatically after 3 days",
                },
            }
        );

        console.log(`Total short leave requests approved: ${updatedRequests.modifiedCount}`);

        // Reduce maxShortLeave for employees whose request was approved
        if (updatedRequests.modifiedCount > 0) {
            const employeesToUpdate = await leaveTakenHistoryModel.distinct("employeeId", {
                leaveStartDate: { $lte: threeDaysAgo },
                leaveType: "shortLeave",
                status: "Approved",
            });

            await employeeModel.updateMany(
                { employeeId: { $in: employeesToUpdate }, maxShortLeave: "1" },
                { $set: { maxShortLeave: "0" } }
            );

            console.log(`Updated maxShortLeave for employees: ${employeesToUpdate.length}`);
        }

        console.log("Cron job completed successfully.");
    } catch (error) {
        console.error("Error during cron job execution:", error);
    }
});


// Schedule a cron job to run at midnight on the first day of every month
cron.schedule('40 0 1 * *', async () => {
    console.log('Running cron job to reset maxRegularization and maxShortLeave...');

    try {
        const result = await employeeModel.updateMany(
            {},
            {
                $set: {
                    'maxShortLeave': '1',
                    'maxRegularization': '2'
                }
            }
        );
        
        console.log(`Successfully updated maxRegularization and maxShortLeave for ${result.modifiedCount} employees.`);
    } catch (error) {
        console.error('Error updating maxRegularization and maxShortLeave:', error);
    }
});

// Cron job for auto credited medicalLeave in jan by 6
// Cron job for January 1st at midnight
// cron.schedule('0 0 1 1 *', async () => {
//     console.log('Running cron job to reset medicalLeave to 6 on January 1st...');

//     try {
//         // Update all employees' medicalLeave to 6
//         const result = await employeeModel.updateMany(
//             {},
//             { $set: { 'leaveBalance.medicalLeave': '6' } }
//         );

//         console.log(`Successfully updated medicalLeave to 6 for ${result.nModified} employees.`);
//     } catch (error) {
//         console.error('Error updating medicalLeave on January 1st:', error);
//     }
// });

// Cron job for auto credited medicalLeave in july by 6
// Cron job for July 1st at midnight
cron.schedule('0 0 1 7 *', async () => {
    console.log('Running cron job to reset medicalLeave to 6 on July 1st...');

    try {
        // Update all employees' medicalLeave to 6
        const result = await employeeModel.updateMany(
            {},
            { $set: { 'leaveBalance.medicalLeave': '6' } }
        );

        console.log(`Successfully updated medicalLeave to 6 for ${result.nModified} employees.`);
    } catch (error) {
        console.error('Error updating medicalLeave on July 1st:', error);
    }
});

// GET API to reset medical leave
app.get('/api/reset-medical-leaves', async (req, res) => {
    console.log('Running function to reset medicalLeave to 6 on July 1st...');

    try {
        // Update all employees' medicalLeave to 6
        const result = await employeeModel.updateMany(
            {},
            { $set: { 'leaveBalance.medicalLeave': '6' } }
        );

        console.log(`Successfully updated medicalLeave to 6 for ${result.modifiedCount} employees.`);
        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: `Successfully updated medicalLeave to 6 for ${result.modifiedCount} employees.`,
            data: { modifiedCount: result.modifiedCount }
        });

    } catch (error) {
        console.error('Error updating medicalLeave on July 1st:', error);
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message,
            error: error.message
        });
    }
});


// GET API to credit earned leaves
// Cron job for auto incremented earnedLeave quaterly by 4
// cron.schedule('30 0 1 1,4,7,10 *', async () => {
//     console.log('Running cron job to credit 4 earned leaves...');

//     try {
//         await employeeModel.updateMany(
//             { 'leaveBalance.earnedLeave': { $exists: false } },
//             { $set: { 'leaveBalance.earnedLeave': '0' } } // Initialize as string
//         );

//         // Increment earnedLeave and ensure it is stored as a string
//         const result = await employeeModel.updateMany(
//             {},
//             [
//                 {
//                     $set: {
//                         'leaveBalance.earnedLeave': {
//                             $toString: {
//                                 $add: [
//                                     { $toInt: '$leaveBalance.earnedLeave' },
//                                     4
//                                 ]
//                             }
//                         }
//                     }
//                 }
//             ]
//         );

//         console.log(`Successfully credited 4 earned leaves for ${result.modifiedCount} employees.`);
//     } catch (error) {
//         console.error('Error crediting earned leaves:', error);
//     }
// });


// Cron job for auto incremented casualLeave quaterly by 2
// cron.schedule('30 0 1 1,4,7,10 *', async () => {
//     console.log('Running cron job to credit 2 casual leaves...');

//     try {
//         await employeeModel.updateMany(
//             { 'leaveBalance.casualLeave': { $exists: false } },
//             { $set: { 'leaveBalance.casualLeave': '0' } } // Initialize as string
//         );

//         // Increment earnedLeave and ensure it is stored as a string
//         const result = await employeeModel.updateMany(
//             {},
//             { $set: { 'leaveBalance.casualLeave': '2' } }
//         );

//         console.log(`Successfully credited 2 casual leaves for ${result.modifiedCount} employees.`);
//     } catch (error) {
//         console.error('Error crediting casual leaves:', error);
//     }
// });        


// GET API to trigger casual leave crediting
// GET API to credit earned leaves
app.post('/api/credit-earned-leaves', async (req, res) => {
    console.log('Running function to credit 4 earned leaves...');

    try {
        // Initialize leave balance if not set
        await employeeModel.updateMany(
            { 'leaveBalance.earnedLeave': { $exists: false } },
            { $set: { 'leaveBalance.earnedLeave': '0' } } // Initialize as string
        );

        // Increment earnedLeave and ensure it is stored as a string
        const result = await employeeModel.updateMany(
            {},
            [
                {
                    $set: {
                        'leaveBalance.earnedLeave': {
                            $toString: {
                                $add: [
                                    { $toInt: '$leaveBalance.earnedLeave' },
                                    4
                                ]
                            }
                        }
                    }
                }
            ]
        );

        console.log(`Successfully credited 4 earned leaves for ${result.modifiedCount} employees.`);
        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: `Successfully credited 4 earned leaves for ${result.modifiedCount} employees.`,
            data: { modifiedCount: result.modifiedCount }
        });

    } catch (error) {
        console.error('Error crediting earned leaves:', error);
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message,
            error: error.message
        });
    }
});


app.post('/api/credit-casual-leaves', async (req, res) => {
    console.log('Running function to credit 2 casual leaves...');

    try {
        // Initialize leave balance if not set
        await employeeModel.updateMany(
            { 'leaveBalance.casualLeave': { $exists: false } },
            { $set: { 'leaveBalance.casualLeave': '0' } } // Initialize as string
        );

        // Update casual leave balance
        const result = await employeeModel.updateMany(
            {},
            { $set: { 'leaveBalance.casualLeave': '2' } }
        );

        console.log(`Successfully credited 2 casual leaves for employees.`);
        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: `Successfully credited 2 casual leaves for employees.`,
            // data: { modifiedCount: result.modifiedCount }
        });

    } catch (error) {
        console.error('Error crediting casual leaves:', error);
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message,
            error: error.message
        });
    }
});



// Cron Job: Runs every 30 minutes to remove duplicate records from leave history
cron.schedule("*/45 * * * *", async () => {
    console.log("Running duplicate removal job for leave history...");

    try {
        const duplicates = await leaveTakenHistoryModel.aggregate([
            {
                $group: {
                    _id: {
                        employeeId: "$employeeId",
                        leaveStartDate: "$leaveStartDate",
                        leaveEndDate: "$leaveEndDate"
                    },
                    ids: { $push: "$_id" },
                    count: { $sum: 1 } 
                }
            },
            {
                $match: {
                    count: { $gt: 1 } 
                }
            }
        ]);

        // Extract IDs to delete (keeping the first occurrence)
        const idsToDelete = duplicates.flatMap(doc => doc.ids.slice(1));

        if (idsToDelete.length > 0) {
            await leaveTakenHistoryModel.deleteMany({ _id: { $in: idsToDelete } });
            console.log(`Deleted ${idsToDelete.length} duplicate records.`);
        } else {
            console.log("No duplicates found.");
        }
    } catch (error) {
        console.error("Error in cron job:", error);
    }
});

cron.schedule("*/15 * * * *", async () => {
    console.log("Running EmployeeCode update job...");

    try {
        // const updateOperations = [
        //     { EmployeeId: 2564, EmployeeCode: "2564" }, no
        //     { EmployeeId: 2751, EmployeeCode: "2751" }, no
        //     { EmployeeId: 2717, EmployeeCode: "2717" }, no
        //     { EmployeeId: 2716, EmployeeCode: "2716" },  no

        //     { EmployeeId: 2881, EmployeeCode: "2881" }, no
        //     { EmployeeId: 2878, EmployeeCode: "2878" }, no
        //     { EmployeeId: 2821, EmployeeCode: "2821" }, no
        //     { EmployeeId: 2822, EmployeeCode: "2822" }, no
        //     { EmployeeId: 2823, EmployeeCode: "2823" }, 
        // ];

        // await AttendanceLogModel.updateMany({EmployeeId:2564},{$set:{EmployeeCode:"2564"}})
        // await AttendanceLogModel.updateMany({EmployeeId:2751},{$set:{EmployeeCode:"2751"}})
        // await AttendanceLogModel.updateMany({EmployeeId:2717},{$set:{EmployeeCode:"2717"}})
        // await AttendanceLogModel.updateMany({EmployeeId:2716},{$set:{EmployeeCode:"2716"}})

        // await AttendanceLogModel.updateMany({EmployeeId:2881},{$set:{EmployeeCode:"2881"}})
        // await AttendanceLogModel.updateMany({EmployeeId:2878},{$set:{EmployeeCode:"2878"}})
        // await AttendanceLogModel.updateMany({EmployeeId:2821},{$set:{EmployeeCode:"2821"}})
        // await AttendanceLogModel.updateMany({EmployeeId:2822},{$set:{EmployeeCode:"2822"}})
        // await AttendanceLogModel.updateMany({EmployeeId:2823},{$set:{EmployeeCode:"2823"}})

    } catch (error) {
        console.error("Error in EmployeeCode update job:", error);
    }
});


cron.schedule("*/59 * * * *", async () => {
  console.log("Running Remove Duplicate PunchRecords from Attendance Records...");

  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const attendanceData = await AttendanceLogModel.find(
      {
        AttendanceDate: {
          $gte: startOfMonth,
          $lte: endOfMonth,
        },
        // EmployeeCode:"415"
      },
      {
        _id: 1,
        AttendanceDate: 1,
        InTime: 1,
        PunchRecords: 1,
      }
    );
    
    for (const record of attendanceData) {
      if (record.PunchRecords && record.PunchRecords.trim() !== "") {
        const punches = record.PunchRecords
          .split(",")
          .filter((p) => p.trim() !== "");

        const uniquePunches = [...new Set(punches)];
        
        const cleanedPunchRecords = uniquePunches.join(",") + (uniquePunches.length ? "," : "");

        // Update the document only if it has changed
        if (cleanedPunchRecords !== record.PunchRecords) {
          await AttendanceLogModel.updateOne(
            { _id: record._id },
            { $set: { PunchRecords: cleanedPunchRecords } }
          );
          console.log(`Updated record _id: ${record._id}`);
        }
      }
    }
    console.log("EmployeeCode update job completed.");
  } catch (error) {
    console.error("Error in EmployeeCode update job:", error);
  }
});


// const updateHolidayStatus = async () => {
//     try {
//       const holidayList = await holidaysModel.find({}, { holidayDate: 1 });
  
//       const holidayDates = holidayList.map((holiday) => 
//         new Date(`${holiday.holidayDate}T00:00:00.000Z`) 
//       );

//       const attendanceUpdate = await AttendanceLogModel.updateMany(
//         { 
//           AttendanceDate: { $in: holidayDates },
//           $or: [{ PunchRecords: null }, { PunchRecords: "" }]
//         },
//         { $set: { Status: "Holiday", Holiday: 1, StatusCode:"H" } }
//       );
  
//       console.log(`${attendanceUpdate.modifiedCount} records updated.`);
//     } catch (error) {
//       console.error("Error updating holiday status in AttendanceLogModel:", error);
//     }
// };
  
// updateHolidayStatus();

// For update attendance log for holiday status

cron.schedule("*/50 * * * *", async () => {
    console.log("Running Holiday Status update job...");

    try {
        const holidayList = await holidaysModel.find({}, { holidayDate: 1 });
    
        const holidayDates = holidayList.map((holiday) => 
          new Date(`${holiday.holidayDate}T00:00:00.000Z`) 
        );
  
        const attendanceUpdate = await AttendanceLogModel.updateMany(
          { 
            AttendanceDate: { $in: holidayDates },
            $or: [{ PunchRecords: null }, { PunchRecords: "" }]
          },
          { $set: { Status: "Holiday", Holiday: 1, StatusCode:"H" } }
        );
    
        console.log(`${attendanceUpdate.modifiedCount} records updated.`);
    } catch (error) {
        console.error("Error updating holiday status in AttendanceLogModel:", error);
    }
});


cron.schedule("*/30 * * * *", async () => {
    console.log("Running maxShortLeave job...");
    
    const now = new Date();
    
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    
    const startOfMonth = formatDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const endOfMonth = formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    
    try {
        const empList = await employeeModel.find({}, { employeeId: 1 });
        
        const shortLeaveHistory = await leaveTakenHistoryModel.find({
            $or: [
                { leaveStartDate: { $gte: startOfMonth, $lte: endOfMonth } },
                { leaveEndDate: { $gte: startOfMonth, $lte: endOfMonth } }
            ],
            leaveType: "shortLeave"
        }, { employeeId: 1 });
        
        const takenEmpIds = new Set(shortLeaveHistory.map(doc => doc.employeeId));

        const notTakenEmpIdsArray = empList
            .filter(emp => !takenEmpIds.has(emp.employeeId))
            .map(emp => emp.employeeId);
        
        if (notTakenEmpIdsArray.length > 0) {
            const result = await employeeModel.updateMany(
                { employeeId: { $in: notTakenEmpIdsArray } },
                { $set: { maxShortLeave: "1" } }
            );
            console.log(`Bulk updated ${result.modifiedCount} employees with maxShortLeave: "1"`);
        } else {
            console.log("No employees to update with maxShortLeave");
        }
        
    } catch (error) {
        console.error("Error during maxShortLeave processing:", error);
    }
});


cron.schedule("*/30 * * * *", async () => {
    console.log("Running maxRegularization job...");
    
    const now = new Date();

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    try {
        // Step 1: Get all employees
        const empList = await employeeModel.find({}, { employeeId: 1 });

        // Step 2: Aggregate leave count for each employee (convert string to date if needed)
        const leaveCounts = await leaveTakenHistoryModel.aggregate([
            {
                $addFields: {
                    leaveStartDate: { $toDate: "$leaveStartDate" },
                    leaveEndDate: { $toDate: "$leaveEndDate" }
                }
            },
            {
                $match: {
                    leaveType: "regularized",
                    leaveStartDate: { $lte: endOfMonth },
                    leaveEndDate: { $gte: startOfMonth }
                }
            },
            {
                $group: {
                    _id: "$employeeId",
                    count: { $sum: 1 }
                }
            }
        ]);

        // Step 3: Map employeeId to count
        const empLeaveMap = new Map();
        leaveCounts.forEach(doc => {
            empLeaveMap.set(doc._id, doc.count);
        });

        // Step 4: Create bulk update operations
        const bulkOps = empList.map(emp => {
            const count = empLeaveMap.get(emp.employeeId) || 0;
            let maxRegularization = 0;
            
            if (count === 0) {
                maxRegularization = 2;
            } else if (count === 1) {
                maxRegularization = 1;
            } else {
                maxRegularization = 0;
            }

            return {
                updateOne: {
                    filter: { employeeId: emp.employeeId },
                    update: { $set: { maxRegularization } }
                }
            };
        });

        // Step 5: Execute bulk update
        if (bulkOps.length > 0) {
            const result = await employeeModel.bulkWrite(bulkOps);
            console.log(`Updated ${result.modifiedCount} employees with maxRegularization`);
        } else {
            console.log("No updates needed");
        }

    } catch (error) {
        console.error("Error during maxRegularization job:", error);
    }
});

cron.schedule("*/3 * * * *", async () => {
  console.log("Checking mamagerId of each employee job...");

  try {
    const result = await employeeModel.updateMany(
      {
        $or: [{ managerId: "false" }, { managerId: "" }]
      },
      { $set: { managerId: "900" } }
    );

    console.log(` ManagerId updated for ${result.modifiedCount} employees`);
  } catch (error) {
    console.error(" Error job:", error);
  }
});


// const mergeAttendance = async () => {
//   try {
//     const todayIST = moment().tz("Asia/Kolkata").startOf("day");
//     const todayEndUTC = todayIST.clone().endOf("day").subtract(5, "hours").subtract(30, "minutes").toDate();
//     const twoDaysAgoStartUTC = todayIST.clone().subtract(3, "days").subtract(5, "hours").subtract(30, "minutes").toDate();

//     const punchInAttendanceLogs = await AttendanceLogForOutDuty.find(
//       {
//         AttendanceDate: { $gte: twoDaysAgoStartUTC, $lt: todayEndUTC }
//       },
//       {
//         employeeId: 1,
//         AttendanceDate: 1,
//         InTime: 1,
//         OutTime: 1,
//         PunchRecords: 1
//       }
//     );

//     for (const punchLog of punchInAttendanceLogs) {
//       const { employeeId, AttendanceDate, InTime, OutTime, PunchRecords } = punchLog;

//       const existingMainLog = await AttendanceLogModel.findOne({
//         EmployeeCode: employeeId.toString(),
//         $expr: {
//           $and: [
//             { $eq: [{ $dayOfMonth: "$AttendanceDate" }, AttendanceDate.getUTCDate()] },
//             { $eq: [{ $month: "$AttendanceDate" }, AttendanceDate.getUTCMonth() + 1] },
//             { $eq: [{ $year: "$AttendanceDate" }, AttendanceDate.getUTCFullYear()] }
//           ]
//         }
//       });

//       if (!existingMainLog) {
//         console.warn(`No match for EmployeeCode ${employeeId} on ${AttendanceDate.toISOString().split("T")[0]}`);
//         continue;
//       }

//       // Merge PunchRecords with duplicates preserved and sorted
//       const combinedPunches = [
//         ...(existingMainLog.PunchRecords || "").split(","),
//         ...(PunchRecords || "").split(",")
//       ]
//         .filter(p => p && p.includes(":")) // remove empty entries
//         .sort((a, b) => {
//           const [h1, m1] = a.split(":");
//           const [h2, m2] = b.split(":");
//           return (h1 + m1).localeCompare(h2 + m2);
//         });

//       const mergedPunchRecords = combinedPunches.join(",") + (combinedPunches.length ? "," : "");

//       // Merge InTime and OutTime
//       const mergedInTime = moment.min(
//         moment(existingMainLog.InTime, "YYYY-MM-DD HH:mm:ss"),
//         moment(InTime, "YYYY-MM-DD HH:mm:ss")
//       ).format("YYYY-MM-DD HH:mm:ss");

//       const mergedOutTime = moment.max(
//         moment(existingMainLog.OutTime, "YYYY-MM-DD HH:mm:ss"),
//         moment(OutTime, "YYYY-MM-DD HH:mm:ss")
//       ).format("YYYY-MM-DD HH:mm:ss");

//       // Update main attendance log
//       await AttendanceLogModel.findByIdAndUpdate(
//         existingMainLog._id,
//         {
//           $set: {
//             PunchRecords: mergedPunchRecords,
//             InTime: mergedInTime,
//             OutTime: mergedOutTime,
//             Status: "Present"
//           }
//         },
//         { new: true }
//       );
//     }

//     console.log("Attendance logs merged successfully");
//   } catch (error) {
//     console.error(" Error updating attendance logs:", error);
//   }
// };


// Schedule cron job to run every 30 minutes
// cron.schedule("*/30 * * * *", () => {
//   console.log("Running mergeAttendance job at", new Date().toISOString());
//   mergeAttendance();
// });


const calculateAttendDuration = async (req, res) => {
  try {
    const todayIST = moment().tz("Asia/Kolkata").startOf("day");
    const todayEndUTC = todayIST.clone().endOf("day").subtract(5, "hours").subtract(30, "minutes").toDate();
    const twoDaysAgoStartUTC = todayIST.clone().subtract(3, "days").subtract(5, "hours").subtract(30, "minutes").toDate();

    const punchInAttendanceLogs = await AttendanceLogForOutDuty.find(
      {
        AttendanceDate: { $gte: twoDaysAgoStartUTC, $lt: todayEndUTC }
      },
      {
        employeeId: 1,
        PunchRecords: 1,
        Duration: 1
      }
    );
     
    for (const log of punchInAttendanceLogs) {
      const { _id, PunchRecords, employeeId } = log;

      // Determine if this employee works outside (default false)
      let isWorkOutside = false;
      try {
        const empDoc = await employeeModel.findOne({ employeeId: String(employeeId) }, { work_outside: 1 });
        isWorkOutside = !!(empDoc && empDoc.work_outside);
      } catch (e) {
        isWorkOutside = false;
      }

      let totalDuration = 0;

      if (PunchRecords && PunchRecords.trim() !== "") {
        const records = PunchRecords.split(",").filter(Boolean);
        const punches = records.map((entry) => {
          const type = entry.includes("in") ? "in" : "out";
          return { time: entry.slice(0, 5), type };
        });

        if (isWorkOutside) {
          // Use first IN to last OUT span
          let firstIn = null;
          let lastOut = null;
          for (const punch of punches) {
            if (punch.type === "in") {
              const t = moment(punch.time, "HH:mm");
              if (!firstIn || t.isBefore(firstIn)) firstIn = t;
            } else if (punch.type === "out") {
              const t = moment(punch.time, "HH:mm");
              if (!lastOut || t.isAfter(lastOut)) lastOut = t;
            }
          }
          if (firstIn && lastOut) {
            if (lastOut.isBefore(firstIn)) lastOut.add(1, "day");
            const span = lastOut.diff(firstIn, "minutes");
            totalDuration = span > 0 ? span : 0;
          }
        } else {
          // Existing behavior: sum of IN/OUT pairs
          let lastInTime = null;
          for (const punch of punches) {
            if (punch.type === "in") {
              lastInTime = punch.time;
            } else if (punch.type === "out" && lastInTime) {
              const inTime = moment(lastInTime, "HH:mm");
              const outTime = moment(punch.time, "HH:mm");
              if (outTime.isBefore(inTime)) {
                outTime.add(1, "day");
              }
              const duration = outTime.diff(inTime, "minutes");
              if (duration > 0) totalDuration += duration;
              lastInTime = null;
            }
          }
        }
      }

      await AttendanceLogForOutDuty.updateOne(
        { _id },
        { $set: { Duration: totalDuration } }
      );

      console.log(`Updated employee ${employeeId} - Duration: ${totalDuration} minutes (work_outside=${isWorkOutside})`);
    }

    // console.log("All durations calculated and updated.");
    
    if (res) {
      return res.status(200).json({
        statusCode: 200,
        statusValue: "SUCCESS",
        message: "Durations updated successfully"
      });
    }
  } catch (error) {
    console.error("Error calculating duration:", error);
    if (res) {
      return res.status(500).json({
        statusCode: 500,
        statusValue: "FAIL",
        message: "Internal server error"
      });
    }
  }
};

// Function to automatically punch out users at 18:15:00 IST
const autoPunchOutUsers = async () => {
  try {
    const todayIST = moment().tz("Asia/Kolkata").startOf("day");
    const todayEndUTC = todayIST.clone().endOf("day").subtract(5, "hours").subtract(30, "minutes").toDate();
    const todayStartUTC = todayIST.clone().subtract(5, "hours").subtract(30, "minutes").toDate();

    // Find all attendance logs for today that have InTime but no OutTime or empty OutTime
    const logsToUpdate = await AttendanceLogForOutDuty.find({
      AttendanceDate: { $gte: todayStartUTC, $lt: todayEndUTC },
      InTime: { $exists: true, $ne: "" },
      $or: [
        { OutTime: { $exists: false } },
        { OutTime: "" },
        { OutTime: { $regex: /^$/ } }
      ],
      PunchRecords: { $regex: /in\(IN\)/ } // Must have at least one punch in
    });

    console.log(`Found ${logsToUpdate.length} records to auto punch out`);

    const autoPunchOutTime = moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");
    const autoPunchOutEntry = "18:15:out(OUT),";

    for (const log of logsToUpdate) {
      try {
        // Check if the last punch is already an OUT punch
        const punchRecords = log.PunchRecords || "";
        const punchArray = punchRecords.split(',').filter(Boolean);
        const lastPunch = punchArray[punchArray.length - 1];

        // Only add OUT punch if the last punch is IN
        if (lastPunch && lastPunch.includes('in(IN)')) {
          const updatedPunchRecords = punchRecords + autoPunchOutEntry;
          
          // Calculate duration based on InTime and OutTime
          const inTime = moment(log.InTime, "YYYY-MM-DD HH:mm:ss");
          const outTime = moment(autoPunchOutTime, "YYYY-MM-DD HH:mm:ss");
          const newDuration = outTime.diff(inTime, "minutes");
          
          await AttendanceLogForOutDuty.findByIdAndUpdate(
            log._id,
            {
              $set: {
                OutTime: autoPunchOutTime,
                PunchRecords: updatedPunchRecords,
                Duration: newDuration,
                updatedAt: new Date()
              }
            },
            { new: true }
          );

          console.log(`Auto punched out employee ${log.employeeId} at ${autoPunchOutTime}, Duration: ${newDuration} minutes`);
        }
      } catch (error) {
        console.error(`Error auto punching out employee ${log.employeeId}:`, error);
      }
    }

    console.log(`Auto punch out completed for ${logsToUpdate.length} employees`);
  } catch (error) {
    console.error("Error in autoPunchOutUsers:", error);
    throw error;
  }
};


// Recalculate Duration for main AttendanceLogModel respecting work_outside (async, batched)
const recalcMainAttendanceDuration = async (req, res) => {
  try {
    const { previousDate, currentDate, employeeIds } = req.body || {};

    // Respond immediately and run job in background
    if (res) {
      res.status(202).json({
        statusCode: 202,
        statusValue: "ACCEPTED",
        message: "Recalculation started in background"
      });
    }

    // Compute date range in UTC based on IST inputs
    let startUTC;
    let endUTC;
    if (previousDate && currentDate) {
      const start = moment.tz(previousDate, "Asia/Kolkata").startOf("day");
      const end = moment.tz(currentDate, "Asia/Kolkata").endOf("day");
      startUTC = start.clone().subtract(5, "hours").subtract(30, "minutes").toDate();
      endUTC = end.clone().subtract(5, "hours").subtract(30, "minutes").toDate();
    } else {
      const todayIST = moment().tz("Asia/Kolkata").startOf("day");
      endUTC = todayIST.clone().endOf("day").subtract(5, "hours").subtract(30, "minutes").toDate();
      startUTC = todayIST.clone().subtract(7, "days").subtract(5, "hours").subtract(30, "minutes").toDate();
    }

    const query = { AttendanceDate: { $gte: startUTC, $lte: endUTC } };
    if (Array.isArray(employeeIds) && employeeIds.length) {
      query.EmployeeCode = { $in: employeeIds.map(String) };
    }

    const projection = { _id: 1, EmployeeCode: 1, PunchRecords: 1 };
    const logs = await AttendanceLogModel.find(query, projection).lean();

    if (!logs.length) return;

    // Cache work_outside flags in one query
    const uniqueEmpIds = Array.from(new Set(logs.map(l => String(l.EmployeeCode || "")).filter(Boolean)));
    const empDocs = await employeeModel.find({ employeeId: { $in: uniqueEmpIds } }, { employeeId: 1, work_outside: 1 }).lean();
    const empFlag = new Map(empDocs.map(e => [String(e.employeeId), !!e.work_outside]));

    // Helper to compute duration per record
    const computeDuration = (record) => {
      const empId = String(record.EmployeeCode || "");
      const isWorkOutside = !!empFlag.get(empId);
      let totalDuration = 0;
      const pr = record.PunchRecords || "";
      if (pr && pr.trim() !== "") {
        const punches = pr
          .split(",")
          .filter((p) => p.trim() !== "")
          .map((entry) => ({ type: entry.includes("in") ? "in" : "out", time: entry.slice(0, 5) }));
        if (isWorkOutside) {
          let firstIn = null; let lastOut = null;
          for (const p of punches) {
            if (p.type === "in") {
              const t = moment(p.time, "HH:mm");
              if (!firstIn || t.isBefore(firstIn)) firstIn = t;
            } else if (p.type === "out") {
              const t = moment(p.time, "HH:mm");
              if (!lastOut || t.isAfter(lastOut)) lastOut = t;
            }
          }
          if (firstIn && lastOut) {
            if (lastOut.isBefore(firstIn)) lastOut.add(1, "day");
            const span = lastOut.diff(firstIn, "minutes");
            totalDuration = span > 0 ? span : 0;
          }
        } else {
          let lastInTime = null;
          for (const p of punches) {
            if (p.type === "in") lastInTime = p.time; else if (p.type === "out" && lastInTime) {
              const inTime = moment(lastInTime, "HH:mm");
              const outTime = moment(p.time, "HH:mm");
              if (outTime.isBefore(inTime)) outTime.add(1, "day");
              const dur = outTime.diff(inTime, "minutes");
              if (dur > 0) totalDuration += dur;
              lastInTime = null;
            }
          }
        }
      }
      return totalDuration;
    };

    // Batch updates with bulkWrite
    const BATCH_SIZE = 500;
    for (let i = 0; i < logs.length; i += BATCH_SIZE) {
      const batch = logs.slice(i, i + BATCH_SIZE);
      const ops = batch.map((rec) => ({
        updateOne: {
          filter: { _id: rec._id },
          update: { $set: { Duration: computeDuration(rec) } }
        }
      }));
      if (ops.length) {
        await AttendanceLogModel.bulkWrite(ops, { ordered: false });
      }
    }
  } catch (error) {
    console.error("Error recalculating main attendance durations:", error);
  }
};

const normalizeEmployeeCodes = async () => {
  try {
    const employees = await AttendanceLogModel.find({
      EmployeeCode: { $regex: /^(CON|GD)\d+/ }
    });

    for (const emp of employees) {
      let newCode = emp.EmployeeCode;

      if (emp.EmployeeCode.startsWith("CON")) {
        const numericPart = emp.EmployeeCode.replace("CON", "");
        newCode = `5${numericPart}`;
      } else if (emp.EmployeeCode.startsWith("GD")) {
        const numericPart = emp.EmployeeCode.replace("GD", "");
        newCode = `8${numericPart}`;
      }

      // Update all matching docs
      await AttendanceLogModel.updateMany(
        { EmployeeCode: emp.EmployeeCode },
        { $set: { EmployeeCode: newCode } }
      );
    }

  } catch (error) {
    console.error("Error calculating duration:", error);
  }
};


// Schedule cron job to run every 30 minutes
cron.schedule("*/30 * * * *", () => {
  console.log("EmployeeCode values updated successfully");
  normalizeEmployeeCodes();
});

// Schedule cron job to automatically punch out users at 18:15:00 IST
cron.schedule("15 18 * * *", async () => {
  console.log("Running automatic punch out job at 18:15:00 IST...");
  try {
    await autoPunchOutUsers();
    console.log("Automatic punch out job completed successfully");
  } catch (error) {
    console.error("Error in automatic punch out job:", error);
  }
});

// Manual endpoint to trigger auto punch out (for testing)
app.post("/api/auto-punch-out", async (req, res) => {
  try {
    console.log("Manual auto punch out triggered...");
    await autoPunchOutUsers();
    res.status(200).json({
      message: "Auto punch out completed successfully",
      statusCode: 200,
      statusValue: "success"
    });
  } catch (error) {
    console.error("Error in manual auto punch out:", error);
    res.status(500).json({
      message: "Internal Server Error",
      statusCode: 500,
      statusValue: "error"
    });
  }
});

// Function to fix existing records with 23:59:00 OutTime
const fixExistingRecords = async () => {
  try {
    console.log("Fixing existing records with 23:59:00 OutTime...");
    
    // Find records with OutTime set to 23:59:00 that have only IN punch
    const recordsToFix = await AttendanceLogForOutDuty.find({
      OutTime: { $regex: /23:59:00/ },
      PunchRecords: { $regex: /in\(IN\)/ },
      $expr: {
        $not: { $regexMatch: { input: "$PunchRecords", regex: /out\(OUT\)/ } }
      }
    });

    console.log(`Found ${recordsToFix.length} records to fix`);

    for (const record of recordsToFix) {
      try {
        // Extract the date from InTime
        const inTimeDate = moment(record.InTime, "YYYY-MM-DD HH:mm:ss").format("YYYY-MM-DD");
        const fixedOutTime = `${inTimeDate} 18:15:00`;
        const fixedPunchRecords = record.PunchRecords + "18:15:out(OUT),";

        // Calculate new duration based on InTime and fixed OutTime
        const inTime = moment(record.InTime, "YYYY-MM-DD HH:mm:ss");
        const outTime = moment(fixedOutTime, "YYYY-MM-DD HH:mm:ss");
        const newDuration = outTime.diff(inTime, "minutes");

        await AttendanceLogForOutDuty.findByIdAndUpdate(
          record._id,
          {
            $set: {
              OutTime: fixedOutTime,
              PunchRecords: fixedPunchRecords,
              Duration: newDuration,
              updatedAt: new Date()
            }
          },
          { new: true }
        );

        console.log(`Fixed record for employee ${record.employeeId}: OutTime changed from 23:59:00 to 18:15:00, Duration updated to ${newDuration} minutes`);
      } catch (error) {
        console.error(`Error fixing record for employee ${record.employeeId}:`, error);
      }
    }

    console.log(`Fixed ${recordsToFix.length} existing records with updated durations`);
  } catch (error) {
    console.error("Error in fixExistingRecords:", error);
    throw error;
  }
};

// Manual endpoint to fix existing records
app.post("/api/fix-existing-records", async (req, res) => {
  try {
    console.log("Manual fix existing records triggered...");
    await fixExistingRecords();
    res.status(200).json({
      message: "Existing records fixed successfully",
      statusCode: 200,
      statusValue: "success"
    });
  } catch (error) {
    console.error("Error in fix existing records:", error);
    res.status(500).json({
      message: "Internal Server Error",
      statusCode: 500,
      statusValue: "error"
    });
  }
});

// Function to recalculate durations for records with 18:15:00 OutTime
const recalculateDurations = async () => {
  try {
    console.log("Recalculating durations for records with 18:15:00 OutTime...");
    
    // Find records with OutTime set to 18:15:00
    const recordsToRecalculate = await AttendanceLogForOutDuty.find({
      OutTime: { $regex: /18:15:00/ },
      InTime: { $exists: true, $ne: "" }
    });

    console.log(`Found ${recordsToRecalculate.length} records to recalculate`);

    for (const record of recordsToRecalculate) {
      try {
        // Calculate duration based on InTime and OutTime
        const inTime = moment(record.InTime, "YYYY-MM-DD HH:mm:ss");
        const outTime = moment(record.OutTime, "YYYY-MM-DD HH:mm:ss");
        const newDuration = outTime.diff(inTime, "minutes");

        await AttendanceLogForOutDuty.findByIdAndUpdate(
          record._id,
          {
            $set: {
              Duration: newDuration,
              updatedAt: new Date()
            }
          },
          { new: true }
        );

        console.log(`Recalculated duration for employee ${record.employeeId}: ${newDuration} minutes`);
      } catch (error) {
        console.error(`Error recalculating duration for employee ${record.employeeId}:`, error);
      }
    }

    console.log(`Recalculated durations for ${recordsToRecalculate.length} records`);
  } catch (error) {
    console.error("Error in recalculateDurations:", error);
    throw error;
  }
};

// Manual endpoint to recalculate durations
app.post("/api/recalculate-durations", async (req, res) => {
  try {
    console.log("Manual recalculate durations triggered...");
    await recalculateDurations();
    res.status(200).json({
      message: "Durations recalculated successfully",
      statusCode: 200,
      statusValue: "success"
    });
  } catch (error) {
    console.error("Error in recalculate durations:", error);
    res.status(500).json({
      message: "Internal Server Error",
      statusCode: 500,
      statusValue: "error"
    });
  }
});

// Function to undo auto punch outs (remove the 18:15:out(OUT) entry and clear OutTime)
const undoAutoPunchOuts = async () => {
  try {
    console.log("Undoing auto punch outs...");
    
    // Find records that were auto punched out today (with 18:15:out(OUT) in PunchRecords)
    const todayIST = moment().tz("Asia/Kolkata").startOf("day");
    const todayEndUTC = todayIST.clone().endOf("day").subtract(5, "hours").subtract(30, "minutes").toDate();
    const todayStartUTC = todayIST.clone().subtract(5, "hours").subtract(30, "minutes").toDate();

    const recordsToUndo = await AttendanceLogForOutDuty.find({
      AttendanceDate: { $gte: todayStartUTC, $lt: todayEndUTC },
      PunchRecords: { $regex: /18:15:out\(OUT\)/ },
      OutTime: { $regex: /18:15:00/ }
    });

    console.log(`Found ${recordsToUndo.length} records to undo auto punch out`);

    for (const record of recordsToUndo) {
      try {
        // Remove the 18:15:out(OUT), from PunchRecords
        const updatedPunchRecords = record.PunchRecords.replace(/18:15:out\(OUT\),/, '');
        
        await AttendanceLogForOutDuty.findByIdAndUpdate(
          record._id,
          {
            $set: {
              OutTime: "",
              PunchRecords: updatedPunchRecords,
              Duration: 0, // Reset duration since they're still working
              updatedAt: new Date()
            }
          },
          { new: true }
        );

        console.log(`Undid auto punch out for employee ${record.employeeId} - they are now punched in again`);
      } catch (error) {
        console.error(`Error undoing auto punch out for employee ${record.employeeId}:`, error);
      }
    }

    console.log(`Undid auto punch outs for ${recordsToUndo.length} employees`);
  } catch (error) {
    console.error("Error in undoAutoPunchOuts:", error);
    throw error;
  }
};

// Manual endpoint to undo auto punch outs
app.post("/api/undo-auto-punch-outs", async (req, res) => {
  try {
    console.log("Manual undo auto punch outs triggered...");
    await undoAutoPunchOuts();
    res.status(200).json({
      message: "Auto punch outs undone successfully - employees are punched in again",
      statusCode: 200,
      statusValue: "success"
    });
  } catch (error) {
    console.error("Error in undo auto punch outs:", error);
    res.status(500).json({
      message: "Internal Server Error",
      statusCode: 500,
      statusValue: "error"
    });
  }
});

// Function to recalculate effective hours for all attendance records (optimized)
const recalculateAllEffectiveHours = async () => {
  try {
    console.log("Recalculating effective hours for all attendance records...");
    
    // 1. Recalculate main attendance records in batches
    console.log("Processing main attendance records...");
    const BATCH_SIZE = 100;
    let mainProcessed = 0;
    let mainSkipped = 0;
    
    const mainCount = await AttendanceLogModel.countDocuments({
      InTime: { $exists: true, $ne: "", $ne: "1900-01-01 00:00:00" },
      OutTime: { $exists: true, $ne: "", $ne: "1900-01-01 00:00:00" }
    });
    
    console.log(`Found ${mainCount} main attendance records to recalculate`);

    for (let skip = 0; skip < mainCount; skip += BATCH_SIZE) {
      const mainRecords = await AttendanceLogModel.find({
        InTime: { $exists: true, $ne: "", $ne: "1900-01-01 00:00:00" },
        OutTime: { $exists: true, $ne: "", $ne: "1900-01-01 00:00:00" }
      }).skip(skip).limit(BATCH_SIZE).lean();

      const bulkOps = [];
      
      for (const record of mainRecords) {
        try {
          // Calculate duration from InTime and OutTime
          const inTime = moment(record.InTime, "YYYY-MM-DD HH:mm:ss");
          const outTime = moment(record.OutTime, "YYYY-MM-DD HH:mm:ss");
          
          // Skip if dates are invalid
          if (!inTime.isValid() || !outTime.isValid()) {
            mainSkipped++;
            continue;
          }
          
          const duration = outTime.diff(inTime, "minutes");
          
          // Only update if duration is reasonable (between 0 and 1440 minutes = 24 hours)
          if (duration >= 0 && duration <= 1440) {
            bulkOps.push({
              updateOne: {
                filter: { _id: record._id },
                update: {
                  $set: {
                    Duration: duration,
                    updatedAt: new Date()
                  }
                }
              }
            });
          } else {
            mainSkipped++;
          }
        } catch (error) {
          console.error(`Error processing main record ${record._id}:`, error);
          mainSkipped++;
        }
      }

      if (bulkOps.length > 0) {
        await AttendanceLogModel.bulkWrite(bulkOps);
        mainProcessed += bulkOps.length;
        console.log(`Processed ${mainProcessed}/${mainCount} main records...`);
      }
    }

    // 2. Recalculate out-duty records in batches
    console.log("Processing out-duty records...");
    let outDutyProcessed = 0;
    let outDutySkipped = 0;
    
    const outDutyCount = await AttendanceLogForOutDuty.countDocuments({
      InTime: { $exists: true, $ne: "" },
      OutTime: { $exists: true, $ne: "" }
    });
    
    console.log(`Found ${outDutyCount} out-duty records to recalculate`);

    for (let skip = 0; skip < outDutyCount; skip += BATCH_SIZE) {
      const outDutyRecords = await AttendanceLogForOutDuty.find({
        InTime: { $exists: true, $ne: "" },
        OutTime: { $exists: true, $ne: "" }
      }).skip(skip).limit(BATCH_SIZE).lean();

      const bulkOps = [];
      
      for (const record of outDutyRecords) {
        try {
          // Calculate duration from InTime and OutTime
          const inTime = moment(record.InTime, "YYYY-MM-DD HH:mm:ss");
          const outTime = moment(record.OutTime, "YYYY-MM-DD HH:mm:ss");
          
          // Skip if dates are invalid
          if (!inTime.isValid() || !outTime.isValid()) {
            outDutySkipped++;
            continue;
          }
          
          const duration = outTime.diff(inTime, "minutes");
          
          // Only update if duration is reasonable (between 0 and 1440 minutes = 24 hours)
          if (duration >= 0 && duration <= 1440) {
            bulkOps.push({
              updateOne: {
                filter: { _id: record._id },
                update: {
                  $set: {
                    Duration: duration,
                    updatedAt: new Date()
                  }
                }
              }
            });
          } else {
            outDutySkipped++;
          }
        } catch (error) {
          console.error(`Error processing out-duty record ${record._id}:`, error);
          outDutySkipped++;
        }
      }

      if (bulkOps.length > 0) {
        await AttendanceLogForOutDuty.bulkWrite(bulkOps);
        outDutyProcessed += bulkOps.length;
        console.log(`Processed ${outDutyProcessed}/${outDutyCount} out-duty records...`);
      }
    }

    console.log(`Recalculation completed: ${mainProcessed} main records and ${outDutyProcessed} out-duty records updated. Skipped: ${mainSkipped} main, ${outDutySkipped} out-duty`);
  } catch (error) {
    console.error("Error in recalculateAllEffectiveHours:", error);
    throw error;
  }
};

// Manual endpoint to recalculate all effective hours (runs in background)
app.post("/api/recalculate-all-effective-hours", async (req, res) => {
  try {
    console.log("Manual recalculate all effective hours triggered...");
    
    // Respond immediately and run job in background
    res.status(202).json({
      message: "Effective hours recalculation started in background",
      statusCode: 202,
      statusValue: "ACCEPTED"
    });
    
    // Run the recalculation in background
    recalculateAllEffectiveHours().catch(error => {
      console.error("Background effective hours recalculation failed:", error);
    });
    
  } catch (error) {
    console.error("Error starting effective hours recalculation:", error);
    res.status(500).json({
      message: "Internal Server Error",
      statusCode: 500,
      statusValue: "error"
    });
  }
});

const normalizeLeaveHistoryEmployeeIds = async () => {
  try {
    // Find docs where employeeId starts with "CON"
    const leaves = await leaveTakenHistoryModel.find({
      employeeId: { $regex: /^CON\d+/ }
    });

    for (const leave of leaves) {
      const numericPart = leave.employeeId.replace("CON", "");
      const newId = `5${numericPart}`;

      await leaveTakenHistoryModel.updateMany(
        { employeeId: leave.employeeId },
        { $set: { employeeId: newId } }
      );
    }

    // console.log("employeeId values normalized successfully in leaveTakenHistoryModel.");

  } catch (error) {
    console.error("Error normalizing leaveTakenHistoryModel employeeIds:", error);
  }
};

// Run it once
// normalizeLeaveHistoryEmployeeIds();
// Schedule cron job to run every 30 minutes
cron.schedule("*/30 * * * *", () => {
  console.log("EemployeeId values normalized successfully in leaveTakenHistoryModel.");
  normalizeLeaveHistoryEmployeeIds();
});



// Normalize employee IDs across multiple collections
async function normalizeEmployeeIds() {
  try {
    const collections = [
      { model: employeeModel, name: "Employee" },
      { model: leaveTakenHistoryModel, name: "LeaveTakenHistory" },
      { model: trackolapAttendanceModel, name: "TrackolapAttendance" },
      { model: CompOff, name: "CompOff" },
      { model: AttendanceLogForOutDuty, name: "AttendanceLogOutDuty" }
    ];

    for (const { model, name } of collections) {
      // Only fetch employeeId field to avoid touching others
      const records = await model.find(
        { employeeId: { $regex: /^(CON|GD)\d+$/ } },
        { employeeId: 1 } // projection
      );

      if (!records.length) {
        console.log(`[Normalize] ${name}: No records found.`);
        continue;
      }

      const bulkOps = records
        .map((rec) => {
          let newCode = rec.employeeId;

          if (rec.employeeId.startsWith("CON")) {
            newCode = `5${rec.employeeId.slice(3)}`;
          } else if (rec.employeeId.startsWith("GD")) {
            newCode = `8${rec.employeeId.slice(2)}`;
          }

          // Skip if already normalized
          if (newCode === rec.employeeId) return null;

          return {
            updateOne: {
              filter: { employeeId: rec.employeeId },
              update: { $set: { employeeId: newCode } }
            }
          };
        })
        .filter(Boolean);

      if (!bulkOps.length) {
        console.log(`[Normalize] ${name}: All IDs already normalized.`);
        continue;
      }

      const result = await model.bulkWrite(bulkOps, { ordered: false });
      console.log(`[Normalize] ${name}: ${result.modifiedCount} IDs updated.`);
    }
  } catch (error) {
    console.error("[Normalize] Error normalizing employee IDs:", error);
    throw error;
  }
}


// Schedule cron job to run every 30 minutes (configurable)
const CRON_EXPR = process.env.NORMALIZE_CRON || "15 23 * * *";

cron.schedule(CRON_EXPR, async () => {
  console.log("[Cron] Running employeeId normalization job...");
  try {
    await normalizeEmployeeIds();
    console.log("[Cron] EmployeeCode values updated successfully");
  } catch (error) {
    console.error("[Cron] Error running normalization job ", error);
  }
});


const findEmployeesWith50xxAnd80xx = async () => {
  try {
    const employees = await employeeModel.find({
      employeeId: {
        $regex: /^(50|80)\d{2}$/, // starts with 50 or 80 and exactly 4 digits total
      },
    });

    if (employees.length === 0) {
      console.log("No employees found with employeeId starting 50xx or 80xx");
    } else {
      console.log("Employees with employeeId 50xx or 80xx (4 digits only):");
      console.table(
        employees.map(e => ({
          employeeId: e.employeeId,
          employeeName: e.employeeName,
          departmentId: e.departmentId,
          designation: e.designation,
        }))
      );
    }

    return employees;
  } catch (error) {
    console.error("Error finding employees:", error);
    throw error;
  }
};

// findEmployeesWith50xxAnd80xx()


// cron.schedule("*/10 * * * *", async () => {
//   console.log("[Cron] Running mergeAttendance job...");
//   try {
//     await mergeAttendance();
//     console.log("[Cron] mergeAttendance job completed.");
//   } catch (err) {
//     console.error("[Cron] Error in mergeAttendance job:", err);
//   }
// });



// const { findAndCreateAttendanceLog, removeDuplicateAttendanceLogs, findCommonAttendanceAndUpdate } = require("./utils/attendanceMerger");
// const leaveTakenHistoryModel = require("./models/leaveTakenHistoryModel.js");

// cron.schedule("0 10 * * *", async () => {
//   try {
//     console.log("[Cron] 10:00 AM IST job started...");
//      await findAndCreateAttendanceLog();
//     await removeDuplicateAttendanceLogs();
//     console.log("[Cron] 10:00 AM IST job completed.");
//   } catch (err) {
//     console.error("[Cron] Error running 10:00 AM IST job:", err);
//   }
// });

// cron.schedule("0 12 * * *", async () => {
//   try {
//     console.log("[Cron] 10:00 AM IST job started...");
//      await findAndCreateAttendanceLog();
//      await removeDuplicateAttendanceLogs();
//     console.log("[Cron] 10:00 AM IST job completed.");
//   } catch (err) {
//     console.error("[Cron] Error running 10:00 AM IST job:", err);
//   }
// });


// cron.schedule("0 17 * * *", async () => {
//   try {
//     console.log("[Cron] 7:00 PM IST job started...");
//     await findCommonAttendanceAndUpdate();
//     console.log("[Cron] 7:00 PM IST job completed.");
//   } catch (err) {
//     console.error("[Cron] Error running 7:00 PM IST job:", err);
//   }
// });


// (async () => {
//   try {
//     console.log("[Manual] Job started...");
//     await findCommonAttendanceAndUpdate();
//     console.log("[Manual] Job completed.");
//   } catch (err) {
//     console.error("[Manual] Error running job:", err);
//   }
// })();




app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Swagger API Docs available at http://localhost:${PORT}/api-docs`);
});

// Endpoint to trigger main attendance duration recalculation
app.post('/api/recalc-main-attendance', recalcMainAttendanceDuration);
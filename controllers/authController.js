const express = require("express");
const mongoose = require("mongoose");
const employeeModel = require("../models/employeeModel");
const DeletedEmployee = require("../models/deletedEmployeeModel");
const redisClient = require("../config/redisClient");
// console.log(redisClient)
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const blacklist = require("../utils/blacklist");
const departmentModel = require("../models/departmentModel");
// console.log(process.env.JWT_SECRET)
const bcrypt = require('bcrypt');
const leaveTakenHistoryModel = require("../models/leaveTakenHistoryModel");
const {sendOtp} = require("../helper/sendOtp");
const CompOff = require("../models/compOffHistoryModel");



const registerEmployee = async (req, res) => {
    try {
        const {
            employeeId,
            employeeName,
            employeeCode,
            gender,
            departmentId,
            designation,
            doj,
            employeeCodeInDevice,
            employmentType,
            employeeStatus,
            accountStatus,
            fatherName,
            motherName,
            residentialAddress,
            permanentAddress,
            contactNo,
            email,
            dob,
            placeOfBirth,
            bloodGroup,
            workPlace,
            aadhaarNumber,
            employeePhoto,
            masterDeviceId,
            maritalStatus,
            nationality,
            overallExperience,
            qualifications,
            emergencyContact,
            managerId,
            teamLeadId,
            // leaveBalance,
            role,
            shiftTime,
            loginPassword,
            pancardNo,
            workingDays
        } = req.body;
        // console.log(1111, req.body)
        if ((!email || email == "" || email == null) && (!employeeId || employeeId == "" || employeeId == null)) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Validation error! || EmployeeId and email are required.",
            });
        } else {
            const isUserExists = await employeeModel.findOne({ $or: [{ email: email }, { employeeId: employeeId }] })
            if (isUserExists) {
                return res.status(403).json({  
                    statusCode: 403,
                    statusValue: "FAIL",
                    message: "User email or employeeId already exists."
                });
            }
            const newEmployee = new employeeModel({
                employeeId:employeeId ? employeeId : "NA",
                employeeName:employeeName ? employeeName : "NA",
                employeeCode: employeeCode ? employeeCode : "NA",
                gender: gender ? gender : "NA",
                departmentId : departmentId ? departmentId : 0,
                designation : designation ? designation : "NA",  
                doj: doj ? doj : "NA",
                employeeCodeInDevice : employeeCodeInDevice ? employeeCodeInDevice : "NA",
                employmentType : employmentType ? employmentType : "NA",
                employeeStatus : employeeStatus ? employeeStatus : "Working",
                accountStatus : accountStatus ? accountStatus : "Active",
                fatherName : fatherName ? fatherName : "NA",
                motherName : motherName ? motherName : "NA",
                residentialAddress : residentialAddress ? residentialAddress : "NA",
                permanentAddress : permanentAddress ? permanentAddress : "NA",
                contactNo : contactNo ? contactNo : "NA",
                email,
                dob,
                placeOfBirth : placeOfBirth ? placeOfBirth : "NA",
                bloodGroup : bloodGroup ? bloodGroup : "NA",
                workPlace : workPlace ? workPlace : "NA",
                aadhaarNumber : aadhaarNumber ? aadhaarNumber : "NA",
                employeePhoto : employeePhoto ? employeePhoto : "NA",
                masterDeviceId: masterDeviceId ? masterDeviceId : 0,
                maritalStatus : maritalStatus ? maritalStatus : "NA",
                nationality : nationality ? nationality : "NA",
                overallExperience : overallExperience ? overallExperience : "NA",
                qualifications : qualifications ? qualifications : "NA",
                emergencyContact : emergencyContact ? emergencyContact : "NA",
                managerId : managerId ? managerId : "NA",
                teamLeadId : teamLeadId ? teamLeadId : "NA",
                // leaveBalance,
                role : role ? role : "Employee",
                shiftTime,
                loginPassword : loginPassword ? loginPassword : "12345",
                workingDays: workingDays ? workingDays : "5",
                pancardNo: pancardNo ? pancardNo : "NA"
            });
            //   console.log('body-data',req.body)
            const savedEmployee = await newEmployee.save();  
            return res.status(201).json({
                statusCode: 201,
                statusValue: "SUCCESS",
                message: "Employee added successfully",  
                data: savedEmployee,
            });
        }
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Validation error",
                error: error.message,
            });
        }
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Error adding employee",
            error: error.message,
        });
    }
};

const employeeLogin = async (req, res) => {
    try {
        const schema = Joi.object({
            email: Joi.string().required(),
            password: Joi.string().required(),
        });
        let result = schema.validate(req.body);
        if (result.error) {
            return res.status(200).json({
                status: 0,
                statusCode: 400,
                message: result.error.details[0].message,
            });
        }

        // Find user by email
        const employee = await employeeModel.findOne({ $or:[{email: req.body.email},{employeeId:req.body.email}], accountStatus:"Active" });
        // console.log(employee)
        if (!employee) {
            return res.status(404).json(
                { 
                    statusCode:400,
                    statusValue: "FAIL",
                    message: "User not found" 
                }
            );
        }

        // Compare password
        const isMatch = await employee.comparePassword(req.body.password);
        if (!isMatch) {
            return res.status(401).json({ 
                statusCode:400,
                statusValue: "FAIL",
                message: "Invalid credentials." 
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { employeeId: employee.employeeId, role: employee.role },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );
        
        // dept data
         // Fetch department data based on employee's departmentId
        // const deptData = await departmentModel.findOne({ departmentId: employee.departmentId });
        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Login successful",
            token,
            data: {
                employeeId: employee.employeeId,
                employeeName: employee.employeeName,
                role: employee.role,
                email: employee.email,
                contactNo: employee.contactNo,
                designation:employee.designation,
                gender:employee.gender,
                // departmentName: deptData.departmentName || "Department not assigned",
                token,
            },
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Error in login.",
            error: error.message,
        });
    }
};

const logout = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(400).json({ message: "No token provided" });
        }

        // Add token to blacklist
        blacklist.add(token);

        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Logout successful",
        });
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Error in logout.",
            error: error.message,
        });
    }
};


const updateEmployeeById = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const updateData = { ...req.body };

    if (!employeeId) {
      return res.status(400).json({
        statusCode: 400,
        statusValue: "FAIL",
        message: "Employee ID is required",
      });
    }

    const restrictedFields = ["email", "employeeId", "loginPassword"];
    restrictedFields.forEach((field) => delete updateData[field]);

    const empDetails = await employeeModel.findOne({ employeeId });

    if (!empDetails) {
      return res.status(404).json({
        statusCode: 404,
        statusValue: "FAIL",
        message: "Employee not found",
      });
    }

    // Flatten nested updates for leaveBalance
    const nestedUpdateFields = {};

    if (updateData.shiftTime) {
      Object.keys(updateData.shiftTime).forEach(key => {
        nestedUpdateFields[`shiftTime.${key}`] = updateData.shiftTime[key];
      });
      delete updateData.shiftTime;
    }

    if (updateData.leaveBalance) {
      Object.keys(updateData.leaveBalance).forEach(key => {
        nestedUpdateFields[`leaveBalance.${key}`] = updateData.leaveBalance[key];
      });
      delete updateData.leaveBalance;
    }

    // Merge flat fields and nested fields
    const finalUpdateData = { ...updateData, ...nestedUpdateFields };

    const updatedEmployee = await employeeModel.findOneAndUpdate(
      { employeeId },
      { $set: finalUpdateData },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      statusCode: 200,
      statusValue: "SUCCESS",
      message: "Employee updated successfully",
      data: updatedEmployee,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      statusValue: "FAIL",
      message: "Error updating employee",
      error: error.message,
    });
  }
};



const getEmployeeListByManagerId = async (req, res) => {
    try {
        
        // Extract pagination parameters from the request query
        const { page = 1, limit = 50 } = req.query;
        // Ensure `page` and `limit` are integers
        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);
        
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Token is required",
            });
        }
        
        // Decode the token to get employee details
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Invalid token",
            });
        }
        if (decoded.role === "Super-Admin" || decoded.role === "HR-Admin") {
            // Calculate the total number of employees
            const totalCount = await employeeModel.countDocuments({});

            if (totalCount === 0) {
                return res.status(404).json({
                    statusCode: 404,
                    statusValue: "FAIL",
                    message: "No employees found.",
                });
            }
             
            // Calculate total pages
            const totalPages = Math.ceil(totalCount / limitNumber);
             
            // Retrieve paginated employee records
            const employees = await employeeModel
                .find({accountStatus:"Active"})
                .skip((pageNumber - 1) * limitNumber)
                .limit(limitNumber);

            // Success response
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Employee list retrieved successfully.",
                data: employees,
                totalRecords: totalCount,
                totalPages,
                currentPage: pageNumber,
                limit: limitNumber,
            });
        }
        
        // Calculate the total number of employees
        const totalCount = await employeeModel.countDocuments({managerId: decoded.employeeId});

        if (totalCount === 0) {
            return res.status(404).json({
                statusCode: 404,
                statusValue: "FAIL",
                message: "No employees found.",
            });
        }

        // Calculate total pages
        const totalPages = Math.ceil(totalCount / limitNumber);

        // Retrieve paginated employee records
        const employees = await employeeModel
            .find({$and:[{managerId:decoded.employeeId},{accountStatus:"Active"}]})
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber);

        // Success response
        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Employee list retrieved successfully.",
            data: employees,
            totalRecords: totalCount,
            totalPages,
            currentPage: pageNumber,
            limit: limitNumber,
        });
    } catch (error) {
        console.error(error);

        // Error response
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Error retrieving employee list.",
            error: error.message,
        });
    }
};


const getAllEmployeeList = async (req, res) => {
    try {
        // Extract pagination parameters from the request query
        const { page = 1, limit = 10 } = req.query;
        const secretKey = "KN8Ehf?zG,J*>:v;6Y!~F%";
        const { key } = req.body;

        // if (!key || key !== secretKey ) {
        //     return res.status(404).json({
        //         statusCode: 404,
        //         statusValue: "FAIL",
        //         message: "Error! key is required! || Wrong key provided!",
        //     });
        // }

        // Ensure `page` and `limit` are integers
        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);

        // Calculate the total number of employees
        const totalCount = await employeeModel.countDocuments();

        if (totalCount === 0) {
            return res.status(404).json({ 
                statusCode: 404,
                statusValue: "FAIL",
                message: "No employees found.",
            });
        }
        
        // Calculate total pages
        const totalPages = Math.ceil(totalCount / limitNumber);
        
        // Retrieve paginated employee records
        const employees = await employeeModel
            .find({accountStatus:"Active"})
            .skip((pageNumber - 1) * limitNumber)
            .limit(limitNumber);
 
        // Success response
        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Employee list retrieved successfully.",
            data: employees,
            totalRecords: totalCount,
            totalPages,
            currentPage: pageNumber,
            limit: limitNumber,
        });
    } catch (error) {
        console.error(error);

        // Error response
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Error retrieving employee list.",
            error: error.message,
        });
    }
};


const getEmpDetailsById = async (req, res) => {
    try {
        const { employeeId } = req.params;

        if (!employeeId) {
        return res.status(404).json({
            statusCode: 404,
            statusValue: "FAIL",
            message: "No employees found.",
        });
        }

        let searchId = employeeId;

        // If starts with "CON" or "con", strip prefix
        if (/^con/i.test(employeeId)) {
        searchId = employeeId.replace(/^con/i, ""); // remove 'CON' prefix
        }

        // Build search condition for either employeeId or employeeCode
        const query = {
        $or: [
            { employeeId: String(searchId) },
            { employeeCode: String(searchId) }
        ]
        };

        const employeeDoc = await employeeModel.findOne(query, { __v: 0 });
        if (employeeDoc) {
            const compOffData = await CompOff.find({employeeId:req.params.employeeId, status:"Approved"})
            const compOffSum = compOffData.reduce((acc, curr) => {
                return { appliedCompOff: acc.appliedCompOff + parseFloat(curr.totalDays) }
            }, {appliedCompOff: 0})
            // Convert mongoose document to plain object
            
           const empDetails = await employeeModel.findOne({employeeId:employeeDoc.managerId},{employeeName:1})
        //    console.log(11, empDetails)

            const employee = employeeDoc.toObject();
            employee.leaveBalance.appliedCompOff = compOffSum.appliedCompOff.toString();
            employee.managerId = empDetails.employeeName ? empDetails.employeeName : "";
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Employee list retrieved successfully.",
                data: employee
            });
        }
        // Success response
        return res.status(400).json({
            statusCode: 400,
            statusValue: "FAIL",
            message: "Employee data not found.",
        });
    } catch (error) {
        // console.error(error);
        // Error response
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Error retrieving employee list.",
            error: error.message,
        });
    }
};


const getTodayOnleaveList = async (req, res) => {
    try {
        const leaveData = await leaveTakenHistoryModel.find({status:"Approved"},{employeeId:1, leaveType:1, leaveStartDate:1, leaveEndDate:1, shift:1 });
        const currentDate = new Date().toISOString().split('T')[0];

        const employeesOnLeave = leaveData
        .filter(leave => 
            new Date(currentDate) >= new Date(leave.leaveStartDate) &&
            new Date(currentDate) <= new Date(leave.leaveEndDate)
        )
        .map(leave => leave.employeeId);
        
        const employeeIds = [...new Set(employeesOnLeave)]
        if (employeeIds.length < 1) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "No one is on leave.",
                data:[]
            });
        }
        const empList = await employeeModel.find({employeeId:{$in: employeeIds}},{employeeId:1,employeeName:1,gender:1,designation:1,employeePhoto:1})
        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Today on leave Employee list retrieved successfully.",
            data: empList
        });
    } catch (error) {
        console.error(error);
        // Error response
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Error retrieving employee list.",
            error: error.message,
        });
    }
};


const deleteEmpById = async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { deletionReason } = req.body || {};
        
        if (!employeeId) {
            return res.status(404).json({
                statusCode: 404,
                statusValue: "FAIL",
                message: "No employees found.",
            });
        }
                
        const employee = await employeeModel.findOne({ employeeId: employeeId }, { __v: 0 })
        if (!employee) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Employee data not found.",
            });
        }

        // Get the user who is deleting (from JWT token if available)
        const deletedBy = req.employee?.employeeId || "System";

        // Convert employee document to plain object and prepare for deleted collection
        const employeeData = employee.toObject();
        delete employeeData._id; // Remove the original _id
        delete employeeData.__v; // Remove version key

        // Add deletion metadata
        const deletedEmployeeData = {
            ...employeeData,
            deletedAt: new Date(),
            deletedBy: deletedBy,
            deletionReason: deletionReason || "",
            canRestore: true
        };

        // Save to deleted employees collection
        const deletedEmployee = new DeletedEmployee(deletedEmployeeData);
        await deletedEmployee.save();

        // Now delete from main employees collection
        const deleteDoc = await employeeModel.findOneAndDelete({ employeeId: employeeId });
        
        if (deleteDoc) {
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Employee deleted successfully and moved to deleted employees collection.",
                data: {
                    employeeId: deleteDoc.employeeId,
                    employeeName: deleteDoc.employeeName,
                    deletedAt: deletedEmployee.deletedAt
                }
            });
        }

    } catch (error) {
        console.error(error);
        // Error response
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Error deleting employee list.",
            error: error.message,
        });
    }
};


const resetForgetPassword = async (req, res) => {
    try {
      const schema = Joi.object({
        email: Joi.string().required(),
      })
      let result = schema.validate(req.body);
      if (result.error) {
        return res.status(400).json({
          statusCode: 400,
          statusValue: "FAIL",
          message: result.error.details[0].message,
        });
      };

      const checkUser = await employeeModel.findOne({email:req.body.email});
      
      if (!checkUser) {
        return res.status(404).json({
            message: 'User not found ! You have entered wrong email id',
            statusCode: 404,
            statusValue: false
        });  
      }

      var otp = Math.floor(1000 + Math.random() * 9000);
      const saveOtp = await employeeModel.findOneAndUpdate(
        { email: req.body.email },
        {
            $set: {
                otp: otp.toString(),
                isOtpVerified: false,
            },
        },
        { new: true } // Returns the updated document
      );
    await sendOtp(checkUser.email, otp)
    res.status(200).json({
        statusCode: 200,                   
        statusValue: "SUCCESS",
        message: "OTP has been sent successfully to your registered email.",
      });
    } catch (err) {
      return res.status(500).json({
        statusCode: 500,
        statusValue: "FAIL",
        message: "Internal server error.",
        data: {
          generatedTime: new Date(),
          errMsg: err.stack,
        }
      });
    }
  }
  
  
  const verifyOtp = async (req, res) => {
    try {
      // console.log(req.body)
      const schema = Joi.object({
        otp: Joi.string().required(),
      })
      let result = schema.validate(req.body);
      if (result.error) {
        return res.status(400).json({
          statusCode: 400,
          statusValue: "FAIL",
          message: result.error.details[0].message,
        })
      }
      // console.log()
      const checkOtp = await employeeModel.find({ otp:req.body.otp });
      if (checkOtp.length<1) {
        console.log('Invalid OTP.');
        // Handle invalid OTP
        return res.status(400).json({
            message: 'You have entered invalid or expired OTP',
            statusCode: 400,
            statusValue: false
        });
    } else {
        const updatedUser = await employeeModel.findOneAndUpdate(
            { otp: req.body.otp }, // Ensure the OTP matches exactly
            { $set: { isOtpVerified: true } }, // Set isOtpVerified to true
            { new: true } // Return the updated document
        );
        if (!updatedUser) {
            console.log('Invalid or expired OTP provided.');
            return res.status(400).json({
                message: 'Invalid or expired OTP.',
                statusCode: 400,
                statusValue: false,
            });
        }
        console.log('User updated successfully:', updatedUser);
        return res.status(200).json({
                message: 'OTP verified successfully.',
                statusCode: 200,
                statusValue: true,
                user: updatedUser,
            });
        }
      
    } catch (err) {
      return res.status(500).json({
        statusCode: 500,
        statusValue: "FAIL",
        message: "Internal server error.",
        data: {
          generatedTime: new Date(),
          errMsg: err.stack,
        }
      });
    }
  }
  
  
  const generateNewPassword = async (req, res) => {
    try {
        const { email, loginPassword } = req.body;

        // Generate new password hash
        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(loginPassword, salt);

        // Update the user's password
        const updatedUser = await employeeModel.findOneAndUpdate(
            { email },
            { loginPassword: hashedPassword },
            { new: true } // Return the updated document
        );

        if (!updatedUser) {
            return res.status(404).json({
                statusCode: 404,
                statusValue: "FAIL",
                message: "User not found. Unable to update password.",
            });
        }

        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Password updated successfully.",
            data: updatedUser,
        });
    } catch (err) {
        console.error("Error generating new password:", err);
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Internal server error.",
            data: {
                generatedTime: new Date(),
                errorMessage: err.message,
            },
        });
    }
};



const updateEmpSalaryDetailsById = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const updateData = req.body;

    let updateFields = {};
    if (updateData.employee_basic_details) {
      for (let key in updateData.employee_basic_details) {
        updateFields[`employee_basic_details.${key}`] =
          updateData.employee_basic_details[key];
      }
    }
    if (updateData.salary_details) {
      for (let key in updateData.salary_details) {
        updateFields[`salary_details.${key}`] = updateData.salary_details[key];
      }
    }
     
    const updatedEmployee = await employeeModel.findOneAndUpdate(
      { employeeId },
      { $set: updateFields },
      { new: true, upsert: true } 
    );
    
    return res.status(200).json({
      statusCode: 200,
      statusValue: "SUCCESS",
      message: "Employee updated successfully",
      data: updatedEmployee,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      statusCode: 500,
      statusValue: "FAIL",
      message: "Error updating employee",
      error: error.message,
    });
    }
};  

// Restore deleted employee
const restoreEmployee = async (req, res) => {
    try {
        const { employeeId } = req.params;
        
        if (!employeeId) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Employee ID is required.",
            });
        }

        // Find the deleted employee
        const deletedEmployee = await DeletedEmployee.findOne({ employeeId: employeeId });
        
        if (!deletedEmployee) {
            return res.status(404).json({
                statusCode: 404,
                statusValue: "FAIL",
                message: "Deleted employee not found.",
            });
        }

        // Check if employee already exists in main collection
        const existingEmployee = await employeeModel.findOne({ employeeId: employeeId });
        if (existingEmployee) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Employee with this ID already exists in the system.",
            });
        }

        // Prepare employee data (remove deletion metadata)
        const employeeData = deletedEmployee.toObject();
        delete employeeData._id;
        delete employeeData.__v;
        delete employeeData.deletedAt;
        delete employeeData.deletedBy;
        delete employeeData.deletionReason;
        delete employeeData.canRestore;
        delete employeeData.createdAt;
        delete employeeData.updatedAt;

        // Create new employee in main collection
        const restoredEmployee = new employeeModel(employeeData);
        await restoredEmployee.save();

        // Delete from deleted employees collection
        await DeletedEmployee.findOneAndDelete({ employeeId: employeeId });

        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Employee restored successfully.",
            data: {
                employeeId: restoredEmployee.employeeId,
                employeeName: restoredEmployee.employeeName,
                restoredAt: new Date()
            }
        });

    } catch (error) {
        console.error("Error restoring employee:", error);
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Error restoring employee",
            error: error.message,
        });
    }
};

// Get all deleted employees
const getDeletedEmployees = async (req, res) => {
    try {
        const deletedEmployees = await DeletedEmployee.find({})
            .select('-loginPassword -employeeDevicePassword')
            .sort({ deletedAt: -1 })
            .lean();

        return res.status(200).json({
            statusCode: 200,
            statusValue: "SUCCESS",
            message: "Deleted employees retrieved successfully.",
            data: deletedEmployees,
            count: deletedEmployees.length
        });

    } catch (error) {
        console.error("Error fetching deleted employees:", error);
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: "Error fetching deleted employees",
            error: error.message,
        });
    }
};

module.exports = {
    registerEmployee,
    updateEmployeeById,
    getAllEmployeeList,
    employeeLogin,
    logout,
    getEmpDetailsById,
    deleteEmpById,
    restoreEmployee,
    getDeletedEmployees,
    getEmployeeListByManagerId,
    resetForgetPassword,
    verifyOtp,
    generateNewPassword,
    getTodayOnleaveList,
    updateEmpSalaryDetailsById
}
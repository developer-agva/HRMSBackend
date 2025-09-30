const upload = require('../helper/upload.helper');
const { default: mongoose } = require('mongoose');
// const dotenv = require('dotenv');
require("dotenv").config({ path: "../.env" });
// const s3 = require('../utils/s3.util');
const AWS = require('aws-sdk');  
const leaveTakenHistoryModel = require('../models/leaveTakenHistoryModel');
const employeeDocModel = require('../models/employeeDocsModel');
const employeeModel = require('../models/employeeModel');

const s33 = new AWS.S3();


exports.uploadMedicalReport = async (req, res) => {
    // req.file contains a file object  
    res.json(req.file);
    // console.log(req.file.fieldname, req.params.deviceId)
    // if (req.file) {
    //     await leaveTakenHistoryModel.findOneAndUpdate({
    //         employeeId:req.params.employeeId,
    //         leaveType:"medicalLeave",
    //         status: "Pending"
    //     },
    //     {
    //         location:req.file.location
    //     }
    // )
    // }
}    

exports.uploadSelfieForAttendance = async (req, res) => {
    // req.file contains a file object  
    res.json(req.file);
}

exports.uploadEmpDocFile = async (req, res) => {
    // req.file contains a file object  
    res.json(req.file);
}



exports.uploadProfileImage = async (req, res) => {
    // req.file contains a file object  
    res.json(req.file);
    // console.log(req.file.fieldname, req.params.deviceId)
    if (req.file) {
        await employeeModel.findOneAndUpdate({
            employeeId:req.params.employeeId
        },
        {
            employeePhoto:req.file.location
        }
    )
    }
}

exports.uploadProfileImage = async (req, res) => {
    // req.file contains a file object  
    res.json(req.file);
    // console.log(req.file.fieldname, req.params.deviceId)
    if (req.file) {
        await employeeModel.findOneAndUpdate({
            employeeId:req.params.employeeId
        },
        {
            employeePhoto:req.file.location
        }
    )
    }
}


exports.uploadEmployeeFile = async (req, res) => {
    try {
        // Check if a file is provided
        // if (!req.file) {
        //     return res.status(400).json({
        //         statusCode: 400,
        //         statusValue: "FAIL",
        //         message: "Error! File is required.",
        //     });
        // }

        // Extract and validate the request body
        const { documentName, docType, employeeId, location } = req.body;
        
        // Validate `documentName` and `docType`
        if (!documentName || !docType || !location) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Document name, location and docType are required.",
            });
        }

        // Conditional validation for `employeeId`
        if (docType === "Private" && !employeeId) {
            return res.status(400).json({
                statusCode: 400,
                statusValue: "FAIL",
                message: "Employee ID is required for Private documents.",
            });
        }

        // Prepare the document model
        const bodyDoc = new employeeDocModel({
            documentName,
            docType,
            location,
            employeeId: docType === "Private" ? employeeId : employeeId || "", // Optional for "Public"
        });

        // Save the document
        const saveDoc = await bodyDoc.save();

        // Return a success response
        if (saveDoc) {
            return res.status(201).json({
                statusCode: 201,
                statusValue: "SUCCESS",
                message: "File data saved successfully.",
                data:saveDoc
            });
        }
    } catch (error) {
        // Handle errors
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message,
            error: error.message,
        });
    }
};


exports.getEmployeeDocs = async (req, res) => {
    // req.file contains a file object  
    try {
        const empDocList = await employeeDocModel.find({docType:"Public"})
        if (empDocList) {
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Documents get successfully.",
                data:empDocList
            });
        }

    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message,
            error: error.message,
        });
    }
}

exports.getEmployeeDocs2 = async (req, res) => {
    try {
        const empDocList = await employeeDocModel.find({employeeId:req.params.employeeId, docType:"Private"})
        if (empDocList) {
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Documents get successfully.",
                data:empDocList
            });
        }

    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message,
            error: error.message,
        });
    }
}

exports.deleteDocs = async (req, res) => {
    // req.file contains a file object  
    try {
       
        const empDocList = await employeeDocModel.findOneAndDelete({_id:req.params.id});
        if (empDocList) {
            return res.status(200).json({
                statusCode: 200,
                statusValue: "SUCCESS",
                message: "Documents deleted successfully.",
                data:empDocList
            });
        }
        return res.status(400).json({
            statusCode: 400,
            statusValue: "FAIL",
            message: "Documents not deleted successfully.",
        });

    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "FAIL",
            message: error.message,
            error: error.message,
        });
    }
}
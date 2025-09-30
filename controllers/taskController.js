const express = require("express");
const mongoose = require("mongoose");
const employeeModel = require("../models/employeeModel");
const redisClient = require("../config/redisClient");
// console.log(redisClient)
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const blacklist = require("../utils/blacklist");
const projectModel = require("../models/projectModel");
const taskModel = require("../models/taskModel");



const addProject = async (req, res) => {
    try {
        // extract data from the req body
        const {
            id,
            name,
            user_ids,
            assignes_emails,
            date_start,
            date_end,
            tasks_count,
            description,
            create_date,
            task_creator_email
        } = req.body;
        
        var otp = Math.floor(1000 + Math.random() * 9000);
        // create new project instance for data save
        const newProject = new projectModel({
            id: id || otp,
            name,
            user_ids,
            assignes_emails,
            date_start: date_start || "", 
            date_end: date_end || "",     
            tasks_count: tasks_count || 0,   
            description: description || "",  
            create_date,
            task_creator_email: task_creator_email || "" 
        });
        
        // save the data
        const savedProject = await newProject.save();
        if (savedProject) {
            return res.status(201).json({
                message: 'Project added successfully',
                statusCode: 201,
                statusValue: 'SUCCESS',
                project: savedProject
            });
        }
        return res.status(400).json({
            message: 'Error while adding project',
            statusCode: 400,
            statusValue: 'FAIL',
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Internal server error.',
            statusCode: 500,
            statusValue: 'Error',
            error: error.message
        });
    }
};


// update project by id
const updateProjectById = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            user_ids,
            assignes_emails,
            date_start,
            date_end,
            tasks_count,
            description,
            create_date,
            task_creator_email
        } = req.body;
        
        if (!id) {
            return res.status(400).json({
                message: 'Project ID is required',
                statusCode: 400,
                statusValue: 'FAIL',
            });
        }
        
        // check project id exists or not
        const projectData = await projectModel.findOne({id:id});
        if (!projectData) {
            return res.status(400).json({
                message: 'Error! Invalid project id.',
                statusCode: 400,
                statusValue: 'FAIL',
            }); 
        }
        // Update the project by ID
        const updatedProject = await projectModel.findOneAndUpdate(
            { id },
            {
                name: name || projectData.id,
                user_ids: user_ids || projectData.user_ids,
                assignes_emails: assignes_emails || projectData.assignes_emails,
                date_start: date_start || projectData.date_start,
                date_end: date_end || projectData.date_end,
                tasks_count: tasks_count || projectData.tasks_count,
                description: description || projectData.description,
                create_date: create_date || projectData.create_date,
                task_creator_email: task_creator_email || projectData.task_creator_email
            },
            { new: true }
        );

        if (updatedProject) {
            return res.status(200).json({
                message: 'Project updated successfully',
                statusCode: 200,
                statusValue: 'SUCCESS',
                project: updatedProject
            });
        }

        return res.status(404).json({
            message: 'Project not found',
            statusCode: 404,
            statusValue: 'FAIL',
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Internal server error.',
            statusCode: 500,
            statusValue: 'Error',
            error: error.message
        });
    }
};


const getProjects = async (req, res) => {
    try {
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
        const getUser = await employeeModel.findOne({employeeId:decoded.employeeId});
        if (decoded.role === "Manager" || decoded.role === "Employee") {
            const projects = await projectModel.find({ assignes_emails: getUser.email },{_id:0, user_ids:0, __v:0});
            const employees = await employeeModel.find({}, { employeeName: 1, email: 1, _id: 0 });
            
            const enrichedProjects = projects.map((project) => {
                const enrichedAssignesEmails = project.assignes_emails.map((email) => {
                    const employee = employees.find((emp) => emp.email === email);

                    return employee ?
                    {name: employee.employeeName, email: employee.email}
                    : { name: "Unknown", email }
                });
                return {
                    ...project.toObject(),
                    assignes_emails: enrichedAssignesEmails,
                };
            })

            if (!projects || projects.length === 0) {
                return res.status(404).json({
                    statusCode: 404,
                    statusValue: "FAIL",
                    message: "No projects found for the given email",
                });
            }

            return res.status(200).json({
                message: "Projects fetched successfully",
                statusCode: 200,
                statusValue: "SUCCESS",
                data:enrichedProjects
            });
        }
    } catch (error) {
        return res.status(500).json({
            message: 'Internal server error.',
            statusCode: 500,
            statusValue: 'Error',
            error: error.message
        });
    }
}

const getProjects2 = async (req, res) => {
    try {
            const projects = await projectModel.find({},{_id:0, user_ids:0, __v:0});
            if (!projects || projects.length === 0) {
                return res.status(404).json({
                    statusCode: 404,
                    statusValue: "FAIL",
                    message: "No projects found for the given email",
                });
            }
            const employees = await employeeModel.find({}, { employeeName: 1, email: 1, _id: 0 });
            
            const enrichedProjects = projects.map((project) => {
                const enrichedAssignesEmails = project.assignes_emails.map((email) => {
                    const employee = employees.find((emp) => emp.email === email);

                    return employee ?
                    {name: employee.employeeName, email: employee.email}
                    : { name: "Unknown", email }
                });
                return {
                    ...project.toObject(),
                    assignes_emails: enrichedAssignesEmails,
                };
            })

            if (!projects || projects.length === 0) {
                return res.status(404).json({
                    statusCode: 404,
                    statusValue: "FAIL",
                    message: "No projects found for the given email",
                });
            }

            return res.status(200).json({
                message: "Projects fetched successfully",
                statusCode: 200,
                statusValue: "SUCCESS",
                data:enrichedProjects
            });
    } catch (error) {
        return res.status(500).json({
            message: 'Internal server error.',
            statusCode: 500,
            statusValue: 'Error',
            error: error.message
        });
    }
}


const addTask = async (req, res) => {
    try {
        const {
            id,
            name,
            project_id,
            project_name,
            user_ids,
            assignees_emails,
            priority,
            stage_name,
            start_date,
            deadline_date,
            task_description,
            create_date,
            task_creator_email,
            comments,
        } = req.body;

        // Validate required fields
        // if (!name || !project_id || !project_name || 
        //     !user_ids || !assignees_emails || !priority || !start_date || !deadline_date || !task_description || !task_creator_email) {
            
        //         return res.status(400).json({
        //         statusCode: 400,
        //         statusValue: "FAIL",
        //         message: "All required fields must be provided",
        //     });
        // }
        var otp = Math.floor(1000 + Math.random() * 9000);
        // Ensure task ID is unique
        const existingTask = await taskModel.findOne({ id });
        if (existingTask) {
            return res.status(409).json({
                statusCode: 409,
                statusValue: "FAIL",
                message: `Task with ID ${id} already exists`,
            });
        }

        // Create a new task
        const newTask = new taskModel({
            id: id || otp,
            name:name|| "",
            project_id: project_id|| "",
            project_name: project_name || "",
            user_ids: user_ids || [],
            assignees_emails: assignees_emails || [],
            priority: priority[0] || [],
            stage_name: stage_name || "Created",
            start_date: start_date || "",
            deadline_date: deadline_date || "",
            task_description: task_description || "",
            create_date: create_date || "",
            task_creator_email: task_creator_email || "",
            comments: comments || "",
        });
        // save the data
        const savedTask = await newTask.save();
        if (savedTask) {
            return res.status(201).json({
                message: 'Task added successfully',
                statusCode: 201,
                statusValue: 'SUCCESS',
                data: savedTask
            });
        }
        return res.status(400).json({
            message: 'Error while adding task',
            statusCode: 400,
            statusValue: 'FAIL',
        });
    } catch (error) {
        return res.status(500).json({
            statusCode: 500,
            statusValue: "ERROR",
            message: "Internal server error",
            error: error.message,
        });
    }
};


// update project by id
const updateTaskById = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            project_id,
            project_name,
            user_ids,
            assignees_emails,
            priority,
            stage_name,
            start_date,
            deadline_date,
            task_description,
            create_date,
            task_creator_email,
            comments,
        } = req.body;
        
        if (!id) {
            return res.status(400).json({
                message: 'Task Id is required',
                statusCode: 400,
                statusValue: 'FAIL',
            });
        }
        
        // check project id exists or not
        const taskData = await taskModel.findOne({id:id});
        if (!taskData) {
            return res.status(400).json({
                message: 'Error! Invalid task id.',
                statusCode: 400,
                statusValue: 'FAIL',
            }); 
        }
        // Update the task by Id
        const updatedTask = await taskModel.findOneAndUpdate(
            { id },
            {
                name: name || taskData.name,
                project_id: project_id || taskData.project_id,
                project_name: project_name || taskData.project_name,
                user_ids: user_ids || taskData.user_ids,
                assignees_emails: assignees_emails || taskData.assignees_emails,
                priority: priority || taskData.priority,
                stage_name: stage_name || taskData.stage_name,
                start_date: start_date || taskData.start_date,
                deadline_date: deadline_date || taskData.deadline_date,
                task_description: task_description || taskData.task_description,
                create_date: create_date || taskData.create_date,
                task_creator_email: task_creator_email || taskData.task_creator_email,
                comments: comments || taskData.comments
            },
            { new: true }
        );

        if (updatedTask) {
            return res.status(200).json({
                message: 'Task updated successfully',
                statusCode: 200,
                statusValue: 'SUCCESS',
                data: updatedTask
            });
        }

        return res.status(404).json({
            message: 'Task not found',
            statusCode: 404,
            statusValue: 'FAIL',
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Internal server error.',
            statusCode: 500,
            statusValue: 'Error',
            error: error.message
        });
    }
};


const getTasks = async (req, res) => {
    try {
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
        const getUser = await employeeModel.findOne({employeeId:decoded.employeeId});
        if (decoded.role === "Manager" || decoded.role === "Employee") {
            const tasks = await taskModel.find({ assignees_emails: getUser.email },{_id:0, user_ids:0, __v:0}).sort({create_date:-1});
            const employees = await employeeModel.find({}, { employeeName: 1, email: 1, _id: 0 });
            
            const enrichedTask = tasks.map((task) => {
                const enrichedAssignesEmails = task.assignees_emails.map((email) => {
                    const employee = employees.find((emp) => emp.email === email);

                    return employee ?
                    {name: employee.employeeName, email: employee.email}
                    : { name: "Unknown", email }
                });
                return {
                    ...task.toObject(),
                    assignees_emails: enrichedAssignesEmails,
                };
            })
            const projectData = await projectModel.find({});
            const enrichTaskDataWithProject = (enrichedTask, projectData) => {
                return enrichedTask.map(task => {
                    const matchingProject = projectData.find(project => project.id === task.project_id);

                    if(matchingProject) {
                        return {
                            ...task,
                            project_name: matchingProject.name,
                            project_description: matchingProject.description
                        }
                    } else {
                        return task;
                    }
                })
            }

            const finalResult = enrichTaskDataWithProject(enrichedTask, projectData);
            const predefinedStatuses = [
                "Created",
                "In Progress",
                "Redo",
                "Running Late",
                "Review",
                "Completed",
                "Cancel",
                "Hold"
            ];
            
            const categorizedData = predefinedStatuses.map((status) => ({
                status,
                items: []
            }));

            // Add items to the appropriate status
            finalResult.forEach((item) => {
                const {
                    id,
                    name,
                    project_id,
                    project_name,
                    assignees_emails,
                    priority,
                    stage_name,
                    start_date,
                    deadline_date,
                    task_description,
                    create_date,
                    task_creator_email,
                    comments,
                    project_description
                } = item;

                const statusIndex = categorizedData.findIndex((category) => category.status === stage_name);
                if (statusIndex !== -1) {
                    categorizedData[statusIndex].items.push({
                        id,
                        name,
                        project_id,
                        project_name,
                        assignees_emails,
                        priority,
                        start_date,
                        deadline_date,
                        task_description,
                        create_date,
                        task_creator_email,
                        comments,
                        project_description
                    });
                }
            });

            if (!tasks || tasks.length === 0) {
                return res.status(404).json({
                    statusCode: 404,
                    statusValue: "FAIL",
                    message: "No task found for the given email",
                });
            }
            
            return res.status(200).json({
                message: "Task fetched successfully",
                statusCode: 200,
                statusValue: "SUCCESS",
                data:categorizedData
            });
        }
    } catch (error) {
        return res.status(500).json({
            message: 'Internal server error.',
            statusCode: 500,
            statusValue: 'Error',
            error: error.message
        });
    }
}


const getTasks2 = async (req, res) => {
    try {
            const tasks = await taskModel.find({ },{_id:0, user_ids:0, __v:0}).sort({create_date:-1});
            const employees = await employeeModel.find({}, { employeeName: 1, email: 1, _id: 0 });
            
            const enrichedTask = tasks.map((task) => {
                const enrichedAssignesEmails = task.assignees_emails.map((email) => {
                    const employee = employees.find((emp) => emp.email === email);

                    return employee ?
                    {name: employee.employeeName, email: employee.email}
                    : { name: "Unknown", email }
                });
                return {
                    ...task.toObject(),
                    assignees_emails: enrichedAssignesEmails,
                };
            })
            const projectData = await projectModel.find({});
            const enrichTaskDataWithProject = (enrichedTask, projectData) => {
                return enrichedTask.map(task => {
                    const matchingProject = projectData.find(project => project.id === task.project_id);

                    if(matchingProject) {
                        return {
                            ...task,
                            project_name: matchingProject.name,
                            project_description: matchingProject.description
                        }
                    } else {
                        return task;
                    }
                })
            }

            const finalResult = enrichTaskDataWithProject(enrichedTask, projectData);
            // const predefinedStatuses = [
            //     "Created",
            //     "In Progress",
            //     "Redo",
            //     "Running Late",
            //     "Review",
            //     "Completed",
            //     "Cancel",
            //     "Hold"
            // ];
            
            // const categorizedData = predefinedStatuses.map((status) => ({
            //     status,
            //     items: []
            // }));

            // // Add items to the appropriate status
            // finalResult.forEach((item) => {
            //     const {
            //         id,
            //         name,
            //         project_id,
            //         project_name,
            //         assignees_emails,
            //         priority,
            //         stage_name,
            //         start_date,
            //         deadline_date,
            //         task_description,
            //         create_date,
            //         task_creator_email,
            //         comments,
            //         project_description
            //     } = item;

            //     const statusIndex = categorizedData.findIndex((category) => category.status === stage_name);
            //     if (statusIndex !== -1) {
            //         categorizedData[statusIndex].items.push({
            //             id,
            //             name,
            //             project_id,
            //             project_name,
            //             assignees_emails,
            //             priority,
            //             start_date,
            //             deadline_date,
            //             task_description,
            //             create_date,
            //             task_creator_email,
            //             comments,
            //             project_description
            //         });
            //     }
            // });

            if (!tasks || tasks.length === 0) {
                return res.status(404).json({
                    statusCode: 404,
                    statusValue: "FAIL",
                    message: "No task found for the given email",
                });
            }
            
            return res.status(200).json({
                message: "Task fetched successfully",
                statusCode: 200,
                statusValue: "SUCCESS",
                data:finalResult
            });
    } catch (error) {
        return res.status(500).json({
            message: 'Internal server error.',
            statusCode: 500,
            statusValue: 'Error',
            error: error.message
        });
    }
}

const getTasksByProjectId = async (req, res) => {
    try {
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
        const getUser = await employeeModel.findOne({employeeId:decoded.employeeId});
        if (decoded.role === "Manager" || decoded.role === "Employee") {
            const tasks = await taskModel.find({ project_id:req.params.project_id, assignees_emails: getUser.email },{_id:0, user_ids:0, __v:0}).sort({create_date:-1});
            const employees = await employeeModel.find({}, { employeeName: 1, email: 1, _id: 0 });
            
            const enrichedTask = tasks.map((task) => {
                const enrichedAssignesEmails = task.assignees_emails.map((email) => {
                    const employee = employees.find((emp) => emp.email === email);

                    return employee ?
                    {name: employee.employeeName, email: employee.email}
                    : { name: "Unknown", email }
                });
                return {
                    ...task.toObject(),
                    assignees_emails: enrichedAssignesEmails,
                };
            })
            const projectData = await projectModel.find({});
            const enrichTaskDataWithProject = (enrichedTask, projectData) => {
                return enrichedTask.map(task => {
                    const matchingProject = projectData.find(project => project.id === task.project_id);

                    if(matchingProject) {
                        return {
                            ...task,
                            project_name: matchingProject.name,
                            project_description: matchingProject.description
                        }
                    } else {
                        return task;
                    }
                })
            }

            const finalResult = enrichTaskDataWithProject(enrichedTask, projectData);
            
            const predefinedStatuses = [
                "Created",
                "In Progress",
                "Redo",
                "Running Late",
                "Review",
                "Completed",
                "Cancel",
                "Hold"
            ];
            
            const categorizedData = predefinedStatuses.map((status) => ({
                status,
                items: []
            }));

            // Add items to the appropriate status
            finalResult.forEach((item) => {
                const {
                    id,
                    name,
                    project_id,
                    project_name,
                    assignees_emails,
                    priority,
                    stage_name,
                    start_date,
                    deadline_date,
                    task_description,
                    create_date,
                    task_creator_email,
                    comments,
                    project_description
                } = item;

                const statusIndex = categorizedData.findIndex((category) => category.status === stage_name);
                if (statusIndex !== -1) {
                    categorizedData[statusIndex].items.push({
                        id,
                        name,
                        project_id,
                        project_name,
                        assignees_emails,
                        priority,
                        start_date,
                        deadline_date,
                        task_description,
                        create_date,
                        task_creator_email,
                        comments,
                        project_description
                    });
                }
            });

            if (!tasks || tasks.length === 0) {
                return res.status(404).json({
                    statusCode: 404,
                    statusValue: "FAIL",
                    message: "No task found for the given email",
                });
            }
            
            return res.status(200).json({
                message: "Task fetched successfully",
                statusCode: 200,
                statusValue: "SUCCESS",
                data:categorizedData
            });
        }
    } catch (error) {
        return res.status(500).json({
            message: 'Internal server error.',
            statusCode: 500,
            statusValue: 'Error',
            error: error.message
        });
    }
}


const getTasksById = async (req, res) => {
    try {
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
        const getUser = await employeeModel.findOne({employeeId:decoded.employeeId});
        if (decoded.role === "Manager" || decoded.role === "Employee") {
            const tasks = await taskModel.find({ id:req.params.id, assignees_emails: getUser.email },{_id:0, user_ids:0, __v:0}).sort({create_date:-1});
            const employees = await employeeModel.find({}, { employeeName: 1, email: 1, _id: 0 });
            
            const enrichedTask = tasks.map((task) => {
                const enrichedAssignesEmails = task.assignees_emails.map((email) => {
                    const employee = employees.find((emp) => emp.email === email);

                    return employee ?
                    {name: employee.employeeName, email: employee.email}
                    : { name: "Unknown", email }
                });
                return {
                    ...task.toObject(),
                    assignees_emails: enrichedAssignesEmails,
                };
            })
            const projectData = await projectModel.find({});
            const enrichTaskDataWithProject = (enrichedTask, projectData) => {
                return enrichedTask.map(task => {
                    const matchingProject = projectData.find(project => project.id === task.project_id);

                    if(matchingProject) {
                        return {
                            ...task,
                            project_name: matchingProject.name,
                            project_description: matchingProject.description
                        }
                    } else {
                        return task;
                    }
                })
            }

            const finalResult = enrichTaskDataWithProject(enrichedTask, projectData);
            if (!tasks || tasks.length === 0) {
                return res.status(404).json({
                    statusCode: 404,
                    statusValue: "FAIL",
                    message: "No task found for the given email",
                });
            }
            
            return res.status(200).json({
                message: "Task fetched successfully",
                statusCode: 200,
                statusValue: "SUCCESS",
                data:finalResult[0]
            });
        }
    } catch (error) {
        return res.status(500).json({
            message: 'Internal server error.',
            statusCode: 500,
            statusValue: 'Error',
            error: error.message
        });
    }
}


module.exports = {
    addProject,
    updateProjectById,
    getProjects,
    addTask,
    updateTaskById,
    getTasks,
    getTasksByProjectId,
    getTasksById,
    getProjects2,
    getTasks2
}


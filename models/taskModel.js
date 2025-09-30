const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    id: { type: Number, required: true },
    name: { type: String, required: true },
    project_id: { type: Number, required: true },
    project_name: { type: String, required: true },
    user_ids: [{ type: Number, required: true }],
    assignees_emails: [{ type: String, required: true }],
    priority: [{ type: String, required: true, default: "Low" }],
    stage_name: { type: String, enum:[
        "Created",
        "In Progress",
        "Redo",
        "Running Late",
        "Review",
        "Completed",
        "Cancel",
        "Hold"
    ], default: "Created" },
    start_date: { type: String, required: true },
    deadline_date: { type: String, required: true },
    task_description: { type: String, required: true },
    create_date: { type: String, default: "" },
    task_creator_email: { type: String, required: true },
    comments: { type: String, default: "" }
});

module.exports = mongoose.model('task', taskSchema);

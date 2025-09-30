const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
    id: {type: Number, unique: true, required: true},
    name: { type: String, required: true },
    user_ids: [{ type: Number, required: true }],
    assignes_emails: [{ type: String, required: true }],
    date_start: { type: String, default: "" }, 
    date_end: { type: String, default: "" },   
    tasks_count: { type: Number, default: 0 },
    description: { type: String, default: "" },
    create_date: { type: String, default: "" },
    task_creator_email: { type: String, required: true } 
});

module.exports = mongoose.model('project', projectSchema);

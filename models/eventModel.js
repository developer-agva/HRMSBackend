const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: String, default: "" },
    dateTime: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now }, 
    updatedAt: { type: Date, default: Date.now }, 
});

module.exports = mongoose.model('events', eventSchema);



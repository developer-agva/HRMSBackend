const { required } = require('joi');
const mongoose = require('mongoose');

const compOffSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
  },
  appliedDate: {
    type: String,
    default: "",
  },
  compOffDate: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
  },
  approvedBy: {
    type: String,
    required: true, // Reference to the Admin or Manager collection
  },
  totalDays: {
    type: String,
    default:"0"
  },
  approvedDate:{
    type: String,
    default: ""
  },
  comments: {
    type: String,
    default: ""
  },
  duration: {
    type: String,
    default: ""
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt timestamps
});

const CompOff = mongoose.model('CompOff', compOffSchema);

module.exports = CompOff;

const { required } = require('joi');
const mongoose = require('mongoose');

// Schema for items inside `trackPath`
const trackPathSchema = new mongoose.Schema({
  lat: {
    type: Number,
    required: true
  },
  lng: {
    type: Number,
    required: true
  },
  timestamp: {
    type: String,
    required: true
  }
}, { _id: false });

// Schema for items inside `markers`
const markerSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true
  },
  lat: {
    type: Number,
    required: true
  },
  lng: {
    type: Number,
    required: true
  },
  time: {
    type: String,
    default: ''
  },
  locality: {
    type: String,
    default: ''
  },
  subLocality: {
    type: String,
    default: ''
  },
  duration: {
    type: String,
    default: ''
  },
  timestamp: {
    type: String,
    default: ''
  },
  distance: {
    type: String,
    default: ''
  }
}, { _id: false });

// Main schema
const employeeLocationSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true
  },
  attendanceDate: {
    type: String,
    default: "" 
  },
  trackPath: {
    type: [trackPathSchema],
    default: []
  },
  markers: {
    type: [markerSchema],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('empLocation', employeeLocationSchema);

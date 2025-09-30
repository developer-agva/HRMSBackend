const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    departmentId: {
      type: Number,
      unique: true,
      trim: true,
      required: true,
    },
    departmentName: {
      type: String,
      required: true,
      trim: true
    },
    departmentCode: {
      type: String,
      trim: true,
      default: ""
    },
    managerId: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true // Adds `createdAt` and `updatedAt` fields
  }
);

module.exports = mongoose.model('department', departmentSchema);

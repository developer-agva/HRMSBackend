const mongoose = require("mongoose");

const actionLogSchema = new mongoose.Schema(
  {
    employeeId: { type: String, default: "" },
    description: { type: String, default: "" },
    actionType: { type: String, default: "" },
    entityType: { type: String, default: "" },
    managerId: { type: String, default: "" }
  },
  {
    timestamps: true // adds createdAt & updatedAt
  }
);

module.exports = mongoose.model("actionLogModel", actionLogSchema);

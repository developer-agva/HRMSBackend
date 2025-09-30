const mongoose = require("mongoose");

const docuModelSchema = new mongoose.Schema({
  documentName: { type: String, required:true },
  docType: { type: String, required:true },
  employeeId: { type: String, default:"" },  
  location: { type: String, default:"" },
  createdAt: { type: Date, default: Date.now }, 
  updatedAt: { type: Date, default: Date.now }, 
});

const employeeDocModel = mongoose.model("document_list", docuModelSchema);

module.exports = employeeDocModel;

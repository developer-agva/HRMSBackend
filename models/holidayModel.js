const mongoose = require("mongoose");

const holidayModelSchema = new mongoose.Schema({
  holidayName: { type: String, required:true },
  holidayDate: { type: String, required:true },
  description: { type: String, required:true },  
  holiday_id: { type: String, default:"" },
  location: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }, 
  updatedAt: { type: Date, default: Date.now }, 

});

const holidaysModel = mongoose.model("holidays_list", holidayModelSchema);

module.exports = holidaysModel;

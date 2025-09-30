const mongoose = require("mongoose");

const punchRecordSchema = new mongoose.Schema({
  record_key: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  date: { type: String, required: true },
  duration: { type: String, default: "" },
  employee_id: { type: String, required: true },
  employee_name: { type: String, required: true },
  punch_in_image_url: { type: String, default: "" },
  punch_in_lat: { type: String, default: "" },
  punch_in_location: { type: String, default: "" },
  punch_in_long: { type: String, default: "" },
  punch_in_time: { type: String, default: "" },
  punch_out_image_url: { type: String, default: "" },
  punch_out_lat: { type: String, default: "" },
  punch_out_location: { type: String, default: "" },
  punch_out_long: { type: String, default: "" },
  punch_out_time: { type: String, default: "" },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: "punch_records"
});

const PunchRecord = mongoose.model("PunchRecord", punchRecordSchema);
module.exports = PunchRecord;

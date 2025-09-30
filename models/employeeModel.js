const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const { required } = require("joi");


const leaveBalanceSchema = new mongoose.Schema({
  casualLeave: { type: String, default: "0" },
  medicalLeave: { type: String, default: "0" },
  earnedLeave: { type: String, default: "0" },
  paternityLeave: { type: String, default: "0" },
  maternityLeave: { type: String, default: "0" },
  compOffLeave: { type: String, default: "0" },
  optionalLeave: { type: String, default: "0" },
  bereavementLeave: { type: String, default: "5" },  
});

const employeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  employeeName: { type: String, required: true },  
  employeeCode: { type: String, default: "" },
  gender: { type: String, default: ""},
  departmentId: { type: String, default: "0" },
  designation: { type: String, default: "" },
  doj: { type: String, default: "" },
  dor: { type: String, default: "" },
  doc:{ type: String, default: "" },
  employeeCodeInDevice: { type: String, default: "NA" },
  employmentType: { type: String, default: "Permanent", required: true },
  employeeStatus: { type: String, default: "Working" },
  accountStatus: { type: String, default: "Active" },
  employeeDevicePassword: { type: String },
  employeeDeviceGroup: { type: String },
  fatherName: { type: String, default: "" },
  motherName: { type: String, default: "" },
  residentialAddress: { type: String, default: "" },
  permanentAddress: { type: String, default: "" },
  contactNo: { type: String, default: "" },
  email: { type: String, required: true },
  dob: { type: String, default: "" }, // Date of Birth
  placeOfBirth: { type: String, default: "" },
  recordStatus: { type: Number, default: 1 },
  bloodGroup: { type: String, default: "" },
  workPlace: { type: String, default: "" },
  extensionNo: { type: String, default: "" },
  loginPassword: { type: String, default: "12345" },
  team: { type: String, default: "" },
  shiftTime: {
    startAt:{ type: String, default: "" },
    endAt:{ type: String, default: "" }
  },
  aadhaarNumber: { type: String, default: "" },
  employeePhoto: { type: String, default: "" },
  masterDeviceId: { type: Number, default: 0 },
  maritalStatus: { type: String, default: "" },
  nationality: { type: String, default: "" },
  overallExperience: { type: String, default: "" },    
  qualifications: { type: String, default: "" },
  emergencyContact: { type: String, default: "" },  
  managerId: { type: String, default: "" },
  teamLeadId: { type: String, default: "" },
  workingDays:{ type: String, default: "5" },
  pancardNo: { type: String, default: "" },
  maxRegularization: { type: String, default: "2" },
  maxShortLeave: { type: String, default: "1" },
  otp:{ type: String, default:"" },
  isOtpVerified:{ type: Boolean, default: false },
  leaveBalance: { type: leaveBalanceSchema, default: () => ({}) },
  role: {
    type: String,
    default: "Employee",
  },
  isProbation:{ type: Boolean, default: false },
  isNotice:{ type: Boolean, default: false },
  isWorking:{ type: Boolean, default: true },
  isInhouse:{ type: Boolean, default: true },
  employee_basic_details: {
    bank_name: { type: String, default: "" },
    bank_ifsc: { type: String, default: "" },
    bank_account: { type: String, default: "" },
    employee_uan: { type: String, default: "" },
    employee_esic: { type: String, default: "" },
    payment_mode: { type: String, default: "" }
  },
  salary_details: {
    basic_salary: { type: String, default: "0" },
    hra: { type: String, default: "0" },
    travel_allowances: { type: String, default: "0" },
    special_allowances: { type: String, default: "0" },
    arrears: { type: String, default: "0" },
    bonus_or_others: { type: String, default: "0" },
    employee_pf: { type: String, default: "0" },
    employee_esi: { type: String, default: "0" },
    tds: { type: String, default: "0" },
    loan_advance: { type: String, default: "0" },
    penalty: { type: String, default: "0" },
    transport_or_others: { type: String, default: "0" },
    net_pay: { type: String, default: "0" }
  },
},{
    timestamps: true
});

// Pre-save hook to hash password
employeeSchema.pre('save', async function (next) {
  if (!this.isModified('loginPassword')) return next();
  this.loginPassword = await bcrypt.hash(this.loginPassword, 10);
  next();
});   

// Method to compare password
employeeSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.loginPassword);
};

const employeeModel = mongoose.model("employee", employeeSchema)  
module.exports = employeeModel

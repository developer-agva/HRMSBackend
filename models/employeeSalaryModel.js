const mongoose = require("mongoose");

const employeeSalarySchema = new mongoose.Schema({
  pay_slip_month: { type: String, default: "" },
  company_address: { type: String, default: "" },
  employee_basic_details: {
    employee_name: { type: String, default: "" },
    employee_code: { type: String, default: "" },
    designation: { type: String, default: "" },
    date_of_joining: { type: String, default: "" },
    employee_pan: { type: String, default: "" },
    employee_aadhar: { type: String, default: "" },
    bank_name: { type: String, default: "" },
    bank_ifsc: { type: String, default: "" },
    bank_account: { type: String, default: "" },
    employee_uan: { type: String, default: "" },
    employee_esic: { type: String, default: "" },
    payment_mode: { type: String, default: "" }
  },
  leave_summary: {
    month_days: { type: String, default: "0" },
    unpaid_days: { type: String, default: "0" },
    payable_days: { type: String, default: "0" },
    EL: { type: String, default: "0" },
    CL: { type: String, default: "0" },
    ML: { type: String, default: "0" },
    D_EL: { type: String, default: "0" },
    D_CL: { type: String, default: "0" },
    D_ML: { type: String, default: "0" },
    regularisation: { type: String, default: "0" },
    shortLeave: { type: String, default: "0" },
    halfDay: { type: String, default: "0" },
    absent: { type: String, default: "0" },
    workedDays: { type: String, default: "0" },
    SD: { type: String, default: "0" },
  },
  salary_details: {
    basic_salary: { type: String, default: "0" },
    hra: { type: String, default: "0" },
    travel_allowances: { type: String, default: "0" },
    special_allowances: { type: String, default: "0" },
    arrears: { type: String, default: "0" },
    bonus_or_others: { type: String, default: "0" },
    total_gross_salary: { type: String, default: "0" },
    employee_pf: { type: String, default: "0" },
    employee_esi: { type: String, default: "0" },
    tds: { type: String, default: "0" },
    loan_advance: { type: String, default: "0" },
    penalty: { type: String, default: "0" },
    transport_or_others: { type: String, default: "0" },
    total_deduction: { type: String, default: "0" },
    net_pay: { type: String, default: "0" },
    fixed_gross_salary: {type: String, default: "0"},
  },

},{timestamps:true});

const EmployeeSalary = mongoose.model("employee_salaries", employeeSalarySchema);
module.exports = EmployeeSalary;

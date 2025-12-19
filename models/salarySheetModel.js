const mongoose = require("mongoose");

const salarySheetSchema = new mongoose.Schema({
  employee_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "employee",
    required: true,
  },
  employee_code: {
    type: String,
    required: true,
  },
  month: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
  },
  year: {
    type: Number,
    required: true,
    min: 2000,
    max: 2100,
  },
  payable_days: {
    type: Number,
    required: true,
    default: 0,
  },
  worked_days: {
    type: Number,
    required: true,
    default: 0,
  },
  gross_salary: {
    type: Number,
    required: true,
    default: 0,
  },
  daily_rate: {
    type: Number,
    required: true,
    default: 0,
  },
  adjusted_gross: {
    type: Number,
    required: true,
    default: 0,
  },
  salary_components: {
    basic: {
      type: Number,
      required: true,
      default: 0,
    },
    hra: {
      type: Number,
      required: true,
      default: 0,
    },
    travel_allowance: {
      type: Number,
      required: true,
      default: 0,
    },
    special_allowance: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  deductions: {
    employee_pf: {
      type: Number,
      required: true,
      default: 0,
    },
    employee_esi: {
      type: Number,
      required: true,
      default: 0,
    },
    tds: {
      type: Number,
      required: true,
      default: 0,
    },
    loan_advance: {
      type: Number,
      required: true,
      default: 0,
    },
    penalty: {
      type: Number,
      required: true,
      default: 0,
    },
    transport_or_others: {
      type: Number,
      required: true,
      default: 0,
    },
    total_deductions: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  net_pay: {
    type: Number,
    required: true,
    default: 0,
  },
  generated_at: {
    type: Date,
    default: Date.now,
  },
  generated_by: {
    type: String,
    default: "system",
  },
  is_locked: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Create unique index on (employee_id, month, year) to prevent duplicates
salarySheetSchema.index(
  { employee_id: 1, month: 1, year: 1 },
  { unique: true }
);

// Index for efficient queries
salarySheetSchema.index({ month: 1, year: 1 });
salarySheetSchema.index({ employee_code: 1 });

const SalarySheet = mongoose.model("salary_sheets", salarySheetSchema);

module.exports = SalarySheet;

const mongoose = require('mongoose');

const taxDeclarationSchema = new mongoose.Schema({
  // Tax Regime Selection
  taxRegime: {
    type: String,
    required: true
  },

  // 1. Personal & Company Details
  employeeName: { type: String, required: true },
  employeeId: { type: String, required: true },
  designation: { type: String, required: true },
  dateOfJoining: { type: Date, required: true },
  gender: { type: String, enum: ["Male", "Female", "Other"], required: true },

  // 2. Permanent Account Number (PAN)
  panNumber: { type: String, default:"" },

  // 3. Contact Information
  contactNumber: { type: String, default:"" },

  // 4. Residential Address & Rent Details
  residentialAddress: { type: String, default:"" },
  rentPayablePerMonth: { type: String, default:"" },
  rentStartDate: { type: String, default:"" },
  changesInRentAmount: { type: String, default:"" },
  landlordName: { type: String, default:"" },
  landlordPan: { type: String, default:"" },
  completeAddressOfRentedProperty: { type: String, default:"" },

  // 5. Deduction from Gross Income
  deductions: {
    section80CCC: [{
      particulars: String,
      amountAnnual: String
    }],
    section80D: [{
      particulars: String,
      amount: String
    }],
    section80E: [{
      educationalInstitution: String,
      interestAmount: String,
      principalAmount: String,
      totalAmount: String
    }],
    section80C: {
      lifeInsurancePremium: [{
        particulars: String,
        amountAnnual: String,
        dateOfPayment: String
      }],
      ppf: [{
        particulars: String,
        amountDeposited: String
      }],
      nscPurchase: [{
        particulars: String,
        amount: String
      }],
      infrastructureBonds: [{
        particulars: String,
        amount: String
      }],
      tuitionFees: [{
        nameOfChild: String,
        nameOfEducationalInstitution: String,
        amountPaid: String
      }]
    },
    section80CCD: {
      npsInvestmentAmount: String
    },
    section80DD: {
      dependentMedicalExpenses: String
    },
    section80DDB: {
      dependentMedicalTreatment: String
    }
  },

  // 6. Housing Loan Details
  housingLoan: {
    bankName: String,
    loanDate: String,
    loanAmount: String,
    repaymentInterest: String,
    repaymentPrincipal: String,
    dateOfTakingPossession: String
  },

  // Signatures
  declaration: {
    signature: String,
    name: String,
    designation: String
  },

  // Metadata
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('taxDeclaration', taxDeclarationSchema);

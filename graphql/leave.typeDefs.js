const { gql } = require("apollo-server-express");

const leaveTypeDefs = gql`
  type LeaveTakenHistory {
    id: ID!
    employeeId: String!
    leaveType: String!
    leaveStartDate: String!
    leaveEndDate: String!
    totalDays: String
    reason: String
    status: String
    approvedBy: String!
    location: String
    remarks: String
    isLeaveTaken: Boolean
    shift: String
    approvedDateTime: String
    revertLeave: RevertLeave
    dateTime: String
    createdAt: String
    updatedAt: String
    duration: String
  }

  type RevertLeave {
    requestedDateTime: String
    approvedDateTime: String
    revertedDays: String
    status: String
  }

  type LeavePage {
    total: Int!
    page: Int!
    limit: Int!
    data: [LeaveTakenHistory]!
  }

  type LeaveBalance {
    casualLeave: String
    medicalLeave: String
    earnedLeave: String
    paternityLeave: String
    maternityLeave: String
    compOffLeave: String
    optionalLeave: String
    bereavementLeave: String
  }

  type Employee {
    employeeId: String!
    leaveBalance: LeaveBalance
    leaves: [LeaveTakenHistory]
  }

  extend type Query {
    leaves(
      employeeId: String
      dateFrom: String
      dateTo: String
      page: Int
      limit: Int
    ): LeavePage

    employeeWithLeaves(employeeId: String!): Employee
  }

  extend type Mutation {
    createLeave(
      employeeId: String!
      leaveType: String!
      leaveStartDate: String!
      leaveEndDate: String!
      totalDays: String
      reason: String
      approvedBy: String!
      location: String
      remarks: String
      shift: String
    ): LeaveTakenHistory
  }
`;

module.exports = leaveTypeDefs;

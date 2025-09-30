const { gql } = require('apollo-server-express');

const typeDefs = gql`
  type AttendanceLog {
    id: ID!
    EmployeeName: String!
    EmployeeCode: String
    EmployeeId: Int!
    Email: String
    AttendanceDate: String!
    InTime: String
    OutTime: String
    Duration: Int
    Status: String
    PunchRecords: String
  }

  type AttendanceLogPage {
    total: Int!
    page: Int!
    limit: Int!
    data: [AttendanceLog]!
  }

  type Query {
    # Search by EmployeeCode or EmployeeId
    attendanceLogs(
      employeeCode: String
      employeeId: Int
      dateFrom: String
      dateTo: String
      page: Int
      limit: Int
    ): AttendanceLogPage

    # Search by EmployeeName or Email
    attendanceLogsByNameOrEmail(
      employeeName: String
      email: String
      dateFrom: String
      dateTo: String
      page: Int
      limit: Int
    ): AttendanceLogPage
  }

  type Mutation {
    _empty: String
  }
`;

module.exports = typeDefs;


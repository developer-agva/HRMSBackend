// graphql/schema.js
const { mergeTypeDefs } = require('@graphql-tools/merge');
const { makeExecutableSchema } = require('@graphql-tools/schema');

const attendanceTypeDefs = require('./typeDefs');
const leaveTypeDefs = require('./leave.typeDefs');

const attendanceResolvers = require('./resolvers');
const leaveResolvers = require('./leave.resolvers');

const typeDefs = mergeTypeDefs([attendanceTypeDefs, leaveTypeDefs]);
const resolvers = [attendanceResolvers, leaveResolvers];


module.exports = makeExecutableSchema({
  typeDefs,
  resolvers
});

// require('dotenv').config();
// const mongoose = require('mongoose');
// const Employee = require('./models/employeeModel');

// (async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URI, {
//       serverSelectionTimeoutMS: 30000,
//     });
//     const res = await Employee.updateMany(
//       { work_outside: { $exists: false } },
//       { $set: { work_outside: false } }
//     );
//     console.log(`Backfilled: ${res.modifiedCount} employees`);
//   } catch (e) {
//     console.error(e);
//     process.exit(1);
//   } finally {
//     await mongoose.connection.close();
//   }
// })();

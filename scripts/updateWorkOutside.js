require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('../models/employeeModel');

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('MONGO_URI not set in environment');
      process.exit(1);
    }

    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 30000 });

    const targetIds = ['482', '80', '5032', '5034'];

    // 1) Set true for specific employeeIds (match by employeeId or employeeCode)
    const setTrue = await Employee.updateMany(
      { $or: [{ employeeId: { $in: targetIds } }, { employeeCode: { $in: targetIds } }] },
      { $set: { work_outside: true } }
    );

    // 2) Backfill false where field is missing
    const backfillFalse = await Employee.updateMany(
      { work_outside: { $exists: false } },
      { $set: { work_outside: false } }
    );

    console.log(`work_outside=true updated for: ${setTrue.modifiedCount}`);
    console.log(`work_outside backfilled to false for: ${backfillFalse.modifiedCount}`);
  } catch (err) {
    console.error('Error updating work_outside flags:', err);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

run();



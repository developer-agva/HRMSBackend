const mongoose = require("mongoose");
const AttendanceLogModel = require("../models/attendanceLogModel");
const AttendanceLogForOutDuty = require("../models/attendanceLogModelForOutDuty");
const employeeModel = require("../models/employeeModel");


async function findAndCreateAttendanceLog() {
  try {
    // 1. Get unique employeeIds from OutDuty
    const employeeIds = await AttendanceLogForOutDuty.distinct("employeeId");

    // 2. Pick one sample Absent record
    const sampleDoc = await AttendanceLogModel.findOne({ Status: "Absent" });
    if (!sampleDoc) {
      console.log("⚠️ No sample Absent record found in AttendanceLogModel.");
      return;
    }

    // 3. Get all employee details
    const empDetails = await employeeModel.find({}).lean();
    const empMap = {};
    empDetails.forEach(emp => {
      empMap[String(emp.employeeCode)] = emp;
    });

    // 4. Extract time part from sampleDoc.AttendanceDate
    const sampleDate = new Date(sampleDoc.AttendanceDate);

    // 5. Create today's date but keep time part from sampleDoc
    const now = new Date();
    const attendanceDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      sampleDate.getHours(),
      sampleDate.getMinutes(),
      sampleDate.getSeconds(),
      sampleDate.getMilliseconds()
    );

    const dateOnly = attendanceDate.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    // 6. Find existing logs for today
    const existingLogs = await AttendanceLogModel.find({
      EmployeeCode: { $in: employeeIds.map(String) },
      AttendanceDate: {
        $gte: new Date(`${dateOnly}T00:00:00.000Z`),
        $lt: new Date(`${dateOnly}T23:59:59.999Z`)
      }
    }).select("EmployeeCode AttendanceDate");

    const existingKeys = new Set(
      existingLogs.map(log => `${log.EmployeeCode}_${log.AttendanceDate.toISOString().slice(0, 10)}`)
    );

    // 7. Prepare new docs only for employees without logs today
    const newDocs = employeeIds
      .filter(empId => {
        const key = `${empId}_${dateOnly}`;
        return !existingKeys.has(key);
      })
      .map((empId, idx) => {
        const doc = sampleDoc.toObject();
        delete doc._id;
        delete doc.createdAt;
        delete doc.updatedAt;

        const emp = empMap[String(empId)] || {};

        return {
          ...doc,
          EmployeeCode: String(empId),
          EmployeeId: String(empId),
          AttendanceDate: attendanceDate,
          AttendanceLogId: doc.AttendanceLogId + idx + 1,
          EmployeeName: emp.employeeName || doc.EmployeeName || "",
          Gender: emp.gender || doc.Gender || "",
          EmployementType: emp.employmentType || doc.EmployementType || "",
          Email: emp.email || doc.Email || "",
          Designation: emp.designation || doc.Designation || "",
        };
      });

    // 8. Insert only non-duplicate records
    if (newDocs.length > 0) {
      await AttendanceLogModel.insertMany(newDocs);
      console.log(`✅ Inserted ${newDocs.length} records for ${dateOnly}`);
    } else {
      console.log("⚠️ All logs already exist for today. No new insertions.");
    }
  } catch (error) {
    console.error("❌ Error in findAndCreateAttendanceLog:", error);
  }
}



async function removeDuplicateAttendanceLogs() {
  try {
    console.log("🧹 Checking for duplicate attendance logs...");

    // Step 1: Group by EmployeeCode + AttendanceDate
    const duplicates = await AttendanceLogModel.aggregate([
      {
        $group: {
          _id: {
            EmployeeCode: "$EmployeeCode",
            AttendanceDate: "$AttendanceDate",
          },
          ids: { $push: { id: "$_id", createdAt: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          count: { $gt: 1 }, // only groups with duplicates
        },
      },
    ]);

    console.log(`📊 Found ${duplicates.length} duplicate groups`);

    // Step 2: For each duplicate group, keep only the earliest record
    for (const dup of duplicates) {
      const { ids } = dup;

      // Sort by createdAt ascending → earliest first
      ids.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      // Keep first (earliest), delete the rest
      const idsToDelete = ids.slice(1).map((x) => x.id);

      if (idsToDelete.length > 0) {
        await AttendanceLogModel.deleteMany({ _id: { $in: idsToDelete } });
        console.log(
          `🗑️ Deleted ${idsToDelete.length} newer duplicates for EmployeeCode=${dup._id.EmployeeCode}, Date=${new Date(
            dup._id.AttendanceDate
          ).toISOString().split("T")[0]}`
        );
      }
    }

    console.log("✅ Duplicate cleanup complete (kept earliest records)");
  } catch (error) {
    console.error("❌ Error removing duplicates:", error);
    throw error;
  }
}



const moment = require('moment'); // Make sure moment is installed

async function findCommonAttendanceAndUpdate() {
  try {
    // Step 1: Fetch OutDuty logs
    const outDutyLogs = await AttendanceLogForOutDuty.find(
      {},
      {
        AttendanceDate: 1,
        employeeId: 1,
        Status: 1,
        Duration: 1,
        PunchRecords: 1,
        InTime: 1,
        OutTime: 1,
      }
    ).limit(50000);

    // Step 2: Extract unique employeeIds
    const uniqueEmployeeIds = [
      ...new Set(outDutyLogs.map(log => String(log.employeeId)))
    ];

    // Step 3: Fetch main attendance logs
    const mainAttendanceLog = await AttendanceLogModel.find(
      { EmployeeCode: { $in: uniqueEmployeeIds } },
      {
        AttendanceDate: 1,
        EmployeeCode: 1,
        Status: 1,
        Duration: 1,
        PunchRecords: 1,
        InTime: 1,
        OutTime: 1,
      }
    );

    // Step 4: Merge and update
    for (const outLog of outDutyLogs) {
      const outDate = new Date(outLog.AttendanceDate).toISOString().slice(0, 10);
      const empId = String(outLog.employeeId);

      const matchedMainLog = mainAttendanceLog.find(mainLog => {
        const mainDate = new Date(mainLog.AttendanceDate).toISOString().slice(0, 10);
        return String(mainLog.EmployeeCode) === empId && mainDate === outDate;
      });

    
 if (matchedMainLog) {
  const combinedPunchRecords = `${matchedMainLog.PunchRecords || ''}${outLog.PunchRecords || ''}`;

  // Step 1: Normalize punches and remove duplicates
  const punchObjects = combinedPunchRecords
    .split(',')
    .map(p => {
      const timeMatch = p.match(/^(\d{2}:\d{2})/); // Extract HH:mm
      const typeMatch = p.match(/\b(in|out)\b/i); // Extract IN/OUT
      if (timeMatch && typeMatch) {
        return {
          raw: p.trim(),
          key: `${timeMatch[1]}_${typeMatch[1].toLowerCase()}`,
          time: moment(`${outDate} ${timeMatch[1]}`, 'YYYY-MM-DD HH:mm'),
          type: typeMatch[1].toLowerCase()
        };
      }
      return null;
    })
    .filter(p => p !== null);

  // Deduplicate by key (HH:mm_type)
  const seen = new Set();
  const uniquePunches = punchObjects.filter(p => {
    if (seen.has(p.key)) return false;
    seen.add(p.key);
    return true;
  });

  // Step 2: Sort punches chronologically
  const sortedPunches = uniquePunches.sort((a, b) => a.time - b.time);

  // Step 3: Pair IN and OUT punches and calculate duration
  let effectiveMinutes = 0;
  const inTimes = [];
  const outTimes = [];

  for (let i = 0; i < sortedPunches.length - 1; i++) {
    const current = sortedPunches[i];
    const next = sortedPunches[i + 1];

    if (current.type === 'in' && next.type === 'out' && next.time.isAfter(current.time)) {
      effectiveMinutes += next.time.diff(current.time, 'minutes');
      inTimes.push(current.time);
      outTimes.push(next.time);
      i++; // Skip next since it's paired
    }
  }

  // Step 4: Determine earliest IN and latest OUT
  const earliestIn = inTimes.length ? inTimes[0].format('YYYY-MM-DD HH:mm:00') : '';
  const latestOut = outTimes.length ? outTimes[outTimes.length - 1].format('YYYY-MM-DD HH:mm:00') : '';

  // Step 5: Update mainAttendanceLog
  await AttendanceLogModel.updateOne(
    {
      EmployeeCode: empId,
      AttendanceDate: matchedMainLog.AttendanceDate
    },
    {
      $set: {
        Duration: effectiveMinutes,
        PunchRecords: sortedPunches.map(p => p.raw).join(',') + ',',
        InTime: earliestIn,
        OutTime: latestOut
      }
    }
  );

  console.log(`✅ Updated ${empId} on ${outDate}: Duration = ${effectiveMinutes} mins, InTime = ${earliestIn}, OutTime = ${latestOut}`);
}



    }
  } catch (error) {
    console.error(" Error in findCommonAttendanceAndUpdate:", error);
    throw error;
  }
}








module.exports = { findAndCreateAttendanceLog, removeDuplicateAttendanceLogs, findCommonAttendanceAndUpdate };





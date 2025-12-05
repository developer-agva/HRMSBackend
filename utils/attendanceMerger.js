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

// Helper function to determine status based on duration
const determineStatus = (duration) => {
  if (duration >= 500) {
    return "Present"; // Full day (8.33+ hours)
  } else if (duration >= 240) {
    return "Half Day"; // Half day (4+ hours)
  } else {
    return "Absent"; // Less than 4 hours
  }
};

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
    let updateCount = 0;
    for (const outLog of outDutyLogs) {
      const outDate = new Date(outLog.AttendanceDate).toISOString().slice(0, 10);
      const empId = String(outLog.employeeId);

      const matchedMainLog = mainAttendanceLog.find(mainLog => {
        const mainDate = new Date(mainLog.AttendanceDate).toISOString().slice(0, 10);
        return String(mainLog.EmployeeCode) === empId && mainDate === outDate;
      });
      
      if (!matchedMainLog) {
        console.log(`⚠️ No matching main log found for employee ${empId} on ${outDate}`);
        continue;
      }

    
 if (matchedMainLog) {
  // Combine punch records - prioritize out duty records if main log has empty/invalid records
  const mainPunchRecords = (matchedMainLog.PunchRecords || '').trim();
  const outDutyPunchRecords = (outLog.PunchRecords || '').trim();
  
  // If main log has no valid punch records, use only out duty records
  // Otherwise, combine both (out duty records will take precedence due to deduplication)
  let combinedPunchRecords = '';
  if (!mainPunchRecords || mainPunchRecords === '' || mainPunchRecords === 'null') {
    combinedPunchRecords = outDutyPunchRecords;
  } else {
    combinedPunchRecords = `${mainPunchRecords},${outDutyPunchRecords}`;
  }

  // Step 1: Normalize punches and remove duplicates
  const punchObjects = combinedPunchRecords
    .split(',')
    .map(p => {
      const trimmed = p.trim();
      if (!trimmed || trimmed === '') return null;
      
      const timeMatch = trimmed.match(/^(\d{2}:\d{2})/); // Extract HH:mm
      const typeMatch = trimmed.match(/\b(in|out)\b/i); // Extract IN/OUT
      if (timeMatch && typeMatch) {
        return {
          raw: trimmed,
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
  let lastInTime = null;

  for (const punch of sortedPunches) {
    if (punch.type === 'in') {
      // If there's already an unmatched IN, ignore the previous one
      lastInTime = punch.time;
    } else if (punch.type === 'out' && lastInTime) {
      // Calculate duration between last IN and current OUT
      const duration = punch.time.diff(lastInTime, 'minutes');
      if (duration > 0) {
        effectiveMinutes += duration;
        inTimes.push(lastInTime);
        outTimes.push(punch.time);
      }
      lastInTime = null; // Reset for next pair
    }
  }

  // Step 4: Determine earliest IN and latest OUT
  // If we couldn't calculate from punch records, use InTime/OutTime from out duty record
  let earliestIn = inTimes.length ? inTimes[0].format('YYYY-MM-DD HH:mm:00') : '';
  let latestOut = outTimes.length ? outTimes[outTimes.length - 1].format('YYYY-MM-DD HH:mm:00') : '';
  
  // If no valid times from punch records, use out duty InTime/OutTime if available
  if (!earliestIn && outLog.InTime) {
    const outInTime = String(outLog.InTime).trim();
    if (outInTime && !outInTime.includes('1900-01-01') && outInTime !== '' && outInTime !== 'null') {
      earliestIn = outInTime;
    }
  }
  
  if (!latestOut && outLog.OutTime) {
    const outOutTime = String(outLog.OutTime).trim();
    if (outOutTime && !outOutTime.includes('1900-01-01') && outOutTime !== '' && outOutTime !== 'null') {
      latestOut = outOutTime;
    }
  }
  
  // If still no duration calculated from punch records, calculate from InTime/OutTime
  if (effectiveMinutes === 0 && earliestIn && latestOut) {
    try {
      const inDate = moment(earliestIn, 'YYYY-MM-DD HH:mm:ss');
      const outDate = moment(latestOut, 'YYYY-MM-DD HH:mm:ss');
      if (inDate.isValid() && outDate.isValid() && outDate.isAfter(inDate)) {
        effectiveMinutes = outDate.diff(inDate, 'minutes');
      }
    } catch (e) {
      console.warn(`Could not calculate duration from InTime/OutTime for ${empId} on ${outDate}:`, e.message);
    }
  }
  
  // If out duty has Duration field and we still don't have a value, use it
  if (effectiveMinutes === 0 && outLog.Duration) {
    const outDutyDuration = parseInt(outLog.Duration);
    if (!isNaN(outDutyDuration) && outDutyDuration > 0) {
      effectiveMinutes = outDutyDuration;
    }
  }

  // Step 5: Update mainAttendanceLog with Status, Present, and Absent fields
  const newStatus = determineStatus(effectiveMinutes);
  const isPresent = effectiveMinutes >= 240 ? 1 : 0;
  const isAbsent = effectiveMinutes < 240 ? 1 : 0;
  const statusCode = effectiveMinutes >= 500 ? "P" : effectiveMinutes >= 240 ? "HD" : "A";

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
        OutTime: latestOut,
        Status: newStatus,
        Present: isPresent,
        Absent: isAbsent,
        StatusCode: statusCode
      }
    }
  );

  updateCount++;
  console.log(`✅ Updated ${empId} on ${outDate}: Duration = ${effectiveMinutes} mins, Status = ${newStatus}, InTime = ${earliestIn}, OutTime = ${latestOut}, PunchRecords = ${sortedPunches.map(p => p.raw).join(',')}`);
} else {
  console.log(`⚠️ No matching main log found for employee ${empId} on ${outDate}`);
}



    }
    
    console.log(`✅ Merge completed. Total records processed: ${outDutyLogs.length}, Records updated: ${updateCount}`);
  } catch (error) {
    console.error("❌ Error in findCommonAttendanceAndUpdate:", error);
    throw error;
  }
}








module.exports = { findAndCreateAttendanceLog, removeDuplicateAttendanceLogs, findCommonAttendanceAndUpdate };





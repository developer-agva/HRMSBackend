const mongoose = require('mongoose');
require('dotenv').config();

// Import the models
const AttendanceLogModel = require('./models/attendanceLogModel');
const AttendanceLogForOutDutyModel = require('./models/attendanceLogModelForOutDuty');
const EmployeeModel = require('./models/employeeModel');

/**
 * Connects to MongoDB using the existing configuration
 */
const connectToMongoDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10,
      retryWrites: true,
      w: 'majority'
    });
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ Failed to connect to MongoDB", err);
    throw err;
  }
};

/**
 * Normalizes employee ID for comparison
 */
const normalizeEmployeeId = (employeeId) => {
  if (employeeId === null || employeeId === undefined) {
    return null;
  }
  if (typeof employeeId === 'string') {
    return employeeId.trim();
  }
  return employeeId.toString();
};

/**
 * Normalizes date to YYYY-MM-DD format
 */
const normalizeDate = (date) => {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * Calculates duration in minutes from InTime and OutTime
 */
const calculateDurationFromTimes = (inTime, outTime) => {
  if (!inTime || !outTime) return 0;
  
  try {
    const inDateTime = new Date(inTime);
    const outDateTime = new Date(outTime);
    
    if (isNaN(inDateTime.getTime()) || isNaN(outDateTime.getTime())) {
      return 0;
    }
    
    const durationMs = outDateTime.getTime() - inDateTime.getTime();
    return Math.max(0, Math.round(durationMs / (1000 * 60))); // Convert to minutes
  } catch (error) {
    console.error("Error calculating duration:", error.message);
    return 0;
  }
};

/**
 * Calculates duration from punch records
 */
const calculateDurationFromPunchRecords = (punchRecords, baseDate) => {
  if (!punchRecords || punchRecords.trim() === '') return 0;
  
  const punches = punchRecords.split(',').filter(p => p.trim() !== '');
  let totalDuration = 0;
  let inTime = null;

  for (const punch of punches) {
    const match = punch.match(/(\d{2}:\d{2}):(in|out)\((IN|OUT)\)/);
    if (!match) continue;

    const [, timeStr, type] = match;
    const [hours, minutes] = timeStr.split(':').map(Number);
    const punchDateTime = new Date(baseDate);
    punchDateTime.setHours(hours, minutes, 0, 0);

    if (type === 'in') {
      inTime = punchDateTime;
    } else if (type === 'out' && inTime) {
      totalDuration += (punchDateTime.getTime() - inTime.getTime()) / (1000 * 60);
      inTime = null;
    }
  }
  return Math.round(totalDuration);
};

/**
 * Parses existing duration string to minutes
 */
const parseDurationToMinutes = (durationStr) => {
  if (!durationStr || typeof durationStr !== 'string') {
    return 0;
  }
  
  const match = durationStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

/**
 * Determines status based on total duration
 */
const determineStatus = (totalDuration) => {
  if (totalDuration >= 500) {
    return "Full Day";
  } else if (totalDuration >= 240 && totalDuration < 500) {
    return "Half Day";
  } else {
    return "Absent";
  }
};

/**
 * Finds the best matching attendance log for an out-duty record
 */
const findBestMatchingAttendanceLog = async (outDutyRecord, allAttendanceLogs) => {
  const normalizedOutDutyEmployeeId = normalizeEmployeeId(outDutyRecord.employeeId);
  const outDutyDate = normalizeDate(outDutyRecord.AttendanceDate);
  
  // Phase 1: Exact match (EmployeeCode + Date)
  let exactMatch = allAttendanceLogs.find(log => 
    normalizeEmployeeId(log.EmployeeCode) === normalizedOutDutyEmployeeId &&
    normalizeDate(log.AttendanceDate) === outDutyDate
  );
  
  if (exactMatch) {
    return { match: exactMatch, type: 'exact' };
  }
  
  // Phase 2: EmployeeId match + Date
  exactMatch = allAttendanceLogs.find(log => 
    normalizeEmployeeId(log.EmployeeId) === normalizedOutDutyEmployeeId &&
    normalizeDate(log.AttendanceDate) === outDutyDate
  );
  
  if (exactMatch) {
    return { match: exactMatch, type: 'exact_employee_id' };
  }
  
  // Phase 3: Same EmployeeCode, nearest date within ±7 days
  const sameEmployeeLogs = allAttendanceLogs.filter(log => 
    normalizeEmployeeId(log.EmployeeCode) === normalizedOutDutyEmployeeId
  );
  
  if (sameEmployeeLogs.length > 0) {
    const outDutyDateTime = new Date(outDutyRecord.AttendanceDate);
    let nearestMatch = null;
    let minDaysDiff = Infinity;
    
    for (const log of sameEmployeeLogs) {
      const logDateTime = new Date(log.AttendanceDate);
      const daysDiff = Math.abs((outDutyDateTime - logDateTime) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 7 && daysDiff < minDaysDiff) {
        minDaysDiff = daysDiff;
        nearestMatch = log;
      }
    }
    
    if (nearestMatch) {
      return { match: nearestMatch, type: 'nearby', daysDiff: minDaysDiff };
    }
  }
  
  // Phase 4: Same EmployeeId, nearest date within ±7 days
  const sameEmployeeIdLogs = allAttendanceLogs.filter(log => 
    normalizeEmployeeId(log.EmployeeId) === normalizedOutDutyEmployeeId
  );
  
  if (sameEmployeeIdLogs.length > 0) {
    const outDutyDateTime = new Date(outDutyRecord.AttendanceDate);
    let nearestMatch = null;
    let minDaysDiff = Infinity;
    
    for (const log of sameEmployeeIdLogs) {
      const logDateTime = new Date(log.AttendanceDate);
      const daysDiff = Math.abs((outDutyDateTime - logDateTime) / (1000 * 60 * 60 * 24));
      
      if (daysDiff <= 7 && daysDiff < minDaysDiff) {
        minDaysDiff = daysDiff;
        nearestMatch = log;
      }
    }
    
    if (nearestMatch) {
      return { match: nearestMatch, type: 'nearby_employee_id', daysDiff: minDaysDiff };
    }
  }
  
  return null;
};

/**
 * Creates a new attendance log from out-duty record
 */
const createNewAttendanceLogFromOutDuty = (outDutyRecord, workOutside) => {
  const outDutyDuration = calculateDurationFromTimes(outDutyRecord.InTime, outDutyRecord.OutTime) ||
                         calculateDurationFromPunchRecords(outDutyRecord.PunchRecords, outDutyRecord.AttendanceDate) ||
                         parseDurationToMinutes(outDutyRecord.Duration);
  
  const newAttendanceLog = {
    EmployeeId: parseInt(outDutyRecord.employeeId) || outDutyRecord.employeeId,
    EmployeeCode: outDutyRecord.employeeId.toString(),
    EmployeeName: `Employee ${outDutyRecord.employeeId}`,
    AttendanceDate: new Date(outDutyRecord.AttendanceDate),
    Duration: outDutyDuration,
    Status: determineStatus(outDutyDuration),
    DurationSource: "Out Duty Only",
    WorkOutside: !!workOutside,
    MergedOn: new Date(),
    InTime: outDutyRecord.InTime || null,
    OutTime: outDutyRecord.OutTime || null,
    PunchRecords: outDutyRecord.PunchRecords || "",
    Location: outDutyRecord.location || "",
    Present: 1,
    Absent: outDutyDuration < 240 ? 1 : 0,
    Holiday: 0,
    WeeklyOff: 0,
    IsOnLeave: 0,
    LateBy: 0,
    EarlyBy: 0,
    OverTime: 0,
    LossOfHours: 0,
    LeaveDuration: 0,
    SpecialOffDuration: 0,
    Remarks: "Created from out-duty record",
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  return newAttendanceLog;
};

/**
 * Updates existing attendance log with out-duty data
 */
const updateAttendanceLogWithOutDuty = (attendanceLog, outDutyRecord, workOutside) => {
  const outDutyDuration = calculateDurationFromTimes(outDutyRecord.InTime, outDutyRecord.OutTime) ||
                         calculateDurationFromPunchRecords(outDutyRecord.PunchRecords, outDutyRecord.AttendanceDate) ||
                         parseDurationToMinutes(outDutyRecord.Duration);
  
  const totalDuration = (attendanceLog.Duration || 0) + outDutyDuration;
  
  return {
    ...attendanceLog,
    Duration: totalDuration,
    Status: determineStatus(totalDuration),
    DurationSource: "Office + Out Duty",
    WorkOutside: attendanceLog.WorkOutside === true ? true : !!workOutside,
    MergedOn: new Date(),
    PunchRecords: attendanceLog.PunchRecords ? 
      `${attendanceLog.PunchRecords} || OUT-DUTY: ${outDutyRecord.PunchRecords || ''}` : 
      outDutyRecord.PunchRecords || "",
    Location: attendanceLog.Location ? 
      `${attendanceLog.Location} || OUT-DUTY: ${outDutyRecord.location || ''}` : 
      outDutyRecord.location || "",
    Present: 1,
    Absent: totalDuration < 240 ? 1 : 0,
    updatedAt: new Date()
  };
};

/**
 * Main merge function - processes ALL existing data
 */
const mergeAllExistingData = async () => {
  try {
    console.log("🚀 STARTING COMPREHENSIVE MERGE OF ALL EXISTING DATA");
    console.log("🎯 GOAL: Merge ALL out-duty records with ALL attendance logs");
    console.log("=".repeat(80));
    
    // Get ALL out-duty records (no date restrictions)
    const allOutDutyRecords = await AttendanceLogForOutDutyModel.find({}).lean();
    console.log(`📊 Found ${allOutDutyRecords.length} out-duty records to process`);
    
    // Get ALL attendance logs (no date restrictions)
    const allAttendanceLogs = await AttendanceLogModel.find({}).lean();
    console.log(`📊 Found ${allAttendanceLogs.length} existing attendance logs`);

    // Build a set of employees who have work_outside = true (by both employeeId and employeeCode)
    const outsideEmployees = await EmployeeModel.find({ work_outside: true }).select('employeeId employeeCode').lean();
    const workOutsideSet = new Set();
    for (const emp of outsideEmployees) {
      if (emp.employeeId) workOutsideSet.add(String(emp.employeeId));
      if (emp.employeeCode) workOutsideSet.add(String(emp.employeeCode));
    }
    
    let updatedCount = 0;
    let createdCount = 0;
    let processedCount = 0;
    let skippedCount = 0;
    const bulkOps = [];
    
    console.log("\n🔄 Processing each out-duty record...");
    
    for (const outDutyRecord of allOutDutyRecords) {
      processedCount++;
      
      // Skip records with null/undefined employee IDs
      if (!outDutyRecord.employeeId) {
        console.log(`⚠️ ${processedCount}/${allOutDutyRecords.length}: Skipped record with null employeeId`);
        continue;
      }
      
      const normalizedEmployeeId = normalizeEmployeeId(outDutyRecord.employeeId);
      const normalizedDate = normalizeDate(outDutyRecord.AttendanceDate);
      
      // Find best matching attendance log
      const matchResult = await findBestMatchingAttendanceLog(outDutyRecord, allAttendanceLogs);
      
      if (matchResult) {
        // Check if this record is already merged
        const existingDurationSource = matchResult.match.DurationSource;
        if (existingDurationSource && existingDurationSource.includes("Out Duty")) {
          skippedCount++;
          console.log(`⏭️ ${processedCount}/${allOutDutyRecords.length}: Skipped EmployeeId ${normalizedEmployeeId} for ${normalizedDate} (already merged)`);
          continue;
        }
        
        // Update existing attendance log
        const workOutside = workOutsideSet.has(String(outDutyRecord.employeeId));
        const updatedLog = updateAttendanceLogWithOutDuty(matchResult.match, outDutyRecord, workOutside);
        
        bulkOps.push({
          updateOne: {
            filter: { _id: matchResult.match._id },
            update: { $set: updatedLog }
          }
        });
        
        updatedCount++;
        
        const outDutyDuration = calculateDurationFromTimes(outDutyRecord.InTime, outDutyRecord.OutTime) ||
                               calculateDurationFromPunchRecords(outDutyRecord.PunchRecords, outDutyRecord.AttendanceDate) ||
                               parseDurationToMinutes(outDutyRecord.Duration);
        
        console.log(`✅ ${processedCount}/${allOutDutyRecords.length}: Updated EmployeeId ${normalizedEmployeeId} for ${normalizedDate} (${matchResult.type}${matchResult.daysDiff ? `, ${matchResult.daysDiff.toFixed(1)} days diff` : ''})`);
        console.log(`   ${matchResult.match.Duration || 0} + ${outDutyDuration} = ${updatedLog.Duration} minutes (${updatedLog.Status})`);
        
      } else {
        // Create new attendance log
        const workOutside = workOutsideSet.has(String(outDutyRecord.employeeId));
        const newAttendanceLog = createNewAttendanceLogFromOutDuty(outDutyRecord, workOutside);
        
        bulkOps.push({
          insertOne: {
            document: newAttendanceLog
          }
        });
        
        createdCount++;
        
        console.log(`🆕 ${processedCount}/${allOutDutyRecords.length}: Created new attendance log for EmployeeId ${normalizedEmployeeId} on ${normalizedDate}`);
        console.log(`   Duration: ${newAttendanceLog.Duration} minutes (${newAttendanceLog.Status})`);
      }
      
      // Progress update every 50 records
      if (processedCount % 50 === 0) {
        console.log(`📈 Progress: ${processedCount}/${allOutDutyRecords.length} processed`);
      }
    }
    
    console.log("\n🔄 Executing bulk operations...");
    
    if (bulkOps.length > 0) {
      await AttendanceLogModel.bulkWrite(bulkOps, { ordered: false });
      console.log(`✅ Successfully processed ${bulkOps.length} operations`);
    }
    
    // Final summary
    console.log("\n🎉 COMPREHENSIVE MERGE COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(80));
    console.log(`📊 Total Out-Duty Records: ${allOutDutyRecords.length}`);
    console.log(`✅ Updated Existing Records: ${updatedCount}`);
    console.log(`🆕 Newly Created Records: ${createdCount}`);
    console.log(`⏭️ Skipped (Already Merged): ${skippedCount}`);
    console.log(`📈 Total Processed: ${updatedCount + createdCount}`);
    console.log(`🎯 Coverage: ${((updatedCount + createdCount) / allOutDutyRecords.length * 100).toFixed(1)}%`);
    
    // Show final statistics
    await showFinalStatistics();
    
  } catch (error) {
    console.error("❌ Error in comprehensive merge process:", error);
    throw error;
  }
};

/**
 * Shows final statistics
 */
const showFinalStatistics = async () => {
  try {
    console.log("\n📊 FINAL STATISTICS:");
    console.log("=".repeat(80));
    
    // Get all merged records
    const mergedRecords = await AttendanceLogModel.find({
      $or: [
        { DurationSource: "Office + Out Duty" },
        { DurationSource: "Out Duty Only" }
      ]
    }).lean();
    
    console.log(`📈 Total merged attendance records: ${mergedRecords.length}`);
    
    // Get unique employees with merged records
    const uniqueEmployees = [...new Set(mergedRecords.map(r => r.EmployeeId))];
    console.log(`👥 Unique employees with merged records: ${uniqueEmployees.length}`);
    
    // Get date range
    const dates = mergedRecords.map(r => new Date(r.AttendanceDate).toISOString().split('T')[0]);
    const sortedDates = dates.sort();
    console.log(`📅 Date range: ${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`);
    
    // Get status breakdown
    const statusCounts = {};
    for (const record of mergedRecords) {
      const status = record.Status || 'Unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }
    
    console.log("\n📋 Status breakdown:");
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`   ${status}: ${count} records`);
    }
    
    // Get duration statistics
    const durations = mergedRecords.map(r => r.Duration).filter(d => d > 0);
    if (durations.length > 0) {
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);
      
      console.log("\n⏱️ Duration statistics:");
      console.log(`   Average: ${Math.round(avgDuration)} minutes (${Math.round(avgDuration / 60)}h ${Math.round(avgDuration % 60)}m)`);
      console.log(`   Minimum: ${minDuration} minutes (${Math.round(minDuration / 60)}h ${Math.round(minDuration % 60)}m)`);
      console.log(`   Maximum: ${maxDuration} minutes (${Math.round(maxDuration / 60)}h ${Math.round(maxDuration % 60)}m)`);
    }
    
    // Get source breakdown
    const sourceCounts = {};
    for (const record of mergedRecords) {
      const source = record.DurationSource || 'Unknown';
      sourceCounts[source] = (sourceCounts[source] || 0) + 1;
    }
    
    console.log("\n📋 Source breakdown:");
    for (const [source, count] of Object.entries(sourceCounts)) {
      console.log(`   ${source}: ${count} records`);
    }
    
  } catch (error) {
    console.error("❌ Error showing statistics:", error);
    throw error;
  }
};

/**
 * Main execution function
 */
const main = async () => {
  try {
    // Connect to MongoDB
    await connectToMongoDB();
    
    // Merge all existing data
    await mergeAllExistingData();
    
    console.log("\n✅ All operations completed successfully!");
    
  } catch (error) {
    console.error("❌ Process failed:", error);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
  }
};

// Run the script if called directly
if (require.main === module) {
  main();
}

module.exports = {
  mergeAllExistingData,
  findBestMatchingAttendanceLog,
  createNewAttendanceLogFromOutDuty,
  updateAttendanceLogWithOutDuty,
  showFinalStatistics
};

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
  
  // Skip if employee ID is null/undefined
  if (!normalizedOutDutyEmployeeId) {
    return null;
  }
  
  // Phase 1: Exact match (EmployeeCode + Date)
  let exactMatch = allAttendanceLogs.find(log => {
    const logEmployeeCode = normalizeEmployeeId(log.EmployeeCode);
    const logDate = normalizeDate(log.AttendanceDate);
    return logEmployeeCode && logEmployeeCode === normalizedOutDutyEmployeeId && logDate === outDutyDate;
  });
  
  if (exactMatch) {
    return { match: exactMatch, type: 'exact' };
  }
  
  // Phase 2: EmployeeId match + Date
  exactMatch = allAttendanceLogs.find(log => {
    const logEmployeeId = normalizeEmployeeId(log.EmployeeId);
    const logDate = normalizeDate(log.AttendanceDate);
    return logEmployeeId && logEmployeeId === normalizedOutDutyEmployeeId && logDate === outDutyDate;
  });
  
  if (exactMatch) {
    return { match: exactMatch, type: 'exact_employee_id' };
  }
  
  // Phase 3: Same EmployeeCode, nearest date within ±7 days
  const sameEmployeeLogs = allAttendanceLogs.filter(log => {
    const logEmployeeCode = normalizeEmployeeId(log.EmployeeCode);
    return logEmployeeCode && logEmployeeCode === normalizedOutDutyEmployeeId;
  });
  
  if (sameEmployeeLogs.length > 0) {
    const outDutyDateTime = new Date(outDutyRecord.AttendanceDate);
    if (isNaN(outDutyDateTime.getTime())) {
      return null; // Invalid date
    }
    
    let nearestMatch = null;
    let minDaysDiff = Infinity;
    
    for (const log of sameEmployeeLogs) {
      const logDateTime = new Date(log.AttendanceDate);
      if (isNaN(logDateTime.getTime())) continue;
      
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
  const sameEmployeeIdLogs = allAttendanceLogs.filter(log => {
    const logEmployeeId = normalizeEmployeeId(log.EmployeeId);
    return logEmployeeId && logEmployeeId === normalizedOutDutyEmployeeId;
  });
  
  if (sameEmployeeIdLogs.length > 0) {
    const outDutyDateTime = new Date(outDutyRecord.AttendanceDate);
    if (isNaN(outDutyDateTime.getTime())) {
      return null; // Invalid date
    }
    
    let nearestMatch = null;
    let minDaysDiff = Infinity;
    
    for (const log of sameEmployeeIdLogs) {
      const logDateTime = new Date(log.AttendanceDate);
      if (isNaN(logDateTime.getTime())) continue;
      
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
const createNewAttendanceLogFromOutDuty = (outDutyRecord, workOutside, employeeInfo = null) => {
  const outDutyDuration = calculateDurationFromTimes(outDutyRecord.InTime, outDutyRecord.OutTime) ||
                         calculateDurationFromPunchRecords(outDutyRecord.PunchRecords, outDutyRecord.AttendanceDate) ||
                         parseDurationToMinutes(outDutyRecord.Duration);
  
  // Get employee ID as number
  const employeeIdNum = parseInt(outDutyRecord.employeeId) || (typeof outDutyRecord.employeeId === 'number' ? outDutyRecord.employeeId : 0);
  
  // Generate a unique AttendanceLogId (using timestamp + employeeId)
  const attendanceLogId = Date.now() % 1000000000 + employeeIdNum;
  
  const newAttendanceLog = {
    EmployeeId: employeeIdNum,
    EmployeeCode: outDutyRecord.employeeId.toString(),
    EmployeeName: employeeInfo?.name || employeeInfo?.employeeName || `Employee ${outDutyRecord.employeeId}`,
    Gender: employeeInfo?.gender || "Not Specified",
    CategoryId: employeeInfo?.categoryId || employeeInfo?.CategoryId || 1,
    AttendanceLogId: attendanceLogId,
    AttendanceDate: new Date(outDutyRecord.AttendanceDate),
    ShiftId: employeeInfo?.shiftId || employeeInfo?.ShiftId || 1,
    Duration: outDutyDuration,
    Status: determineStatus(outDutyDuration),
    StatusCode: determineStatus(outDutyDuration) === "Full Day" ? "P" : determineStatus(outDutyDuration) === "Half Day" ? "HD" : "A",
    DurationSource: "Out Duty Only",
    WorkOutside: !!workOutside,
    MergedOn: new Date(),
    InTime: outDutyRecord.InTime || "1900-01-01 00:00:00",
    OutTime: outDutyRecord.OutTime || "1900-01-01 00:00:00",
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

    // Build a set of employees who have work_outside = true (by both employeeId and employeeCode)
    const outsideEmployees = await EmployeeModel.find({ work_outside: true }).select('employeeId employeeCode').lean();
    const workOutsideSet = new Set();
    for (const emp of outsideEmployees) {
      if (emp.employeeId) workOutsideSet.add(String(emp.employeeId));
      if (emp.employeeCode) workOutsideSet.add(String(emp.employeeCode));
    }
    
    // Build employee lookup map for creating new attendance logs
    const allEmployees = await EmployeeModel.find({}).select('employeeId employeeCode name employeeName gender categoryId CategoryId shiftId ShiftId').lean();
    const employeeMap = new Map();
    for (const emp of allEmployees) {
      const key1 = emp.employeeId ? String(emp.employeeId) : null;
      const key2 = emp.employeeCode ? String(emp.employeeCode) : null;
      if (key1) employeeMap.set(key1, emp);
      if (key2) employeeMap.set(key2, emp);
    }
    
    // Track processed out-duty records to avoid duplicates
    const processedOutDutyIds = new Set();
    
    let updatedCount = 0;
    let createdCount = 0;
    let processedCount = 0;
    let skippedCount = 0;
    const BATCH_SIZE = 100; // Process in batches to reload attendance logs
    
    console.log("\n🔄 Processing out-duty records in batches...");
    
    // Process in batches
    for (let i = 0; i < allOutDutyRecords.length; i += BATCH_SIZE) {
      const batch = allOutDutyRecords.slice(i, i + BATCH_SIZE);
      const bulkOps = [];
      
      // Reload attendance logs at the start of each batch to include newly created records
      const allAttendanceLogs = await AttendanceLogModel.find({}).lean();
      console.log(`\n📊 Batch ${Math.floor(i / BATCH_SIZE) + 1}: Processing ${batch.length} records (Total attendance logs: ${allAttendanceLogs.length})`);
      
      for (const outDutyRecord of batch) {
        processedCount++;
        
        // Skip records with null/undefined employee IDs
        if (!outDutyRecord.employeeId) {
          skippedCount++;
          console.log(`⚠️ ${processedCount}/${allOutDutyRecords.length}: Skipped record with null employeeId`);
          continue;
        }
        
        // Create unique key for this out-duty record
        const outDutyKey = `${normalizeEmployeeId(outDutyRecord.employeeId)}_${normalizeDate(outDutyRecord.AttendanceDate)}_${outDutyRecord._id}`;
        
        // Skip if already processed
        if (processedOutDutyIds.has(outDutyKey)) {
          skippedCount++;
          continue;
        }
        
        const normalizedEmployeeId = normalizeEmployeeId(outDutyRecord.employeeId);
        const normalizedDate = normalizeDate(outDutyRecord.AttendanceDate);
        
        // Find best matching attendance log
        const matchResult = await findBestMatchingAttendanceLog(outDutyRecord, allAttendanceLogs);
        
        if (matchResult) {
          // Check if this specific out-duty record is already merged
          // We check if the attendance log already has this out-duty's data
          const existingPunchRecords = matchResult.match.PunchRecords || '';
          const outDutyPunchRecords = outDutyRecord.PunchRecords || '';
          const existingLocation = matchResult.match.Location || '';
          const outDutyLocation = outDutyRecord.location || '';
          
          // Check if this out-duty record's data is already in the attendance log
          // We check both punch records and location to be more reliable
          const punchRecordsMatch = outDutyPunchRecords && 
            (existingPunchRecords.includes(outDutyPunchRecords) || 
             existingPunchRecords.includes(`OUT-DUTY: ${outDutyPunchRecords}`));
          const locationMatch = outDutyLocation && 
            (existingLocation.includes(outDutyLocation) || 
             existingLocation.includes(`OUT-DUTY: ${outDutyLocation}`));
          
          // Only skip if we're confident this exact record was already merged
          // (both punch records and location match, or punch records are substantial and match)
          if (punchRecordsMatch && (locationMatch || outDutyPunchRecords.length > 20)) {
            skippedCount++;
            processedOutDutyIds.add(outDutyKey);
            console.log(`⏭️ ${processedCount}/${allOutDutyRecords.length}: Skipped EmployeeId ${normalizedEmployeeId} for ${normalizedDate} (already merged in attendance log)`);
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
          processedOutDutyIds.add(outDutyKey);
          
          const outDutyDuration = calculateDurationFromTimes(outDutyRecord.InTime, outDutyRecord.OutTime) ||
                                 calculateDurationFromPunchRecords(outDutyRecord.PunchRecords, outDutyRecord.AttendanceDate) ||
                                 parseDurationToMinutes(outDutyRecord.Duration);
          
          console.log(`✅ ${processedCount}/${allOutDutyRecords.length}: Updated EmployeeId ${normalizedEmployeeId} for ${normalizedDate} (${matchResult.type}${matchResult.daysDiff ? `, ${matchResult.daysDiff.toFixed(1)} days diff` : ''})`);
          console.log(`   ${matchResult.match.Duration || 0} + ${outDutyDuration} = ${updatedLog.Duration} minutes (${updatedLog.Status})`);
          
        } else {
          // Check if we already created a record for this employee/date in this batch
          const employeeDateKey = `${normalizedEmployeeId}_${normalizedDate}`;
          const alreadyCreatedInBatch = bulkOps.some(op => {
            if (op.insertOne) {
              const doc = op.insertOne.document;
              const docKey = `${normalizeEmployeeId(doc.EmployeeCode || doc.EmployeeId)}_${normalizeDate(doc.AttendanceDate)}`;
              return docKey === employeeDateKey;
            }
            return false;
          });
          
          if (alreadyCreatedInBatch) {
            // Find the newly created record in bulkOps and update it instead
            const insertOpIndex = bulkOps.findIndex(op => {
              if (op.insertOne) {
                const doc = op.insertOne.document;
                const docKey = `${normalizeEmployeeId(doc.EmployeeCode || doc.EmployeeId)}_${normalizeDate(doc.AttendanceDate)}`;
                return docKey === employeeDateKey;
              }
              return false;
            });
            
            if (insertOpIndex !== -1) {
              // Update the existing insert operation to merge durations
              const existingDoc = bulkOps[insertOpIndex].insertOne.document;
              const outDutyDuration = calculateDurationFromTimes(outDutyRecord.InTime, outDutyRecord.OutTime) ||
                                     calculateDurationFromPunchRecords(outDutyRecord.PunchRecords, outDutyRecord.AttendanceDate) ||
                                     parseDurationToMinutes(outDutyRecord.Duration);
              
              existingDoc.Duration = (existingDoc.Duration || 0) + outDutyDuration;
              existingDoc.Status = determineStatus(existingDoc.Duration);
              existingDoc.DurationSource = "Out Duty Only";
              existingDoc.PunchRecords = existingDoc.PunchRecords ? 
                `${existingDoc.PunchRecords}, ${outDutyRecord.PunchRecords || ''}` : 
                outDutyRecord.PunchRecords || "";
              existingDoc.Location = existingDoc.Location ? 
                `${existingDoc.Location} || ${outDutyRecord.location || ''}` : 
                outDutyRecord.location || "";
              
              processedOutDutyIds.add(outDutyKey);
              console.log(`🔄 ${processedCount}/${allOutDutyRecords.length}: Merged additional out-duty for EmployeeId ${normalizedEmployeeId} on ${normalizedDate}`);
              continue;
            }
          }
          
          // Create new attendance log
          const workOutside = workOutsideSet.has(String(outDutyRecord.employeeId));
          const employeeInfo = employeeMap.get(String(outDutyRecord.employeeId)) || employeeMap.get(normalizeEmployeeId(outDutyRecord.employeeId));
          const newAttendanceLog = createNewAttendanceLogFromOutDuty(outDutyRecord, workOutside, employeeInfo);
          
          bulkOps.push({
            insertOne: {
              document: newAttendanceLog
            }
          });
          
          createdCount++;
          processedOutDutyIds.add(outDutyKey);
          
          console.log(`🆕 ${processedCount}/${allOutDutyRecords.length}: Created new attendance log for EmployeeId ${normalizedEmployeeId} on ${normalizedDate}`);
          console.log(`   Duration: ${newAttendanceLog.Duration} minutes (${newAttendanceLog.Status})`);
        }
      }
      
      // Execute bulk operations for this batch
      if (bulkOps.length > 0) {
        try {
          await AttendanceLogModel.bulkWrite(bulkOps, { ordered: false });
          console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: Successfully processed ${bulkOps.length} operations`);
        } catch (error) {
          console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1}: Error in bulk write:`, error.message);
          // Continue with next batch even if this one fails
        }
      }
      
      // Progress update
      console.log(`📈 Overall Progress: ${processedCount}/${allOutDutyRecords.length} processed (${((processedCount / allOutDutyRecords.length) * 100).toFixed(1)}%)`);
    }
    
    // Final summary
    const summary = {
      totalOutDutyRecords: allOutDutyRecords.length,
      updatedExistingRecords: updatedCount,
      newlyCreatedRecords: createdCount,
      skippedAlreadyMerged: skippedCount,
      totalProcessed: updatedCount + createdCount,
      coveragePercentage: ((updatedCount + createdCount) / allOutDutyRecords.length * 100).toFixed(1)
    };
    
    console.log("\n🎉 COMPREHENSIVE MERGE COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(80));
    console.log(`📊 Total Out-Duty Records: ${summary.totalOutDutyRecords}`);
    console.log(`✅ Updated Existing Records: ${summary.updatedExistingRecords}`);
    console.log(`🆕 Newly Created Records: ${summary.newlyCreatedRecords}`);
    console.log(`⏭️ Skipped (Already Merged): ${summary.skippedAlreadyMerged}`);
    console.log(`📈 Total Processed: ${summary.totalProcessed}`);
    console.log(`🎯 Coverage: ${summary.coveragePercentage}%`);
    
    // Get final statistics
    const finalStats = await showFinalStatistics();
    
    // Get final count of attendance logs
    const finalAttendanceLogCount = await AttendanceLogModel.countDocuments({});
    
    return {
      summary,
      finalStatistics: finalStats,
      logs: [
        "🚀 STARTING COMPREHENSIVE MERGE OF ALL EXISTING DATA",
        "🎯 GOAL: Merge ALL out-duty records with ALL attendance logs",
        `📊 Found ${allOutDutyRecords.length} out-duty records to process`,
        `📊 Final attendance logs count: ${finalAttendanceLogCount}`,
        `✅ Successfully processed ${updatedCount + createdCount} operations`,
        "🎉 COMPREHENSIVE MERGE COMPLETED SUCCESSFULLY!"
      ]
    };
    
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
    let durationStats = null;
    if (durations.length > 0) {
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);
      
      durationStats = {
        average: Math.round(avgDuration),
        averageFormatted: `${Math.round(avgDuration / 60)}h ${Math.round(avgDuration % 60)}m`,
        minimum: minDuration,
        minimumFormatted: `${Math.round(minDuration / 60)}h ${Math.round(minDuration % 60)}m`,
        maximum: maxDuration,
        maximumFormatted: `${Math.round(maxDuration / 60)}h ${Math.round(maxDuration % 60)}m`
      };
      
      console.log("\n⏱️ Duration statistics:");
      console.log(`   Average: ${durationStats.average} minutes (${durationStats.averageFormatted})`);
      console.log(`   Minimum: ${durationStats.minimum} minutes (${durationStats.minimumFormatted})`);
      console.log(`   Maximum: ${durationStats.maximum} minutes (${durationStats.maximumFormatted})`);
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
    
    // Return structured data
    return {
      totalMergedRecords: mergedRecords.length,
      uniqueEmployeesWithMergedRecords: uniqueEmployees.length,
      dateRange: {
        earliest: sortedDates[0],
        latest: sortedDates[sortedDates.length - 1]
      },
      statusBreakdown: statusCounts,
      sourceBreakdown: sourceCounts,
      durationStatistics: durationStats
    };
    
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

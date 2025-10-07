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
 * Parses punch records and calculates total duration
 * @param {string} punchRecords - Punch records string
 * @returns {number} Total duration in minutes
 */
const calculateDurationFromPunchRecords = (punchRecords) => {
  if (!punchRecords || typeof punchRecords !== 'string') {
    return 0;
  }

  try {
    // Parse punch records: "12:28:in(IN),12:43:out(OUT),14:00:in(IN),14:05:out(OUT),..."
    const punches = punchRecords.split(',').filter(p => p.trim() !== '');
    
    let totalMinutes = 0;
    let lastInTime = null;
    
    for (const punch of punches) {
      const parts = punch.split(':');
      if (parts.length >= 3) {
        const timeStr = `${parts[0]}:${parts[1]}`;
        const action = parts[2].toLowerCase();
        
        // Parse time
        const [hours, minutes] = timeStr.split(':').map(Number);
        const punchTime = hours * 60 + minutes;
        
        if (action.includes('in')) {
          lastInTime = punchTime;
        } else if (action.includes('out') && lastInTime !== null) {
          const duration = punchTime - lastInTime;
          if (duration > 0) {
            totalMinutes += duration;
          }
          lastInTime = null;
        }
      }
    }
    
    return totalMinutes;
  } catch (error) {
    console.error("Error parsing punch records:", error);
    return 0;
  }
};

/**
 * Calculates duration from InTime and OutTime
 * @param {string} inTime - In time string
 * @param {string} outTime - Out time string
 * @returns {number} Duration in minutes
 */
const calculateDurationFromTimes = (inTime, outTime) => {
  if (!inTime || !outTime) return 0;
  
  try {
    // Parse times like "2025-07-29 12:28:35"
    const inDate = new Date(inTime);
    const outDate = new Date(outTime);
    
    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
      return 0;
    }
    
    const diffMs = outDate.getTime() - inDate.getTime();
    // If positive but less than one full minute, treat as 1 minute
    if (diffMs > 0 && diffMs < 60 * 1000) {
      return 1;
    }
    return Math.floor(diffMs / (1000 * 60)); // Convert to minutes
  } catch (error) {
    console.error("Error parsing times:", error);
    return 0;
  }
};

/**
 * Calculates span (first IN to last OUT) from punch records
 * @param {string} punchRecords
 * @returns {number} Duration in minutes
 */
const calculateSpanFromPunchRecords = (punchRecords) => {
  if (!punchRecords || typeof punchRecords !== 'string') {
    return 0;
  }
  try {
    const punches = punchRecords.split(',').filter(p => p.trim() !== '');
    let firstIn = null;
    let lastOut = null;
    for (const punch of punches) {
      const parts = punch.split(':');
      if (parts.length >= 3) {
        const timeStr = `${parts[0]}:${parts[1]}`;
        const action = parts[2].toLowerCase();
        const [hours, minutes] = timeStr.split(':').map(Number);
        const minutesSinceMidnight = hours * 60 + minutes;
        if (action.includes('in')) {
          if (firstIn === null || minutesSinceMidnight < firstIn) {
            firstIn = minutesSinceMidnight;
          }
        } else if (action.includes('out')) {
          if (lastOut === null || minutesSinceMidnight > lastOut) {
            lastOut = minutesSinceMidnight;
          }
        }
      }
    }
    if (firstIn !== null && lastOut !== null && lastOut >= firstIn) {
      const diff = lastOut - firstIn;
      return diff > 0 ? diff : 0;
    }
    return 0;
  } catch (e) {
    return 0;
  }
};

/**
 * Enhanced duration calculation with better edge case handling
 */
const calculateEnhancedDuration = (record, isWorkOutside) => {
  let duration = 0;
  let method = '';
  
  // For work_outside employees: ONLY use first-in to last-out (span) when punch records exist
  if (isWorkOutside) {
    if (record.PunchRecords && record.PunchRecords.trim() !== '') {
      duration = calculateSpanFromPunchRecords(record.PunchRecords);
      if (duration > 0) {
        method = 'first-in to last-out span';
      }
    }
  } else {
    // Regular employees: sum of in/out pairs
    if (record.PunchRecords && record.PunchRecords.trim() !== '') {
      duration = calculateDurationFromPunchRecords(record.PunchRecords);
      if (duration > 0) {
        method = 'punch records';
      }
    }
  }
  
  // Method 2: Try InTime/OutTime if no usable punches
  if (duration === 0 && record.InTime && record.OutTime) {
    duration = calculateDurationFromTimes(record.InTime, record.OutTime);
    if (duration > 0) {
      method = 'InTime/OutTime';
    }
  }
  
  // Method 3: Handle edge cases
  if (duration === 0) {
    // Check if there's only an IN punch (no OUT punch)
    if (record.PunchRecords && record.PunchRecords.includes('in(IN)') && !record.PunchRecords.includes('out(OUT)')) {
      // If there's only IN punch, assume minimal duration (1 minute)
      duration = 1;
      method = 'IN punch only (minimal)';
    }
    // Check if InTime exists but no OutTime
    else if (record.InTime && !record.OutTime) {
      duration = 1;
      method = 'InTime only (minimal)';
    }
  }
  
  return { duration, method };
};

/**
 * Main function to calculate and update durations
 */
const calculateOutDutyDurations = async () => {
  try {
    await connectToMongoDB();
    
    console.log("🔍 Finding out-duty records with empty durations...");
    
    // Build a set of employee identifiers who work outside
    const outsideEmployees = await EmployeeModel.find({ work_outside: true }).select('employeeId employeeCode').lean();
    const workOutsideSet = new Set();
    for (const emp of outsideEmployees) {
      if (emp.employeeId) workOutsideSet.add(String(emp.employeeId));
      if (emp.employeeCode) workOutsideSet.add(String(emp.employeeCode));
    }
    
    // Find records with empty durations
    const recordsToUpdate = await AttendanceLogForOutDutyModel.find({
      $or: [
        { Duration: "" },
        { Duration: null },
        { Duration: { $exists: false } }
      ]
    }).lean();
    
    console.log(`📊 Found ${recordsToUpdate.length} records to update`);
    
    if (recordsToUpdate.length === 0) {
      console.log("✅ All records already have durations calculated");
      return;
    }
    
    const bulkOps = [];
    let successCount = 0;
    let skipCount = 0;
    
    console.log("\n🔄 Calculating durations...");
    
    for (const record of recordsToUpdate) {
      const empKey = record.employeeId ? String(record.employeeId) : '';
      const isWorkOutside = empKey && workOutsideSet.has(empKey);
      const { duration, method } = calculateEnhancedDuration(record, isWorkOutside);
      
      if (duration > 0) {
        bulkOps.push({
          updateOne: {
            filter: { _id: record._id },
            update: { 
              $set: { 
                Duration: `${duration} minutes`,
                Status: duration >= 500 ? "Full Day" : duration >= 240 ? "Half Day" : "Absent"
              } 
            }
          }
        });
        
        console.log(`✅ EmployeeId ${record.employeeId}: ${duration} minutes (${method})`);
        successCount++;
      } else {
        console.log(`⚠️  EmployeeId ${record.employeeId}: Could not calculate duration`);
        skipCount++;
      }
    }
    
    // Execute bulk operations
    if (bulkOps.length > 0) {
      await AttendanceLogForOutDutyModel.bulkWrite(bulkOps);
      console.log(`\n📊 Updated ${bulkOps.length} out-duty records with calculated durations`);
    }
    
    console.log(`\n📈 Summary:`);
    console.log(`   ✅ Successfully calculated: ${successCount}`);
    console.log(`   ⚠️  Could not calculate: ${skipCount}`);
    console.log(`   📊 Total processed: ${recordsToUpdate.length}`);
    
    console.log("\n✅ Script completed successfully");
    
  } catch (error) {
    console.error("❌ Error in duration calculation:", error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log("🔌 MongoDB connection closed");
  }
};

// Run the script if called directly
if (require.main === module) {
  calculateOutDutyDurations();
}

module.exports = {
  calculateOutDutyDurations,
  calculateDurationFromPunchRecords,
  calculateDurationFromTimes,
  calculateEnhancedDuration
};

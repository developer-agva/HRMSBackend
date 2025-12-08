# Complete API Flow for Data Migration (Testing to Live Database)

## Overview
This document outlines the **sequential API calls** required to ensure accurate attendance data calculation, especially for employees with **10 AM to 6 PM shift** who need effective hours calculated based on **first IN and last OUT only**.

---

## Prerequisites
1. ✅ **Server must be restarted** to load the new code changes
2. ✅ Ensure all employee `shiftTime` data is correctly set in the database
3. ✅ Verify database connection is pointing to **LIVE database**

---

## Step-by-Step API Flow

### **STEP 1: Remove Duplicate Attendance Records**
**Purpose:** Clean up duplicate records before processing

**API:** `GET /api/remove-duplicate-attendance-logs-by-month`

**Method:** GET  
**URL:** `http://localhost:3001/api/remove-duplicate-attendance-logs-by-month`

**Description:**
- Removes duplicate attendance logs based on EmployeeCode + AttendanceDate
- Keeps the earliest record, deletes newer duplicates
- **Run this first** to ensure clean data

**Expected Response:**
```json
{
  "message": "Duplicate cleanup complete",
  "deletedCount": <number>
}
```

**Wait Time:** Usually completes in seconds to a few minutes

---

### **STEP 2: Merge Attendance from Out Duty to Main Logs**
**Purpose:** Merge out-duty attendance records into main attendance logs with **10 to 6 shift logic applied**

**API:** `POST /api/merge-attendance-from-out-duty`

**Method:** POST  
**URL:** `http://localhost:3001/api/merge-attendance-from-out-duty`  
**Headers:** `Content-Type: application/json`

**Description:**
- Merges `AttendanceLogForOutDuty` records into `AttendanceLogModel`
- **Applies 10 to 6 shift calculation logic:**
  - For employees with 10 AM to 6 PM shift: Calculates duration as **first IN to last OUT span**
  - For other employees: Sums all in/out pairs
- Updates Duration, PunchRecords, InTime, OutTime, Status, Present, Absent, StatusCode
- Processes up to 50,000 records

**Expected Response:**
```json
{
  "statusCode": 200,
  "statusValue": "SUCCESS",
  "message": "Attendance merge completed successfully. Out duty records have been merged into main attendance logs.",
  "timestamp": "2025-01-XX..."
}
```

**Wait Time:** 
- ⚠️ **Can take 5-15 minutes** depending on data volume
- The optimized version batch-fetches employee shift data (much faster than before)
- Monitor server logs for progress

**Important Notes:**
- This is the **MOST CRITICAL STEP** - it applies the 10 to 6 shift logic
- Ensure this completes successfully before proceeding

---

### **STEP 3: Recalculate Attendance Status**
**Purpose:** Recalculate status (Present/Half Day/Absent) based on updated durations and shift-specific thresholds

**API:** `POST /api/recalculate-attendance-status`

**Method:** POST  
**URL:** `http://localhost:3001/api/recalculate-attendance-status`  
**Headers:** `Content-Type: application/json`

**Description:**
- Recalculates Status, Present, Absent, StatusCode for all attendance records
- Uses shift-specific thresholds:
  - **10 to 6 shift:** Half Day = 220 mins, Full Day = 450 mins
  - **Other shifts:** Half Day = 240 mins, Full Day = 500 mins
- Only updates records where status needs to change
- Uses bulk write operations for efficiency

**Expected Response:**
```json
{
  "statusCode": 200,
  "statusValue": "SUCCESS",
  "message": "Status recalculation completed",
  "summary": {
    "updated": <number>,
    "skipped": <number>,
    "total": <number>
  }
}
```

**Wait Time:** Usually 2-5 minutes depending on data volume

---

### **STEP 4: (Optional) Recalculate Main Attendance Durations**
**Purpose:** Recalculate durations for main attendance logs if needed (for records that weren't merged)

**API:** `POST /api/recalc-main-attendance`

**Method:** POST  
**URL:** `http://localhost:3001/api/recalc-main-attendance`  
**Headers:** `Content-Type: application/json`  
**Body (Optional):**
```json
{
  "previousDate": "2025-01-01",  // Optional: Start date (IST format)
  "currentDate": "2025-01-31",   // Optional: End date (IST format)
  "employeeIds": ["123", "456"]  // Optional: Specific employee IDs
}
```

**Description:**
- Recalculates duration for main attendance logs based on PunchRecords
- Applies 10 to 6 shift logic and work_outside logic
- If no body provided, processes last 7 days
- Runs in background (returns 202 Accepted immediately)

**Expected Response:**
```json
{
  "statusCode": 202,
  "statusValue": "ACCEPTED",
  "message": "Recalculation started in background"
}
```

**Wait Time:** 
- Returns immediately (runs in background)
- Check server logs for completion

**When to Use:**
- Only if you have main attendance logs that weren't merged in Step 2
- If you need to recalculate specific date ranges or employees

---

## Verification Steps

### **1. Check Merge Results**
**API:** `GET /api/merge-results`

**Method:** GET  
**URL:** `http://localhost:3001/api/merge-results`

**Description:**
- Returns statistics about merged records
- Shows coverage percentage, date ranges, status breakdown

**Expected Response:**
```json
{
  "statusCode": 200,
  "data": {
    "summary": {
      "totalOutDutyRecords": <number>,
      "mergedRecords": <number>,
      "coveragePercentage": <number>
    },
    "dateRange": {...},
    "statusBreakdown": [...],
    "durationStats": {...}
  }
}
```

---

### **2. Verify Specific Employee Records**
**API:** `GET /api/attendance-logs/:employeeId`

**Method:** GET  
**URL:** `http://localhost:3001/api/attendance-logs/{employeeId}`

**Description:**
- Get attendance logs for a specific employee
- Verify Duration, Status, PunchRecords are correct
- Check that 10 to 6 shift employees have duration calculated as first IN to last OUT

---

## Complete Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Remove Duplicates                                   │
│ GET /api/remove-duplicate-attendance-logs-by-month          │
│ ⏱️ ~1-2 minutes                                              │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Merge Out Duty to Main (CRITICAL - Applies 10-6)   │
│ POST /api/merge-attendance-from-out-duty                    │
│ ⏱️ ~5-15 minutes (depends on data volume)                   │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Recalculate Status                                  │
│ POST /api/recalculate-attendance-status                     │
│ ⏱️ ~2-5 minutes                                              │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: (Optional) Recalculate Main Attendance              │
│ POST /api/recalc-main-attendance                            │
│ ⏱️ Background process                                        │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ VERIFICATION: Check Results                                 │
│ GET /api/merge-results                                      │
│ GET /api/attendance-logs/:employeeId                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Important Notes

### ⚠️ **Critical Points:**
1. **Always run Step 1 first** - Clean data is essential
2. **Step 2 is the most important** - This applies the 10 to 6 shift logic
3. **Wait for each step to complete** before proceeding to the next
4. **Monitor server logs** for progress and errors
5. **Verify results** after completion using verification APIs

### 🔄 **10 to 6 Shift Logic:**
- **Detection:** Checks `shiftTime.startAt` and `shiftTime.endAt` for 10 AM to 6 PM
- **Calculation:** For 10 to 6 shift employees, duration = **first IN to last OUT span**
- **Thresholds:** Half Day = 220 mins (3.67 hrs), Full Day = 450 mins (7.5 hrs)

### 📊 **Data Flow:**
```
AttendanceLogForOutDuty (Out Duty Records)
           ↓
    [Step 2: Merge]
           ↓
AttendanceLogModel (Main Attendance Logs)
    - Duration (calculated with 10-6 logic)
    - Status (Present/Half Day/Absent)
    - PunchRecords (merged)
    - InTime/OutTime (earliest/latest)
           ↓
    [Step 3: Recalculate Status]
           ↓
    Final Accurate Data
```

---

## Troubleshooting

### If Step 2 takes too long:
- Check server logs for progress
- The optimized version should be faster (batch fetches employee data)
- Consider running during off-peak hours

### If statuses are incorrect:
- Ensure Step 2 completed successfully
- Run Step 3 again to recalculate statuses
- Verify employee shift times are correctly set in database

### If durations are wrong for 10 to 6 shift employees:
- Verify employee `shiftTime.startAt` = "10:00" (or similar) and `shiftTime.endAt` = "18:00" (or "6:00 PM")
- Re-run Step 2 to re-merge with correct logic
- Check server logs for any errors during merge

---

## Example cURL Commands

```bash
# Step 1: Remove Duplicates
curl -X GET http://localhost:3001/api/remove-duplicate-attendance-logs-by-month

# Step 2: Merge Attendance (CRITICAL)
curl -X POST http://localhost:3001/api/merge-attendance-from-out-duty \
  -H "Content-Type: application/json"

# Step 3: Recalculate Status
curl -X POST http://localhost:3001/api/recalculate-attendance-status \
  -H "Content-Type: application/json"

# Step 4: (Optional) Recalculate Main Attendance
curl -X POST http://localhost:3001/api/recalc-main-attendance \
  -H "Content-Type: application/json" \
  -d '{
    "previousDate": "2025-01-01",
    "currentDate": "2025-01-31"
  }'

# Verification: Check Merge Results
curl -X GET http://localhost:3001/api/merge-results

# Verification: Check Specific Employee
curl -X GET http://localhost:3001/api/attendance-logs/12345
```

---

## Post-Migration Checklist

- [ ] Step 1 completed successfully
- [ ] Step 2 completed successfully (check logs)
- [ ] Step 3 completed successfully
- [ ] Verified merge results show expected coverage
- [ ] Spot-checked 10 to 6 shift employees - durations are first IN to last OUT
- [ ] Spot-checked other employees - durations are sum of pairs
- [ ] Statuses are correct (Present/Half Day/Absent)
- [ ] No errors in server logs

---

**Last Updated:** 2025-01-XX  
**Version:** 1.0  
**Author:** HRMS Backend Team

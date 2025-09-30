// utils/deleteUninformedLeaves.js
const trackolapAttendanceModel = require('../models/trackolapAttendanceModel');
const leaveTakenHistoryModel = require('../models/leaveTakenHistoryModel');
const employeeDocModel = require('../models/employeeDocsModel');

const generateUninformedForSales = async () => {
    try {
        // Get Absent data
        const trackolapData = await trackolapAttendanceModel.find(
            { status: 'Absent' },
            { employeeId: 1, employeeName: 1, date: 1 }
        );

        // Get existing leave records
        const existingLeaves = await leaveTakenHistoryModel.find({});
        const empDataMap = await employeeDocModel.find({}).then((res) => {
            const map = {};
            res.forEach((emp) => {
                map[String(emp.employeeId)] = emp;
            });
            return map;
        });
        
        
        // Helper to get IST datetime
        const getIndiaCurrentDateTime = () => {
            const indiaTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
            const date = new Date(indiaTime);

            const pad = (n) => (n < 10 ? `0${n}` : n);
            const year = date.getFullYear();
            const month = pad(date.getMonth() + 1);
            const day = pad(date.getDate());
            const hours = pad(date.getHours());
            const minutes = pad(date.getMinutes());
            const seconds = pad(date.getSeconds());

            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        };

        const dateTime = getIndiaCurrentDateTime();
        
        const uninformedLeavesToInsert = [];

        for (const attendance of trackolapData) {
            const { employeeId, date } = attendance;

            // Check if leave already exists for this employee on this date
            const alreadyExists = existingLeaves.some(
                (leave) => leave.employeeId === employeeId && leave.leaveStartDate === date
            );

            if (alreadyExists) continue;

            // Prepare uninformed leave data
            uninformedLeavesToInsert.push({
                employeeId,
                leaveType: 'uninformedLeave',
                leaveStartDate: date,
                leaveEndDate: date,
                totalDays: '1',
                reason: 'This is system-generated leave',
                approvedBy: empDataMap[String(employeeId)]?.managerId || 'System',
                status: 'Approved',
                dateTime,
                approvedDateTime: dateTime,
            });
        }

        // Insert all uninformed leaves
        if (uninformedLeavesToInsert.length > 0) {
            await leaveTakenHistoryModel.insertMany(uninformedLeavesToInsert);
            console.log(`${uninformedLeavesToInsert.length} uninformed leaves inserted.`);
        } else {
            console.log('No uninformed leaves to insert.');
        }
    } catch (error) {
        console.error('Error in generating uninformed leaves:', error);
    }
};

module.exports = generateUninformedForSales;

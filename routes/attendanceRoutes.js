const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

router.post('/clock-in', attendanceController.clockIn);
router.post('/clock-out', attendanceController.clockOut);
router.get('/status', attendanceController.getStatus);
router.get('/records', attendanceController.getAttendanceByDate); // Add to fetch attendance records

module.exports = router;

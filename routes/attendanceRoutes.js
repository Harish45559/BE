// routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

router.post('/clock-in', attendanceController.clockIn);
router.post('/clock-out', attendanceController.clockOut);
router.get('/status', attendanceController.getStatus);
router.get('/records', attendanceController.getAttendanceByDate);

// NEW: minutes per employee for a given date (split at midnight)
router.get('/daily-summary', attendanceController.getDailySummary);

module.exports = router;

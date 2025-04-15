// server/routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

// Routes
router.post('/clock-in', attendanceController.clockIn);
router.post('/clock-out', attendanceController.clockOut);
router.get('/status', attendanceController.getStatus);
router.get('/by-date', attendanceController.getAttendanceByDate);

module.exports = router;

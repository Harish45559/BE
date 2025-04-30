const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

router.post('/clock-in', attendanceController.clockIn);
router.post('/clock-out', attendanceController.clockOut); // ✅ This line must be present
module.exports = router;

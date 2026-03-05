const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const { UPDATE } = require("sequelize/lib/query-types");

router.post("/clock-in", attendanceController.clockIn);
router.post("/clock-out", attendanceController.clockOut);
router.get("/status", attendanceController.getStatus);
router.get("/records", attendanceController.getAttendanceByDate); // Add to fetch attendance records
router.post("/manual-entry", attendanceController.manualEntry);
router.put("/update", attendanceController.updateAttendance);
module.exports = router;

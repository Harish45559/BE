const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const authMiddleware = require("../middleware/auth");

// 🔐 Protected routes
router.post("/clock-in", authMiddleware, attendanceController.clockIn);
router.post("/clock-out", authMiddleware, attendanceController.clockOut);
router.get("/status", authMiddleware, attendanceController.getStatus);
router.get(
  "/records",
  authMiddleware,
  attendanceController.getAttendanceByDate,
);
router.post("/manual-entry", authMiddleware, attendanceController.manualEntry);
router.put("/update", authMiddleware, attendanceController.updateAttendance);
router.get(
  "/dashboard",
  authMiddleware,
  attendanceController.getEmployeesWithStatus,
);

module.exports = router;

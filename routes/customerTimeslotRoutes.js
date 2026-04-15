const express = require("express");
const router = express.Router();
const timeSlotController = require("../controllers/timeSlotController");

// GET /api/customer/timeslots?date=YYYY-MM-DD
// Public — no auth needed, customers browse available pickup slots
router.get("/", timeSlotController.getSlots);

module.exports = router;

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const timeSlotController = require("../controllers/timeSlotController");

// Staff-only routes — manage slot settings
router.get("/settings", authMiddleware, timeSlotController.getSettings);
router.put("/settings", authMiddleware, timeSlotController.updateSettings);
router.patch("/settings/interval", authMiddleware, timeSlotController.adjustInterval);

module.exports = router;

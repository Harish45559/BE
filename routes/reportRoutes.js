// routes/reportRoutes.js
const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const authMiddleware = require("../middleware/auth");

router.use(authMiddleware);
router.get("/", reportController.getReports);
router.get("/summary", reportController.getDailySummary);
router.get("/detailed-sessions", reportController.getDetailedSessions);
router.get("/export/csv", reportController.exportCSV);
router.get("/export/pdf", reportController.exportPDF);

module.exports = router;

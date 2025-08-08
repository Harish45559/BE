// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// LIST (the table in Reports.jsx uses this)
router.get('/reports', reportController.getReports);

// DAILY TOTALS + BREAK (optional summary view)
router.get('/reports/summary', reportController.getDailySummary);

// PER-DAY DETAILED SESSIONS + BREAK ROWS (used by hover card)
router.get('/reports/detailed-sessions', reportController.getDetailedSessions);

// EXPORTS
router.get('/reports/export/csv', reportController.exportCSV);
router.get('/reports/export/pdf', reportController.exportPDF);

// DELETE a single attendance entry
router.delete('/reports/:id', reportController.deleteAttendance);

module.exports = router;

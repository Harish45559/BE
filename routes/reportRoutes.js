// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// LIST (the table in Reports.jsx uses this)
// final URL: GET /api/reports
router.get('/', reportController.getReports);

// DAILY TOTALS + BREAK (optional summary view)
// final URL: GET /api/reports/summary
router.get('/summary', reportController.getDailySummary);

// PER-DAY DETAILED SESSIONS + BREAK ROWS (used by hover card)
// final URL: GET /api/reports/detailed-sessions
router.get('/detailed-sessions', reportController.getDetailedSessions);

// EXPORTS
// final URLs: /api/reports/export/csv and /api/reports/export/pdf
router.get('/export/csv', reportController.exportCSV);
router.get('/export/pdf', reportController.exportPDF);

// DELETE a single attendance entry
// final URL: DELETE /api/reports/:id
router.delete('/:id', reportController.deleteAttendance);

module.exports = router;

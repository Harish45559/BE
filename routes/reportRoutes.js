const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// All routes - make sure all use router, not app
router.get('/reports', reportController.getReports);
router.get('/summary', reportController.getDailySummary);
router.get('/sessions', reportController.getDetailedSessions);
router.delete('/:id', reportController.deleteAttendance);
router.get('/export/csv', reportController.exportCSV);
router.get('/export/pdf', reportController.exportPDF);

module.exports = router;
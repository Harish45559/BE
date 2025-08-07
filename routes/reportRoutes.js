const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

router.get('/reports', reportController.getReports);
router.get('/summary', reportController.getDailySummary);
router.get('/sessions', reportController.getDetailedSessions); // ✅ Present only in main
router.delete('/:id', reportController.deleteAttendance);
router.get('/export/csv', reportController.exportCSV);
router.get('/export/pdf', reportController.exportPDF);

// Optional test route (only if you want to keep it)
router.get('/test', (req, res) => {
  res.send('✅ Report route works!');
});


module.exports = router;

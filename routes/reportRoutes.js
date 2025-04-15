const express = require('express');
const router = express.Router();
const {
  getReports,
  deleteAttendance,
  exportCSV,
  exportPDF
} = require('../controllers/reportController');

router.get('/reports', getReports);
router.delete('/:id', deleteAttendance);
router.get('/export/csv', exportCSV);
router.get('/export/pdf', exportPDF);

module.exports = router;

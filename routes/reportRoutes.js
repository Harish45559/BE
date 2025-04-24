const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

router.get('/reports', reportController.getReports);
router.get('/export/csv', reportController.exportCSV);
router.get('/export/pdf', reportController.exportPDF);
router.delete('/:id', reportController.deleteAttendance);

module.exports = router;

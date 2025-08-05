const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

router.get('/', reportController.getReports);

router.get('/export/csv', reportController.exportCSV);
router.get('/export/pdf', reportController.exportPDF);
router.delete('/:id', reportController.deleteAttendance);
router.get('/summary', reportController.getDailySummary);
router.get('/test', (req, res) => {
  res.send('✅ Report route works!');
});


module.exports = router;

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

<<<<<<< HEAD
// All routes - make sure all use router, not app
router.get('/reports', reportController.getReports);
router.get('/summary', reportController.getDailySummary);
router.get('/sessions', reportController.getDetailedSessions);
router.delete('/:id', reportController.deleteAttendance);
router.get('/export/csv', reportController.exportCSV);
router.get('/export/pdf', reportController.exportPDF);
=======
router.get('/', reportController.getReports);

router.get('/export/csv', reportController.exportCSV);
router.get('/export/pdf', reportController.exportPDF);
router.delete('/:id', reportController.deleteAttendance);
router.get('/summary', reportController.getDailySummary);
router.get('/test', (req, res) => {
  res.send('✅ Report route works!');
});
>>>>>>> be-deploy-june13

module.exports = router;
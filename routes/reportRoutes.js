const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

<<<<<<< HEAD
<<<<<<< HEAD
// All routes - make sure all use router, not app
=======
// ✅ All valid routes combined
>>>>>>> f4046248370844cab51e737fdaa6cfe9c56efd87
router.get('/reports', reportController.getReports);
router.get('/summary', reportController.getDailySummary);
router.get('/sessions', reportController.getDetailedSessions); // ✅ Present only in main
router.delete('/:id', reportController.deleteAttendance);
router.get('/export/csv', reportController.exportCSV);
router.get('/export/pdf', reportController.exportPDF);
<<<<<<< HEAD
=======
router.get('/', reportController.getReports);
=======
>>>>>>> f4046248370844cab51e737fdaa6cfe9c56efd87

// Optional test route (only if you want to keep it)
router.get('/test', (req, res) => {
  res.send('✅ Report route works!');
});
<<<<<<< HEAD
>>>>>>> be-deploy-june13
=======
>>>>>>> f4046248370844cab51e737fdaa6cfe9c56efd87

module.exports = router;

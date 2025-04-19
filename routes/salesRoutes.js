const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

// Main sales endpoints
router.get('/report', salesController.getSalesReport);
router.get('/top-items', salesController.getTopSellingItems);

// Till cash related
router.get('/till-cash', salesController.getTillCash);
router.get('/till-cash/export/csv', salesController.exportTillCSV);
router.get('/till-cash/export/pdf', salesController.exportTillPDF);

// Till status (open/close logs)
router.get('/till-status/:date', salesController.getTillStatusByDate);
router.post('/till/open', salesController.openTill);
router.post('/till/close', salesController.closeTill);

module.exports = router;

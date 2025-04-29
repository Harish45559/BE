const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

router.get('/summary', salesController.getSalesSummary);
router.get('/topselling', salesController.getTopSellingItems);
router.get('/totalsales', salesController.getTotalSales);

module.exports = router;

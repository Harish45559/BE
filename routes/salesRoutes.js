const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

// Totals by date range (total/cash/card)
router.get('/summary', salesController.getSalesSummary);

// Top selling items by qty from orders.items
router.get('/topselling', salesController.getTopSellingItems);

// Raw orders list (for Orders tab)
router.get('/totalsales', salesController.getTotalSales);

module.exports = router;

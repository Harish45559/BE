// ✅ Final: server/routes/orderRoutes.js

const express = require('express');
const router = express.Router();
const {
  placeOrder,
  getOrdersByDate,
  getSalesSummary,
  getAllOrders
} = require('../controllers/orderController');

// ✅ Place a new order
router.post('/', placeOrder);

// ✅ Get all orders (used in PreviousOrders.jsx)
router.get('/all', getAllOrders);

// ✅ Get orders by a specific date (used in daily reports)
router.get('/by-date', getOrdersByDate);

// ✅ Get sales summary (daily/weekly/monthly breakdown)
router.get('/summary', getSalesSummary);

module.exports = router;

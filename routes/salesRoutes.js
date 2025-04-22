const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

// 🔓 Open / Close Till (with employee info)
router.post('/till/open', salesController.openTill);
router.post('/till/close', salesController.closeTill);

// 📅 Till status by date
router.get('/till-status/:date', salesController.gettillstatus);

// 💰 Till Cash Summary (cash sales total)
router.get('/till-cash', salesController.getTillCashByDate);

// 📊 Top Selling Items (for Top Items tab)
router.get('/top-items', salesController.getTopSellingItems);

// 📑 Full Sales Report (for Summary / Table tab)
router.get('/report', salesController.getSalesReport);

module.exports = router;

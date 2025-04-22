const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

router.post('/till/open', salesController.openTill);
router.post('/till/close', salesController.closeTill);
router.get('/till-status/:date', salesController.getTillStatus);
router.get('/till-cash', salesController.getTillCashByDate);
router.get('/top-items', salesController.getTopSellingItems);
router.get('/report', salesController.getSalesReport);

module.exports = router;

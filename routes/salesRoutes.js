const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

router.get('/report', salesController.getSalesReport);
router.get('/top-items', salesController.getTopSellingItems);

module.exports = router;

const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

router.post('/till/open', salesController.openTill);
router.post('/till/close', salesController.closeTill);


module.exports = router;

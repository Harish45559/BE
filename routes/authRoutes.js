const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Route definitions
router.post('/login', authController.login);
router.post('/verify-pin', authController.verifyPin);
router.post('/forgot-password', authController.forgotPassword); // ✅ fix

module.exports = router;

const express = require('express');
const router = express.Router();
const { login } = require('../controllers/authController');
const authController = require('../controllers/authController'); // ✅ Add this line

router.post('/login', login);
router.post('/forgot-password', authController.forgotPassword); // <- ADD THIS


module.exports = router;

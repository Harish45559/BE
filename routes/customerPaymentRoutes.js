const express = require("express");
const router = express.Router();
const customerPaymentController = require("../controllers/customerPaymentController");

// POST /api/customer/payments/webhook
// Stripe requires raw body — this route is registered with express.raw() in app.js
router.post("/webhook", customerPaymentController.stripeWebhook);

module.exports = router;

const express = require("express");
const router = express.Router();
const customerPaymentController = require("../controllers/customerPaymentController");

// POST /api/customer/payments/webhook
// SumUp calls this when a checkout status changes
router.post("/webhook", customerPaymentController.sumupWebhook);

module.exports = router;

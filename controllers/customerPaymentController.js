const { Order } = require("../models");

// ─── STRIPE (commented out — replaced by SumUp) ──────────────────────────────
// const Stripe = require("stripe");
// let _stripe = null;
// function getStripe() {
//   if (!_stripe) {
//     if (!process.env.STRIPE_SECRET_KEY) {
//       throw new Error("STRIPE_SECRET_KEY environment variable is not set");
//     }
//     _stripe = Stripe(process.env.STRIPE_SECRET_KEY);
//   }
//   return _stripe;
// }

// exports.createPaymentIntent = async (req, res) => { ... }   // Stripe
// exports.confirmPayment      = async (req, res) => { ... }   // Stripe
// exports.stripeWebhook       = async (req, res) => { ... }   // Stripe

// ─── SUMUP ────────────────────────────────────────────────────────────────────

function getSumUpHeaders() {
  if (!process.env.SUMUP_API_KEY) {
    throw new Error("SUMUP_API_KEY environment variable is not set");
  }
  return {
    Authorization: `Bearer ${process.env.SUMUP_API_KEY}`,
    "Content-Type": "application/json",
  };
}

// POST /api/customer/orders/:id/pay
// Creates a SumUp checkout for an existing pending order.
// Returns { checkoutId } — frontend uses this with SumUp JS SDK to render card form.
exports.createCheckout = async (req, res) => {
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, customer_id: req.customer.id },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.payment_status === "paid") {
      return res.status(400).json({ success: false, message: "Order is already paid" });
    }

    const baseUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;

    const response = await fetch("https://api.sumup.com/v0.1/checkouts", {
      method: "POST",
      headers: getSumUpHeaders(),
      body: JSON.stringify({
        checkout_reference: `ORDER-${order.id}`,
        amount: order.final_amount,
        currency: "GBP",
        merchant_code: process.env.SUMUP_MERCHANT_CODE,
        description: `Mirchi Mafia — Order ${order.order_number}`,
        return_url: `${baseUrl}/api/customer/payments/webhook`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("SumUp createCheckout error:", data);
      return res.status(500).json({ success: false, message: "Failed to create payment" });
    }

    return res.status(200).json({
      success: true,
      checkoutId: data.id,
      amount: order.final_amount,
    });
  } catch (err) {
    console.error("createCheckout error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to create payment" });
  }
};

// POST /api/customer/orders/:id/verify-payment
// Called by frontend after SumUp onResponse("success") fires.
// Verifies the checkout status directly with SumUp API and marks order as paid.
exports.verifyPayment = async (req, res) => {
  try {
    const { checkoutId } = req.body || {};
    if (!checkoutId) {
      return res.status(400).json({ success: false, message: "checkoutId is required" });
    }

    const order = await Order.findOne({
      where: { id: req.params.id, customer_id: req.customer.id },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.payment_status === "paid") {
      return res.status(200).json({ success: true, message: "Already paid" });
    }

    const verifyRes = await fetch(`https://api.sumup.com/v0.1/checkouts/${checkoutId}`, {
      headers: getSumUpHeaders(),
    });

    if (!verifyRes.ok) {
      return res.status(500).json({ success: false, message: "Could not verify payment" });
    }

    const checkout = await verifyRes.json();

    if (checkout.status === "PAID") {
      await order.update({ payment_status: "paid", payment_method: "Card" });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ success: false, message: "Payment not confirmed by SumUp" });
  } catch (err) {
    console.error("verifyPayment error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to verify payment" });
  }
};

// POST /api/customer/payments/webhook
// SumUp calls this when a payment status changes.
// We verify the checkout with SumUp's API before trusting it.
exports.sumupWebhook = async (req, res) => {
  try {
    const { event_type, id } = req.body || {};

    if (event_type !== "CHECKOUT_STATUS_CHANGED" || !id) {
      return res.status(200).json({ received: true });
    }

    // Verify with SumUp API directly — don't trust webhook body alone
    const verifyRes = await fetch(`https://api.sumup.com/v0.1/checkouts/${id}`, {
      headers: getSumUpHeaders(),
    });

    if (!verifyRes.ok) {
      console.error("SumUp webhook: failed to verify checkout", payload.id);
      return res.status(200).json({ received: true });
    }

    const checkout = await verifyRes.json();

    // checkout_reference is "ORDER-{id}" — extract the id
    const orderId = checkout.checkout_reference?.replace("ORDER-", "");
    if (!orderId) return res.status(200).json({ received: true });

    if (checkout.status === "PAID") {
      await Order.update(
        { payment_status: "paid", payment_method: "Card" },
        { where: { id: orderId } }
      );
    }

    if (checkout.status === "FAILED") {
      await Order.update(
        { payment_status: "failed" },
        { where: { id: orderId } }
      );
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("sumupWebhook error:", err.message);
    return res.status(200).json({ received: true }); // always 200 to SumUp
  }
};

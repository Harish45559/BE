const { Order } = require("../models");
const Stripe = require("stripe");

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is not set");
}

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ─── POST /api/customer/orders/:id/pay ───────────────────────────────────────
// Creates a Stripe PaymentIntent for an existing pending order.
// Returns { clientSecret } — frontend uses this with Stripe.js to complete payment.
exports.createPaymentIntent = async (req, res) => {
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

    // Amount in pence (Stripe requires integer, smallest currency unit)
    const amount = Math.round(order.final_amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "gbp",
      metadata: {
        order_id: String(order.id),
        order_number: order.order_number,
        customer_id: String(order.customer_id),
      },
      description: `Cozy Cup — Order ${order.order_number}`,
    });

    return res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: order.final_amount,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("PaymentIntent error:", err.message);
    }
    return res.status(500).json({ success: false, message: "Failed to create payment" });
  }
};

// ─── POST /api/customer/payments/webhook ─────────────────────────────────────
// Stripe calls this when a payment succeeds or fails.
// IMPORTANT: This route must use express.raw() body parser — NOT express.json().
exports.stripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object;
    const orderId = intent.metadata?.order_id;

    if (orderId) {
      await Order.update(
        { payment_status: "paid", payment_method: "Card" },
        { where: { id: orderId } }
      );
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object;
    const orderId = intent.metadata?.order_id;
    if (orderId) {
      await Order.update(
        { payment_status: "failed" },
        { where: { id: orderId } }
      );
    }
  }

  return res.status(200).json({ received: true });
};

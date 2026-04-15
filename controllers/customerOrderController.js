const { Order, Customer, MenuItem, TimeSlotSettings } = require("../models");
const { DateTime } = require("luxon");

// ─── Helpers ────────────────────────────────────────────────────────────────

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const randomSuffix = () =>
  Array.from({ length: 4 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join("");

async function generateOrderNumber() {
  const prefix = "OL" + DateTime.now().setZone("Europe/London").toFormat("ddMM");
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `${prefix}-${randomSuffix()}`;
    const existing = await Order.findOne({ where: { order_number: candidate } });
    if (!existing) return candidate;
  }
  throw new Error("Could not generate unique order number");
}

// ─── POST /api/customer/orders ───────────────────────────────────────────────
// Place an online order (eat_in or takeaway)
// Requires customer to be logged in (customerAuthMiddleware sets req.customer)
exports.placeOrder = async (req, res) => {
  try {
    const {
      order_type,        // 'Eat In' | 'Takeaway'
      items,             // [{ id, name, price, qty }]
      payment_method,    // 'Cash' | 'Pay at Collection'
      pickup_time,       // optional — for takeaway: "HH:mm dd/MM/yyyy"
      table_number,      // optional — for eat_in
      covers,            // optional — for eat_in
    } = req.body;

    // ── Check online orders enabled ───────────────────────────────────────────
    let settings = await TimeSlotSettings.findByPk(1);
    if (settings && settings.online_orders_enabled === false) {
      return res.status(503).json({ success: false, message: "Online ordering is currently unavailable. Please try again later." });
    }

    // ── Validation ────────────────────────────────────────────────────────────
    if (!order_type || !["Eat In", "Takeaway"].includes(order_type)) {
      return res.status(400).json({
        success: false,
        message: "order_type must be 'Eat In' or 'Takeaway'",
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order must have at least one item",
      });
    }

    const allowedPayments = ["Cash", "Pay at Collection"];
    const normalisedPayment =
      (payment_method || "").trim().charAt(0).toUpperCase() +
      (payment_method || "").trim().slice(1).toLowerCase();

    if (!allowedPayments.includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: "payment_method must be 'Cash' or 'Pay at Collection'",
      });
    }

    if (order_type === "Takeaway" && !pickup_time) {
      return res.status(400).json({
        success: false,
        message: "pickup_time is required for Takeaway orders",
      });
    }

    // ── Normalise items ───────────────────────────────────────────────────────
    const normalisedItems = items.map((it) => ({
      id: it.id,
      name: it.name,
      price: it.price,
      qty: it.qty ?? it.quantity ?? 1,
    }));

    // ── Compute totals ────────────────────────────────────────────────────────
    const total_amount = normalisedItems.reduce(
      (sum, it) => sum + it.price * it.qty,
      0
    );
    const final_amount = total_amount; // no discount on online orders for now

    // ── Fetch customer details ────────────────────────────────────────────────
    const customer = await Customer.findByPk(req.customer.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // ── Timestamps ────────────────────────────────────────────────────────────
    const now = DateTime.now().setZone("Europe/London");
    const order_number = await generateOrderNumber();

    const order = await Order.create({
      customer_name: customer.name,
      server_name: "Online",
      order_type,
      table_number: table_number || null,
      covers: covers || null,
      order_number,
      items: normalisedItems,
      total_amount: parseFloat(total_amount.toFixed(2)),
      discount_percent: 0,
      discount_amount: 0,
      final_amount: parseFloat(final_amount.toFixed(2)),
      payment_method,
      created_at: now.toUTC().toJSDate(),
      date: now.toFormat("dd/MM/yyyy HH:mm:ss"),
      source: "online",
      customer_id: customer.id,
      pickup_time: pickup_time || null,
      payment_status: "pending",  // customer pays on collection / at truck
    });

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order: {
        id: order.id,
        order_number: order.order_number,
        order_type: order.order_type,
        items: order.items,
        total_amount: order.total_amount,
        final_amount: order.final_amount,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        pickup_time: order.pickup_time,
        date: order.date,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Customer placeOrder error:", err.message);
    }
    return res.status(500).json({ success: false, message: "Failed to place order" });
  }
};

// ─── GET /api/customer/orders ────────────────────────────────────────────────
// Get all orders for the logged-in customer
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { customer_id: req.customer.id, source: "online" },
      order: [["created_at", "DESC"]],
      attributes: [
        "id", "order_number", "order_type", "items",
        "total_amount", "final_amount", "payment_method",
        "payment_status", "order_status", "estimated_ready",
        "pickup_time", "date", "pager_status",
      ],
    });

    return res.status(200).json({ success: true, orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
};

// ─── GET /api/customer/orders/:id ────────────────────────────────────────────
// Get a single order — customer can only see their own
exports.getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({
      where: { id: req.params.id, customer_id: req.customer.id },
      attributes: [
        "id", "order_number", "order_type", "items",
        "total_amount", "final_amount", "payment_method",
        "payment_status", "order_status", "estimated_ready",
        "pickup_time", "date", "pager_status",
      ],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    return res.status(200).json({ success: true, order });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch order" });
  }
};

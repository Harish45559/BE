const { Order, Customer, TimeSlotSettings } = require("../models");
const { Op } = require("sequelize");
const { DateTime } = require("luxon");
const { getIo } = require("../socket");

async function getOrCreateSettings() {
  let s = await TimeSlotSettings.findByPk(1);
  if (!s) s = await TimeSlotSettings.create({ id: 1 });
  return s;
}

// ─── GET /api/orders/online ───────────────────────────────────────────────────
// Staff — all online orders, optionally filtered by date and/or payment_status
// Query params:
//   date=YYYY-MM-DD  (defaults to today)
//   status=pending|paid|failed|all  (defaults to all)
exports.getOnlineOrders = async (req, res) => {
  try {
    const date =
      req.query.date || DateTime.now().setZone("Europe/London").toISODate();
    const status = req.query.status || "all";

    const dayStart = DateTime.fromISO(date)
      .setZone("Europe/London")
      .startOf("day")
      .toJSDate();
    const dayEnd = DateTime.fromISO(date)
      .setZone("Europe/London")
      .endOf("day")
      .toJSDate();

    const where = {
      source: "online",
      created_at: { [Op.between]: [dayStart, dayEnd] },
      // Never show Card orders that haven't been paid — they're awaiting payment
      [Op.not]: [{ payment_method: "Card", payment_status: "pending" }],
    };

    if (status !== "all") {
      where.payment_status = status;
    }

    const orders = await Order.findAll({
      where,
      order: [["created_at", "DESC"]],
      attributes: [
        "id",
        "order_number",
        "order_type",
        "customer_name",
        "items",
        "total_amount",
        "final_amount",
        "payment_method",
        "payment_status",
        "order_status",
        "estimated_ready",
        "pickup_time",
        "date",
        "pager_status",
        "customer_id",
        "customer_notes",
      ],
    });

    // Attach customer contact details so staff can call if needed
    const customerIds = [
      ...new Set(orders.map((o) => o.customer_id).filter(Boolean)),
    ];
    let customerMap = {};

    if (customerIds.length > 0) {
      const customers = await Customer.findAll({
        where: { id: { [Op.in]: customerIds } },
        attributes: ["id", "phone", "email"],
      });
      customers.forEach((c) => {
        customerMap[c.id] = c;
      });
    }

    const enriched = orders.map((o) => ({
      ...o.toJSON(),
      customer_contact: customerMap[o.customer_id]
        ? {
            phone: customerMap[o.customer_id].phone,
            email: customerMap[o.customer_id].email,
          }
        : null,
    }));

    return res.status(200).json({
      success: true,
      date,
      total: enriched.length,
      orders: enriched,
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Online orders error:", err.message);
    }
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch online orders" });
  }
};

// ─── GET /api/orders/online/pending ──────────────────────────────────────────
// Staff — only unpaid / uncollected orders (dashboard alert view)
exports.getPendingOnlineOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: {
        source: "online",
        order_status: "pending",
        // Exclude Card orders that haven't been paid or failed — only paid Card orders need admin action
        [Op.not]: { payment_method: "Card", payment_status: { [Op.in]: ["pending", "failed"] } },
      },
      order: [["created_at", "ASC"]], // oldest first — needs attention soonest
      attributes: [
        "id",
        "order_number",
        "order_type",
        "customer_name",
        "items",
        "total_amount",
        "final_amount",
        "payment_method",
        "payment_status",
        "order_status",
        "estimated_ready",
        "pickup_time",
        "date",
        "pager_status",
        "customer_id",
        "customer_notes",
      ],
    });

    const customerIds = [
      ...new Set(orders.map((o) => o.customer_id).filter(Boolean)),
    ];
    let customerMap = {};

    if (customerIds.length > 0) {
      const customers = await Customer.findAll({
        where: { id: { [Op.in]: customerIds } },
        attributes: ["id", "phone", "email"],
      });
      customers.forEach((c) => {
        customerMap[c.id] = c;
      });
    }

    const enriched = orders.map((o) => ({
      ...o.toJSON(),
      customer_contact: customerMap[o.customer_id]
        ? {
            phone: customerMap[o.customer_id].phone,
            email: customerMap[o.customer_id].email,
          }
        : null,
    }));

    return res.status(200).json({
      success: true,
      total: enriched.length,
      orders: enriched,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending online orders",
    });
  }
};

// ─── PATCH /api/orders/online/:id/accept ─────────────────────────────────────
// Staff accepts an online order and sets estimated ready time.
// If the order has a pickup_time (e.g. "17:00 14/04/2026"), estimated_ready is
// pickup_time + minutes so customers see their slot adjusted by the cooking offset.
// Falls back to now + minutes when no pickup_time is set.
exports.acceptOrder = async (req, res) => {
  try {
    const { minutes } = req.body; // e.g. 20 (or 0 = ready immediately at pickup time)
    // NOTE: can't use `|| 20` because 0 is falsy — use nullish coalescing
    const mins = Number.isFinite(parseInt(minutes)) ? parseInt(minutes) : 20;
    const order = await Order.findByPk(req.params.id);
    if (!order || order.source !== "online") {
      return res
        .status(404)
        .json({ success: false, message: "Online order not found" });
    }

    let readyAt;
    const pickupRaw = order.pickup_time; // e.g. "17:00 14/04/2026" or null

    if (pickupRaw) {
      // Extract HH:mm from the stored pickup_time string
      const timePart = pickupRaw.split(" ")[0]; // "17:00"
      const [hh, mm] = timePart.split(":").map(Number);
      if (!isNaN(hh) && !isNaN(mm)) {
        if (mins === 0) {
          // "00" selected — ready at the exact pickup time, no offset
          readyAt = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
        } else {
          const pickupDt = DateTime.now()
            .setZone("Europe/London")
            .set({ hour: hh, minute: mm, second: 0, millisecond: 0 })
            .plus({ minutes: mins });
          readyAt = pickupDt.toFormat("HH:mm");
        }
      }
    }

    // Fallback: now + minutes (or just now if 0)
    if (!readyAt) {
      readyAt = DateTime.now()
        .setZone("Europe/London")
        .plus({ minutes: mins })
        .toFormat("HH:mm");
    }

    order.order_status = "accepted";
    order.estimated_ready = readyAt;
    await order.save();

    try { getIo().emit("order:status-changed", { id: order.id, order_number: order.order_number, order_status: "accepted", customer_id: order.customer_id }); } catch (_) {}

    return res.status(200).json({
      success: true,
      message: "Order accepted",
      order_status: "accepted",
      estimated_ready: readyAt,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to accept order" });
  }
};

// ─── PATCH /api/orders/online/:id/reject ─────────────────────────────────────
exports.rejectOrder = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order || order.source !== "online") {
      return res
        .status(404)
        .json({ success: false, message: "Online order not found" });
    }
    order.order_status = "rejected";
    await order.save();
    try { getIo().emit("order:status-changed", { id: order.id, order_number: order.order_number, order_status: "rejected", customer_id: order.customer_id }); } catch (_) {}
    return res.status(200).json({
      success: true,
      message: "Order rejected",
      order_status: "rejected",
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to reject order" });
  }
};

// ─── PATCH /api/orders/timeslots/settings/toggle-online ──────────────────────
// Staff toggles online ordering on/off
exports.toggleOnlineOrders = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    settings.online_orders_enabled = !settings.online_orders_enabled;
    await settings.save();
    return res.status(200).json({
      success: true,
      online_orders_enabled: settings.online_orders_enabled,
      message: `Online orders ${settings.online_orders_enabled ? "enabled" : "disabled"}`,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to toggle online orders" });
  }
};

// ─── GET /api/orders/online/status ───────────────────────────────────────────
// Returns current online orders enabled status
exports.getOnlineStatus = async (req, res) => {
  try {
    const settings = await getOrCreateSettings();
    return res.status(200).json({
      success: true,
      online_orders_enabled: settings.online_orders_enabled,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to get status" });
  }
};

// ─── PATCH /api/orders/online/:id/ready ──────────────────────────────────────
// Staff marks order as ready for collection (triggers customer notification)
exports.readyOrder = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order || order.source !== "online") {
      return res.status(404).json({ success: false, message: "Online order not found" });
    }
    order.order_status = "ready";
    await order.save();
    try { getIo().emit("order:status-changed", { id: order.id, order_number: order.order_number, order_status: "ready", customer_id: order.customer_id }); } catch (_) {}
    return res.status(200).json({
      success: true,
      message: "Order marked as ready",
      order_status: "ready",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to mark order as ready" });
  }
};

// ─── PATCH /api/orders/online/:id/complete ───────────────────────────────────
// Staff marks an accepted order as delivered/completed
exports.completeOrder = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order || order.source !== "online") {
      return res
        .status(404)
        .json({ success: false, message: "Online order not found" });
    }
    order.order_status = "completed";
    await order.save();
    try { getIo().emit("order:status-changed", { id: order.id, order_number: order.order_number, order_status: "completed", customer_id: order.customer_id }); } catch (_) {}
    return res.status(200).json({
      success: true,
      message: "Order marked as delivered",
      order_status: "completed",
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: "Failed to complete order" });
  }
};

// ─── PATCH /api/orders/online/:id/mark-paid ──────────────────────────────────
// Staff — mark a "Pay on Collection" order as paid, recording how customer paid
exports.markAsPaid = async (req, res) => {
  try {
    const { payment_method } = req.body || {};
    if (!["Cash", "Card on Collection"].includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: "payment_method must be 'Cash' or 'Card on Collection'",
      });
    }

    const order = await Order.findByPk(req.params.id);
    if (!order || order.source !== "online") {
      return res.status(404).json({ success: false, message: "Online order not found" });
    }

    await order.update({ payment_status: "paid", payment_method });

    return res.status(200).json({
      success: true,
      message: "Payment recorded",
      payment_status: "paid",
      payment_method,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to record payment" });
  }
};

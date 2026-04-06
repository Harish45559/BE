const { Order, HeldOrder } = require("../models");
const { Op } = require("sequelize");
const { DateTime } = require("luxon");

// ✅ ISO UTC string for consistent frontend usage

// ✅ ISO UTC string for consistent frontend usage
const formatToISO = (date) => {
  return DateTime.fromJSDate(date).toISO(); // No zone shift
};

exports.placeOrder = async (req, res) => {
  try {
    const {
      customer_name,
      server_name,
      order_type,
      items,
      total_amount,
      final_amount,
      payment_method,
    } = req.body;

    // 🔒 Validate required fields
    if (
      !customer_name ||
      !server_name ||
      !order_type ||
      !items ||
      !total_amount ||
      !final_amount ||
      !payment_method
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Order must have at least one item" });
    }

    const orderData = { ...req.body };

    // ✅ Ensure created_at is UTC
    orderData.created_at = orderData.created_at
      ? DateTime.fromISO(orderData.created_at).toUTC().toJSDate()
      : DateTime.now().toUTC().toJSDate();

    // ✅ Add UK-local date field (e.g. "10/04/2025 14:35:00")
    orderData.date = DateTime.now()
      .setZone("Europe/London")
      .toFormat("dd/MM/yyyy HH:mm:ss");

    // Get next order number
    const orders = await Order.findAll({
      attributes: ["order_number"],
      order: [["order_number", "DESC"]],
      limit: 1,
    });

    let nextOrderNumber = 1001;
    if (orders.length && orders[0].order_number) {
      nextOrderNumber = parseInt(orders[0].order_number, 10) + 1;
    }

    orderData.order_number = nextOrderNumber;

    const order = await Order.create(orderData);

    res.status(201).json({
      message: "Order placed successfully",
      order: {
        ...order.toJSON(),
        created_at: order.created_at.toISOString(),
        date: order.date,
      },
    });
  } catch (error) {
    console.error("❌ Error placing order:", error);
    res
      .status(500)
      .json({ error: "Failed to place order", details: error.message });
  }
};

// ✅ GET /orders/all
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      order: [["created_at", "DESC"]],
    });

    const formatted = orders.map((o) => ({
      ...o.toJSON(),
      created_at: formatToISO(o.created_at),
      date: o.date,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("❌ Error fetching all orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

// ✅ GET /orders/by-date?date=YYYY-MM-DD
exports.getOrdersByDate = async (req, res) => {
  try {
    const date = req.query.date || DateTime.now().toISODate();

    const dayStart = DateTime.fromISO(date)
      .setZone("Europe/London")
      .startOf("day")
      .toJSDate();
    const dayEnd = DateTime.fromISO(date)
      .setZone("Europe/London")
      .endOf("day")
      .toJSDate();

    const orders = await Order.findAll({
      where: {
        created_at: {
          [Op.between]: [dayStart, dayEnd],
        },
      },
      order: [["created_at", "DESC"]],
    });

    const formatted = orders.map((o) => ({
      ...o.toJSON(),
      created_at: formatToISO(o.created_at),
      date: o.date,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("❌ Error fetching orders by date:", error);
    res.status(500).json({ error: "Server error while fetching orders" });
  }
};

exports.getSalesSummary = async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {};

    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to) where.created_at[Op.lte] = new Date(to);
    }
    const orders = await Order.findAll({ where });

    const formatted = orders.map((o) => ({
      ...o.toJSON(),
      created_at: formatToISO(o.created_at),
      date: o.date,
    }));

    const totalRevenue = orders.reduce(
      (sum, o) => sum + parseFloat(o.total_amount || 0),
      0,
    );

    res.json({
      totalOrders: orders.length,
      totalRevenue,
      orders: formatted,
    });
  } catch (error) {
    console.error("❌ Error generating sales summary:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
};

// ✅ POST /orders/hold — save a held order to DB
exports.holdOrder = async (req, res) => {
  try {
    const {
      customer_name,
      server_name,
      order_type,
      items,
      total_amount,
      discount_percent,
      discount_amount,
      display_number,
    } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ error: "Order must have at least one item" });
    }

    if (!total_amount) {
      return res.status(400).json({ error: "total_amount is required" });
    }

    const held = await HeldOrder.create({
      customer_name: customer_name || "N/A",
      server_name: server_name || "",
      order_type: order_type || "",
      items,
      total_amount,
      discount_percent: discount_percent || 0,
      discount_amount: discount_amount || 0,
      display_number: display_number || null,
      date: DateTime.now()
        .setZone("Europe/London")
        .toFormat("dd/MM/yyyy HH:mm:ss"),
    });

    res.status(201).json({ message: "Order held successfully", held });
  } catch (err) {
    console.error("❌ Hold order error:", err);
    res.status(500).json({ error: "Failed to hold order" });
  }
};

// ✅ GET /orders/held — get all held orders
exports.getHeldOrders = async (req, res) => {
  try {
    const held = await HeldOrder.findAll({
      order: [["created_at", "DESC"]],
    });
    res.json(held);
  } catch (err) {
    console.error("❌ Get held orders error:", err);
    res.status(500).json({ error: "Failed to fetch held orders" });
  }
};

// ✅ DELETE /orders/held/:id — delete a single held order
exports.deleteHeldOrder = async (req, res) => {
  try {
    const held = await HeldOrder.findByPk(req.params.id);
    if (!held) return res.status(404).json({ error: "Held order not found" });
    await held.destroy();
    res.json({ message: "Held order deleted" });
  } catch (err) {
    console.error("❌ Delete held order error:", err);
    res.status(500).json({ error: "Failed to delete held order" });
  }
};

// ✅ DELETE /orders/held — clear all held orders
exports.clearAllHeldOrders = async (req, res) => {
  try {
    await HeldOrder.destroy({ where: {} });
    res.json({ message: "All held orders cleared" });
  } catch (err) {
    console.error("❌ Clear held orders error:", err);
    res.status(500).json({ error: "Failed to clear held orders" });
  }
};

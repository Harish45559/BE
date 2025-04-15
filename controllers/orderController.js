const { Order } = require('../models');
const { Op } = require('sequelize');
const { DateTime } = require('luxon');

// ✅ ISO UTC string for consistent frontend usage
const formatToISO = (date) => {
  return DateTime.fromJSDate(date).toISO(); // No zone shift
};

// ✅ POST /orders
exports.placeOrder = async (req, res) => {
  try {
    const orderData = req.body; // ✅ MUST BE DEFINED FIRST
    

    // ✅ Ensure created_at is UTC
    orderData.created_at = orderData.created_at
      ? DateTime.fromISO(orderData.created_at).toUTC().toJSDate()
      : DateTime.now().toUTC().toJSDate();

    // ✅ Add UK-local date field (e.g. "10/04/2025 14:35:00")
    orderData.date = DateTime.now().setZone('Europe/London').toFormat('dd/MM/yyyy HH:mm:ss');

    // Get next order number
    const orders = await Order.findAll({
      attributes: ['order_number'],
      order: [['order_number', 'DESC']],
      limit: 1
    });
    

    let nextOrderNumber = 1001;
    if (orders.length && orders[0].order_number) {
      nextOrderNumber = parseInt(orders[0].order_number, 10) + 1;
    }

    orderData.order_number = nextOrderNumber;

    const order = await Order.create(orderData);

    res.status(201).json({
      message: 'Order placed successfully',
      order: {
        ...order.toJSON(),
        created_at: order.created_at.toISOString(),
        date: order.date
      }
    });

  } catch (error) {
    console.error('❌ Error placing order:', error);
    res.status(500).json({ error: 'Failed to place order', details: error.message });
  }
};



// ✅ GET /orders/all
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      order: [['created_at', 'DESC']],
    });

    const formatted = orders.map(o => ({
      ...o.toJSON(),
      created_at: formatToISO(o.created_at),
      date: o.date
    }));

    res.json(formatted);
  } catch (error) {
    console.error('❌ Error fetching all orders:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

// ✅ GET /orders/by-date?date=YYYY-MM-DD
exports.getOrdersByDate = async (req, res) => {
  try {
    const date = req.query.date || DateTime.now().toISODate();

    const dayStart = DateTime.fromISO(date).setZone('Europe/London').startOf('day').toJSDate();
    const dayEnd = DateTime.fromISO(date).setZone('Europe/London').endOf('day').toJSDate();

    const orders = await Order.findAll({
      where: {
        created_at: {
          [Op.between]: [dayStart, dayEnd],
        },
      },
      order: [['created_at', 'DESC']],
    });

    const formatted = orders.map(o => ({
      ...o.toJSON(),
      created_at: formatToISO(o.created_at),
      date: o.date
    }));

    res.json(formatted);
  } catch (error) {
    console.error('❌ Error fetching orders by date:', error);
    res.status(500).json({ error: 'Server error while fetching orders' });
  }
};

// ✅ GET /orders/summary
exports.getSalesSummary = async (req, res) => {
  try {
    const orders = await Order.findAll();

    const formatted = orders.map(o => ({
      ...o.toJSON(),
      created_at: formatToISO(o.created_at),
      date: o.date
    }));

    const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

    res.json({
      totalOrders: orders.length,
      totalRevenue,
      orders: formatted
    });

  } catch (error) {
    console.error('❌ Error generating sales summary:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
};

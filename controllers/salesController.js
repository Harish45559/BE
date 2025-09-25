const { Op } = require('sequelize');
const { Order } = require('../models');

// Inclusive UTC range for YYYY-MM-DD → YYYY-MM-DD
const makeUtcRange = (fromDate, toDate) => {
  const start = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${toDate}T23:59:59.999Z`);
  return { start, end };
};

// Prefer final_amount, fallback to total_amount
const money = (o) => Number(o?.final_amount ?? o?.total_amount ?? 0);

// GET /sales/summary?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
// -> { totalSales, cashSales, cardSales }
exports.getSalesSummary = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const where = {};
    if (fromDate && toDate) {
      const { start, end } = makeUtcRange(fromDate, toDate);
      where.created_at = { [Op.between]: [start, end] };
    }

    const orders = await Order.findAll({ where });

    const totalSales = orders.reduce((sum, o) => sum + money(o), 0);
    const cashSales  = orders.filter(o => o.payment_method === 'Cash').reduce((s, o) => s + money(o), 0);
    const cardSales  = orders.filter(o => o.payment_method === 'Card').reduce((s, o) => s + money(o), 0);

    res.json({ totalSales, cashSales, cardSales });
  } catch (err) {
    console.error('getSalesSummary error:', err);
    res.status(500).json({ message: 'Error fetching sales summary' });
  }
};


exports.getTopSellingItems = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const where = {};
    if (fromDate && toDate) {
      const { start, end } = makeUtcRange(fromDate, toDate);
      where.created_at = { [Op.between]: [start, end] };
    }

    const orders = await Order.findAll({ where });

    const counts = {};
    for (const o of orders) {
      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) {
        if (!it || !it.name) continue;
        const qty = Number(it.qty ?? it.quantity ?? 0);
        counts[it.name] = (counts[it.name] || 0) + qty;
      }
    }

    const top = Object.entries(counts)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity);

    res.json(top);
  } catch (err) {
    console.error('getTopSellingItems error:', err);
    res.status(500).json({ message: 'Error fetching top selling items' });
  }
};


exports.getTotalSales = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const where = {};
    if (fromDate && toDate) {
      const { start, end } = makeUtcRange(fromDate, toDate);
      where.created_at = { [Op.between]: [start, end] };
    }

    const orders = await Order.findAll({
      where,
      order: [['created_at', 'DESC']],
    });

    res.json(orders);
  } catch (err) {
    console.error('getTotalSales error:', err);
    res.status(500).json({ message: 'Error fetching total sales orders' });
  }
};

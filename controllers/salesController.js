// ✅ Updated: server/controllers/salesController.js

const { Op } = require('sequelize');
const db = require('../models');
const Order = db.Order;
const { DateTime } = require('luxon');

// 🕒 Helper: Convert any date to UK timezone
const toUKTime = (date) => DateTime.fromISO(date).setZone('Europe/London').toJSDate();

exports.getSalesReport = async (req, res) => {
  try {
    const { from, to, search, orderType, category, item } = req.query;

    let where = {};

    // 📆 Apply UK time conversion for date filters
    if (from) {
      where.created_at = { [Op.gte]: toUKTime(from) };
    }
    if (to) {
      where.created_at = {
        ...(where.created_at || {}),
        [Op.lte]: toUKTime(to)
      };
    }

    if (search) {
      where.customer_name = { [Op.iLike]: `%${search}%` };
    }

    if (orderType && orderType !== 'All') {
      where.order_type = orderType;
    }

    const allOrders = await Order.findAll({ where, order: [['created_at', 'DESC']] });

    // Filter by category/item from inside "items"
    const filtered = allOrders.filter(order => {
      const items = order.items || [];
      const itemMatch = !item || items.some(i => i.name === item);
      const categoryMatch = !category || items.some(i => i.category === category);
      return itemMatch && categoryMatch;
    });

    res.json({ sales: filtered });
  } catch (err) {
    console.error('Error fetching sales report:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getTopSellingItems = async (req, res) => {
  try {
    const orders = await Order.findAll();
    const itemCount = {};

    orders.forEach(order => {
      (order.items || []).forEach(item => {
        if (!itemCount[item.name]) {
          itemCount[item.name] = 0;
        }
        itemCount[item.name] += item.qty || 1;
      });
    });

    const topItems = Object.entries(itemCount)
      .map(([name, qty]) => ({ name, total_sold: qty }))
      .sort((a, b) => b.total_sold - a.total_sold)
      .slice(0, 10); // Top 10

    res.json(topItems);
  } catch (err) {
    console.error('Top items error:', err);
    res.status(500).json({ message: 'Failed to fetch top items' });
  }
};

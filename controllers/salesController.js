const { Op, fn, col } = require('sequelize');
const { Order } = require('../models');

const MenuItem = require('../models/menuItem');


exports.getSalesSummary = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const where = {};

    if (fromDate && toDate) {
      where.created_at = {
        [Op.between]: [new Date(fromDate), new Date(toDate)],
      };
    }

    const orders = await Order.findAll({ where });

    const totalSales = orders.reduce((sum, order) => sum + order.total_amount, 0);
    const cashSales = orders.filter(o => o.payment_method === 'Cash').reduce((sum, order) => sum + order.total_amount, 0);
    const cardSales = orders.filter(o => o.payment_method === 'Card').reduce((sum, order) => sum + order.total_amount, 0);

    res.json({ totalSales, cashSales, cardSales });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching sales summary' });
  }
};

exports.getTopSellingItems = async (req, res) => {
  try {
    const orders = await Order.findAll();

    const itemCounts = {};

    orders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
        });
      }
    });

    const topItems = Object.entries(itemCounts)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity);

    res.json(topItems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching top selling items' });
  }
};

exports.getTotalSales = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    const whereCondition = {};
    if (fromDate && toDate) {
      whereCondition.created_at = {
        [Op.between]: [new Date(fromDate), new Date(toDate)],
      };
    }

    const orders = await Order.findAll({ where: whereCondition });

    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching total sales orders' });
  }
};
 
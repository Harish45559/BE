// ✅ Updated: server/controllers/salesController.js

const { Op } = require('sequelize');
const db = require('../models');
const Order = db.Order;
const { TillStatus } = db;
const { DateTime } = require('luxon');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');

// 🕒 Convert to UK timezone
const toUKTime = (date) => DateTime.fromISO(date).setZone('Europe/London').toJSDate();

// 📊 Get Sales Report
exports.getSalesReport = async (req, res) => {
  try {
    const { from, to, search, orderType, category, item } = req.query;

    let where = {};

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

// 🏆 Top Selling Items
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
      .slice(0, 10);

    res.json(topItems);
  } catch (err) {
    console.error('Top items error:', err);
    res.status(500).json({ message: 'Failed to fetch top items' });
  }
};

// 💵 Export Till Cash CSV
exports.exportTillCSV = async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = { payment_method: 'Cash' };

    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to) where.created_at[Op.lte] = new Date(to);
    }

    const orders = await Order.findAll({ where });

    const data = orders.map(o => ({
      OrderNo: o.order_number,
      Date: o.date,
      Customer: o.customer_name,
      Server: o.server_name,
      Amount: `£${o.total_amount.toFixed(2)}`
    }));

    const parser = new Parser();
    const csv = parser.parse(data);
    res.header('Content-Type', 'text/csv');
    res.attachment('till_cash_report.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'CSV Export Failed' });
  }
};

// 📄 Export Till Cash PDF
exports.exportTillPDF = async (req, res) => {
  const doc = new PDFDocument();
  try {
    const { from, to } = req.query;
    const where = { payment_method: 'Cash' };

    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to) where.created_at[Op.lte] = new Date(to);
    }

    const orders = await Order.findAll({ where });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=till_cash_report.pdf');
    doc.pipe(res);

    doc.fontSize(16).text('Till Cash Report', { align: 'center' }).moveDown();

    orders.forEach((o, i) => {
      doc.fontSize(12).text(
        `${i + 1}. Order #${o.order_number} | ${o.date} | ${o.customer_name} | ${o.server_name} | £${o.total_amount.toFixed(2)}`
      );
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: 'PDF Export Failed' });
    doc.end();
  }
};

// ✅ Open Till
exports.openTill = async (req, res) => {
  const { employee } = req.body;
  const today = new Date().toISOString().slice(0, 10);

  const existing = await TillStatus.findOne({ where: { date: today } });
  if (existing) return res.status(400).json({ error: 'Till already opened' });

  await TillStatus.create({
    date: today,
    opened_by: employee,
    open_time: new Date(),
    opening_amount: 100
  });

  res.json({ message: 'Till opened' });
};

// ✅ Close Till
exports.closeTill = async (req, res) => {
  const { employee } = req.body;
  const today = new Date().toISOString().slice(0, 10);

  const till = await TillStatus.findOne({ where: { date: today } });
  if (!till) return res.status(404).json({ error: 'Till not found' });

  const orders = await Order.findAll({
    where: {
      payment_method: 'Cash',
      created_at: { [Op.gte]: new Date(today) }
    }
  });

  const cashSales = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);
  till.closed_by = employee;
  till.close_time = new Date();
  till.closing_amount = 100 + cashSales;
  await till.save();

  res.json({ message: 'Till closed' });
};

// 🗓️ Get Till Status by Date
exports.getTillStatusByDate = async (req, res) => {
  const { date } = req.params;
  const till = await TillStatus.findOne({ where: { date } });
  res.json(till || {});
};

// 💷 Get Till Cash Summary (used by /till-cash route)
exports.getTillCash = async (req, res) => {
  try {
    const { from, to } = req.query;

    const where = {
      payment_method: 'Cash',
    };

    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = new Date(from);
      if (to) where.created_at[Op.lte] = new Date(to);
    }

    const orders = await Order.findAll({ where });

    const totalCash = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

    res.json({ totalCash, count: orders.length, orders });
  } catch (err) {
    console.error('getTillCash error:', err);
    res.status(500).json({ message: 'Failed to fetch till cash' });
  }
};

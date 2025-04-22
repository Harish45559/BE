const { Op } = require('sequelize');
const db = require('../models');
const { Order, Till } = require('../models');

const { DateTime } = require('luxon');

// Convert to UK timezone
const toUK = (dateStr) => DateTime.fromISO(dateStr).setZone('Europe/London').toISODate();

// OPEN TILL
exports.openTill = async (req, res) => {
  const { employee } = req.body;
  const today = toUK(DateTime.now().toISO());

  const existing = await Till.findOne({ where: { date: today } });
  if (existing) return res.status(400).json({ error: 'Till already opened' });

  const till = await Till.create({
    date: today,
    employee,
    opening_cash: 100,
    open_time: new Date()
  });

  res.json({ message: 'Till opened', till });
};

// CLOSE TILL
exports.closeTill = async (req, res) => {
  const { employee } = req.body;
  const today = toUK(DateTime.now().toISO());

  const till = await Till.findOne({ where: { date: today } });
  if (!till) return res.status(404).json({ error: 'Till not found' });
  if (till.close_time) return res.status(400).json({ error: 'Till already closed' });

  till.close_time = new Date();
  till.closing_cash = 100;
  till.closed_by = employee;
  await till.save();

  res.json({ message: 'Till closed', till });
};

// GET TILL STATUS BY DATE
exports.getTillStatus = async (req, res) => {
  const { date } = req.params;
  const record = await Till.findOne({ where: { date } });
  if (!record) return res.status(404).json({ error: 'No till record found for date' });
  res.json(record);
};

// GET TILL CASH COUNT BY DATE
exports.getTillCashByDate = async (req, res) => {
  const { date } = req.params;
  const dayStart = DateTime.fromISO(date).startOf('day').toUTC().toISO();
  const dayEnd = DateTime.fromISO(date).endOf('day').toUTC().toISO();

  const cashOrders = await Order.findAll({
    where: {
      created_at: { [Op.between]: [dayStart, dayEnd] },
      payment_method: 'Cash'
    }
  });

  const total = cashOrders.reduce((sum, o) => sum + parseFloat(o.total_amount), 0);

  res.json({ totalCash: total + 100, orders: cashOrders });
};

// TOTAL SALES
exports.getTotalSalesByDate = async (req, res) => {
  const { date, method } = req.query;
  const dayStart = DateTime.fromISO(date).startOf('day').toUTC().toISO();
  const dayEnd = DateTime.fromISO(date).endOf('day').toUTC().toISO();

  const where = {
    created_at: { [Op.between]: [dayStart, dayEnd] }
  };
  if (method && method !== 'All') where.payment_method = method;

  const orders = await Order.findAll({ where });
  const sum = orders.reduce((sum, o) => sum + parseFloat(o.total_amount), 0);

  res.json({ total: sum.toFixed(2), orders });
};

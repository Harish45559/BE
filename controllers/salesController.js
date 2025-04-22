const { Op } = require('sequelize');
const db = require('../models');
const { Order, TillStatus } = db;
const { DateTime } = require('luxon');

const toUK = (dateStr) => DateTime.fromISO(dateStr).setZone('Europe/London').toISODate();

exports.openTill = async (req, res) => {
  try {
    const { employee } = req.body;
    const today = toUK(DateTime.now().toISO());
    const exists = await TillStatus.findOne({ where: { date: today } });

    if (exists) return res.status(400).json({ error: 'Till already opened' });

    const till = await TillStatus.create({
      date: today,
      opened_by: employee,
      open_time: new Date(),
      opening_amount: 100
    });

    res.json({ message: 'Till opened', till });
  } catch (err) {
    res.status(500).json({ error: 'Failed to open till' });
  }
};

exports.closeTill = async (req, res) => {
  try {
    const { employee } = req.body;
    const today = toUK(DateTime.now().toISO());
    const till = await TillStatus.findOne({ where: { date: today } });

    if (!till) return res.status(404).json({ error: 'Till not found' });
    if (till.close_time) return res.status(400).json({ error: 'Till already closed' });

    till.close_time = new Date();
    till.closed_by = employee;
    till.closing_amount = 100;
    await till.save();

    res.json({ message: 'Till closed', till });
  } catch (err) {
    res.status(500).json({ error: 'Failed to close till' });
  }
};

exports.getTillStatus = async (req, res) => {
  try {
    const { date } = req.params;
    const record = await TillStatus.findOne({ where: { date } });
    if (!record) return res.status(404).json({ error: 'No status found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get till status' });
  }
};

exports.getTillCashByDate = async (req, res) => {
  try {
    const { from, to } = req.query;
    const start = DateTime.fromISO(from).startOf('day').toUTC().toISO();
    const end = DateTime.fromISO(to).endOf('day').toUTC().toISO();

    const cashOrders = await Order.findAll({
      where: {
        created_at: { [Op.between]: [start, end] },
        payment_method: 'Cash'
      }
    });

    const total = cashOrders.reduce((sum, o) => sum + parseFloat(o.total_amount), 0);
    res.json({ totalCash: total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load till cash summary' });
  }
};

exports.getTopSellingItems = async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {};

    if (from && to) {
      where.created_at = {
        [Op.between]: [
          DateTime.fromISO(from).startOf('day').toUTC().toISO(),
          DateTime.fromISO(to).endOf('day').toUTC().toISO(),
        ],
      };
    }

    const orders = await Order.findAll({ where });
    const itemMap = {};

    orders.forEach(order => {
      const items = JSON.parse(order.items || '[]');
      items.forEach(item => {
        const key = item.name;
        if (!itemMap[key]) itemMap[key] = 0;
        itemMap[key] += item.qty;
      });
    });

    const result = Object.entries(itemMap).map(([name, total_sold]) => ({ name, total_sold }));
    result.sort((a, b) => b.total_sold - a.total_sold);

    res.json(result.slice(0, 10));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load top selling items' });
  }
};

exports.getSalesReport = async (req, res) => {
  try {
    const { from, to, search, orderType, category, item, paymentMethod } = req.query;
    const selectedDate = from || DateTime.now().setZone('Europe/London').toFormat('yyyy-MM-dd');

    const till = await TillStatus.findOne({ where: { date: selectedDate } });
    let where = {};

    if (till?.open_time && till?.close_time) {
      where.created_at = {
        [Op.between]: [till.open_time.toISOString(), till.close_time.toISOString()]
      };
    } else if (from && to) {
      where.created_at = {
        [Op.between]: [
          DateTime.fromISO(from).startOf('day').toUTC().toISO(),
          DateTime.fromISO(to).endOf('day').toUTC().toISO()
        ]
      };
    }

    if (paymentMethod && paymentMethod !== 'All') {
      where.payment_method = paymentMethod;
    }

    if (orderType && orderType !== 'All') {
      where.order_type = orderType;
    }

    if (search) {
      where.customer_name = { [Op.iLike]: `%${search}%` };
    }

    const sales = await Order.findAll({ where });
    res.json({ sales });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load sales report' });
  }
};

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


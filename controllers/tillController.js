const { TillStatus } = require("../models");
const { DateTime } = require("luxon");

const todayUK = () =>
  DateTime.now().setZone("Europe/London").toFormat("dd/MM/yyyy");

// GET /api/till/status  — returns today's till record (or {open: false} if none)
exports.getTillStatus = async (req, res) => {
  try {
    const date = todayUK();
    const record = await TillStatus.findOne({ where: { date } });
    if (!record) return res.json({ open: false, date });
    res.json(record);
  } catch (err) {
    console.error("getTillStatus error:", err);
    res.status(500).json({ error: "Failed to fetch till status" });
  }
};

// POST /api/till/open  — opens the till for today
exports.openTill = async (req, res) => {
  try {
    const { opened_by, opening_amount } = req.body;
    const date = todayUK();

    const [record] = await TillStatus.findOrCreate({
      where: { date },
      defaults: {
        date,
        open: false,
        opened_by: null,
        open_time: null,
        closing_amount: null,
        closed_by: null,
        close_time: null,
      },
    });

    if (record.open) {
      return res.status(400).json({ error: "Till is already open" });
    }

    await record.update({
      open: true,
      opened_by: opened_by || "unknown",
      open_time: DateTime.now().toUTC().toJSDate(),
      opening_amount: opening_amount ?? null,
      // reset close fields in case it was closed earlier today
      closed_by: null,
      close_time: null,
      closing_amount: null,
    });

    res.json(record);
  } catch (err) {
    console.error("openTill error:", err);
    res.status(500).json({ error: "Failed to open till" });
  }
};

// POST /api/till/close  — closes the till for today
exports.closeTill = async (req, res) => {
  try {
    const { closed_by, closing_amount } = req.body;
    const date = todayUK();

    const record = await TillStatus.findOne({ where: { date } });
    if (!record || !record.open) {
      return res.status(400).json({ error: "Till is not open" });
    }

    await record.update({
      open: false,
      closed_by: closed_by || "unknown",
      close_time: DateTime.now().toUTC().toJSDate(),
      closing_amount: closing_amount ?? null,
    });

    res.json(record);
  } catch (err) {
    console.error("closeTill error:", err);
    res.status(500).json({ error: "Failed to close till" });
  }
};

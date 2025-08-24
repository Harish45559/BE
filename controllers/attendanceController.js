// controllers/attendanceController.js
const { DateTime } = require('luxon');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');

const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');

/* ----------------------------- helpers ----------------------------- */
const ukNow = () => DateTime.now().setZone('Europe/London');

const toHHMM = (mins) => {
  const m = Math.max(0, Math.round(Number(mins) || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${String(h).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
};

// Parse a value that might be a JS Date (from Sequelize) or an ISO string
const parseUTC = (val) => {
  if (!val) return null;
  if (val instanceof Date) return DateTime.fromJSDate(val, { zone: 'utc' });
  if (typeof val === 'string') return DateTime.fromISO(val, { zone: 'utc' });
  try {
    return DateTime.fromJSDate(new Date(val), { zone: 'utc' });
  } catch {
    return null;
  }
};

// Compute net minutes between two ISO datetimes (UTC), with auto break
const netMinutesBetween = (clockInISO, clockOutISO) => {
  const ci = parseUTC(clockInISO);
  const co = clockOutISO ? parseUTC(clockOutISO) : DateTime.utc();
  if (!ci?.isValid || !co?.isValid) return 0;

  // Diff entirely in UTC so midnight rollover is never a problem
  const gross = Math.max(0, Math.round(co.diff(ci, 'minutes').minutes));

  // Auto break: 30 minutes if shift >= 6 hours (360 min)
  const breakMinutes = gross >= 360 ? 30 : 0;

  return Math.max(0, gross - breakMinutes);
};

/* ------------------------------ clock in --------------------------- */
exports.clockIn = async (req, res) => {
  try {
    const { pin, employeeId } = req.body;

    const employee = await Employee.findOne({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Invalid employee' });

    const ok = bcrypt.compareSync(pin, employee.pin);
    if (!ok) return res.status(401).json({ error: 'Invalid PIN' });

    // prevent overlapping open session
    const open = await Attendance.findOne({
      where: { employee_id: employee.id, clock_out: { [Op.is]: null } }
    });
    if (open) return res.status(400).json({ error: 'Already clocked in (open session exists)' });

    const nowUK = ukNow();

    const created = await Attendance.create({
      employee_id: employee.id,
      clock_in: nowUK.toUTC().toISO(),                 // canonical UTC
      clock_in_uk: nowUK.toFormat('dd/MM/yyyy HH:mm'), // display copy
      break_minutes: 0,
      total_work_hours: null
    });

    res.json({ message: 'Clock-in recorded', attendance: created });
  } catch (err) {
    console.error('Clock-In Error:', err);
    res.status(500).json({ error: 'Clock-in failed' });
  }
};

/* ------------------------------ clock out -------------------------- */
exports.clockOut = async (req, res) => {
  try {
    const { pin, employeeId } = req.body;

    const employee = await Employee.findOne({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Invalid employee' });

    const ok = bcrypt.compareSync(pin, employee.pin);
    if (!ok) return res.status(401).json({ error: 'Invalid PIN' });

    const nowUK = ukNow();
    const nowUTC = nowUK.toUTC();

    // latest open shift
    const attendance = await Attendance.findOne({
      where: { employee_id: employee.id, clock_out: { [Op.is]: null } },
      order: [['clock_in', 'DESC']]
    });
    if (!attendance) {
      return res.status(404).json({ error: 'No clock-in found or already clocked out' });
    }

    // Compute net minutes (safe across midnight, robust parsing)
    const ciUTC = parseUTC(attendance.clock_in);
    if (!ciUTC?.isValid) {
      console.error('Invalid clock_in on record:', attendance.clock_in);
      return res.status(500).json({ error: 'Invalid clock-in timestamp on record' });
    }

    const gross = Math.max(0, Math.round(nowUTC.diff(ciUTC, 'minutes').minutes));
    const breakMinutes = gross >= 360 ? 30 : 0;
    const net = Math.max(0, gross - breakMinutes);

    attendance.clock_out = nowUTC.toISO();                   // canonical UTC
    attendance.clock_out_uk = nowUK.toFormat('dd/MM/yyyy HH:mm');
    attendance.break_minutes = breakMinutes;
    attendance.total_work_hours = toHHMM(net);
    await attendance.save();

    res.json({ message: 'Clock-out recorded', attendance });
  } catch (err) {
    console.error('Clock-Out Error:', err);
    res.status(500).json({ error: 'Clock-out failed' });
  }
};

/* ------------------------ attendance by date ----------------------- */
/* Includes records that start, end, or span the date.
   Also returns computed per-row HH:MM and a daily total so the UI
   can render “Day details” without doing its own math. */
exports.getAttendanceByDate = async (req, res) => {
  try {
    const qDate = req.query.date
      ? DateTime.fromISO(req.query.date).setZone('Europe/London')
      : ukNow();

    // Use UTC boundaries to match stored UTC values
    const startUTC = qDate.startOf('day').toUTC().toJSDate();
    const endUTC = qDate.endOf('day').toUTC().toJSDate();

    const rows = await Attendance.findAll({
      where: {
        [Op.or]: [
          { clock_in:  { [Op.between]: [startUTC, endUTC] } }, // started today
          { clock_out: { [Op.between]: [startUTC, endUTC] } }, // ended today
          { // spans overnight across this day or still open
            [Op.and]: [
              { clock_in:  { [Op.lt]: startUTC } },
              { clock_out: { [Op.or]: [{ [Op.gt]: endUTC }, { [Op.is]: null }] } }
            ]
          }
        ]
      },
      order: [['clock_in', 'ASC']]
    });

    let dailyMinutes = 0;
    const items = rows.map(r => {
      const mins = netMinutesBetween(r.clock_in, r.clock_out);
      dailyMinutes += mins;
      return {
        ...r.toJSON(),
        computed_work_minutes: mins,
        computed_work_hhmm: toHHMM(mins),
      };
    });

    res.json({
      date: qDate.toFormat('dd/MM/yyyy'),
      daily_total_minutes: dailyMinutes,
      daily_total_hhmm: toHHMM(dailyMinutes),
      items
    });
  } catch (err) {
    console.error('Fetch attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};

/* ------------------------------ status ----------------------------- */
/* Latest record per employee; no midnight reset. */
exports.getStatus = async (_req, res) => {
  try {
    const rows = await Attendance.findAll({
      attributes: ['employee_id', 'clock_in', 'clock_out'],
      order: [['clock_in', 'DESC']]
    });

    const latest = {};
    for (const r of rows) {
      const id = r.employee_id;
      if (!id) continue;
      if (!(id in latest)) {
        latest[id] = r.clock_out == null ? 'Clocked In' : 'Clocked Out';
      }
    }

    res.json(
      Object.entries(latest).map(([id, status]) => ({ id: Number(id), status }))
    );
  } catch (err) {
    console.error('Attendance Status Error:', err);
    res.status(500).json({ error: 'Failed to fetch status', details: err.message });
  }
};

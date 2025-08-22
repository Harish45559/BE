// controllers/attendanceController.js
const { DateTime, Duration } = require('luxon');
const { Op } = require('sequelize');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const bcrypt = require('bcryptjs');

// Business timezone for “split at midnight”
const BUSINESS_TZ = 'Europe/London';
const nowInTZ = () => DateTime.now().setZone(BUSINESS_TZ);

const minutesToHHMM = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

// Split a [clock_in, clock_out] interval into day buckets at midnight (00:00) in BUSINESS_TZ
function splitByMidnight(clockInISO, clockOutISO, zone = BUSINESS_TZ) {
  if (!clockInISO || !clockOutISO) return [];
  let start = DateTime.fromISO(clockInISO).setZone(zone);
  let end   = DateTime.fromISO(clockOutISO).setZone(zone);
  if (!end.isValid || !start.isValid || end <= start) return [];

  const parts = [];
  let cursor = start;
  while (cursor < end) {
    const nextMidnight = cursor.plus({ days: 1 }).startOf('day'); // midnight after cursor
    const segEnd = end < nextMidnight ? end : nextMidnight;
    const mins = segEnd.diff(cursor, 'minutes').minutes;
    if (mins > 0) {
      parts.push({
        day: cursor.toISODate(),                // YYYY-MM-DD in BUSINESS_TZ
        minutes: Math.round(mins)
      });
    }
    cursor = segEnd;
  }
  return parts;
}

// ================== CLOCK IN ==================
exports.clockIn = async (req, res) => {
  try {
    const { pin, employeeId } = req.body;

    const employee = await Employee.findOne({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Invalid employee' });

    const isMatch = bcrypt.compareSync(pin, employee.pin);
    if (!isMatch) return res.status(401).json({ error: 'Invalid PIN' });

    // Prevent multiple open sessions
    const openAttendance = await Attendance.findOne({
      where: { employee_id: employee.id, clock_out: null }
    });
    if (openAttendance) {
      return res.status(400).json({ error: 'Already clocked in (open session exists)' });
    }

    const now = nowInTZ();

    const newAttendance = await Attendance.create({
      employee_id: employee.id,
      clock_in: now.toUTC().toISO(),
      clock_in_uk: now.toFormat('dd/MM/yyyy HH:mm'), // keep your display field
    });

    return res.json({ message: 'Clock-in recorded', attendance: newAttendance });
  } catch (err) {
    console.error('Clock-In Error:', err);
    res.status(500).json({ error: 'Clock-in failed' });
  }
};

// ================== CLOCK OUT ==================
exports.clockOut = async (req, res) => {
  try {
    const { pin, employeeId } = req.body;

    const employee = await Employee.findOne({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Invalid employee' });

    const isMatch = bcrypt.compareSync(pin, employee.pin);
    if (!isMatch) return res.status(401).json({ error: 'Invalid PIN' });

    const now = nowInTZ();

    // Most recent open session
    const attendance = await Attendance.findOne({
      where: { employee_id: employee.id, clock_out: null },
      order: [['clock_in', 'DESC']]
    });
    if (!attendance) {
      return res.status(404).json({ error: 'No clock-in found or already clocked out' });
    }

    // Close it
    attendance.clock_out = now.toUTC().toISO();
    attendance.clock_out_uk = now.toFormat('dd/MM/yyyy HH:mm');

    // Total minutes for THIS single shift
    const shiftMinutes = DateTime.fromISO(attendance.clock_out)
      .diff(DateTime.fromISO(attendance.clock_in), 'minutes').minutes;

    attendance.total_work_hours = minutesToHHMM(Math.max(0, Math.round(shiftMinutes)));
    await attendance.save();

    // Also return the split-by-midnight allocation for convenience
    const parts = splitByMidnight(attendance.clock_in, attendance.clock_out, BUSINESS_TZ);

    return res.json({
      message: 'Clock-out recorded',
      attendance: {
        ...attendance.toJSON(),
        daily_allocation: parts, // [{day:'YYYY-MM-DD', minutes: N}, ...]
      }
    });
  } catch (err) {
    console.error('Clock-Out Error:', err);
    res.status(500).json({ error: 'Clock-out failed' });
  }
};

// ================== PER-DATE RAW RECORDS (overlap-aware) ==================
// Returns raw attendance rows that overlap the requested date in BUSINESS_TZ.
exports.getAttendanceByDate = async (req, res) => {
  try {
    const date = req.query.date
      ? DateTime.fromISO(req.query.date).setZone(BUSINESS_TZ)
      : nowInTZ();

    // Compute the UTC window for the local day
    const startLocal = date.startOf('day');
    const endLocal   = date.endOf('day');
    const startUTC = startLocal.toUTC().toJSDate();
    const endUTC   = endLocal.toUTC().toJSDate();

    // Fetch any rows that overlap the local day:
    // (clock_in < dayEnd) AND (COALESCE(clock_out, nowUTC) > dayStart)
    const nowUTC = new Date();
    const records = await Attendance.findAll({
      where: {
        clock_in: { [Op.lt]: endUTC },
        [Op.or]: [
          { clock_out: { [Op.gt]: startUTC } },
          { clock_out: null } // open shift overlapping the day
        ]
      },
      order: [['clock_in', 'ASC']]
    });

    res.status(200).json(records);
  } catch (err) {
    console.error('Fetch attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};

// ================== DAILY SUMMARY (split at midnight) ==================
// GET /attendance/daily-summary?date=YYYY-MM-DD
// Returns [{ employee_id, minutes }] counting only minutes within that local date.
exports.getDailySummary = async (req, res) => {
  try {
    const date = req.query.date
      ? DateTime.fromISO(req.query.date).setZone(BUSINESS_TZ)
      : nowInTZ();

    const startLocal = date.startOf('day');
    const endLocal   = date.endOf('day');
    const startUTC = startLocal.toUTC().toJSDate();
    const endUTC   = endLocal.toUTC().toJSDate();
    const targetISODate = startLocal.toISODate(); // YYYY-MM-DD

    const rows = await Attendance.findAll({
      where: {
        clock_in: { [Op.lt]: endUTC },
        [Op.or]: [
          { clock_out: { [Op.gt]: startUTC } },
          { clock_out: null }
        ]
      },
      attributes: ['id', 'employee_id', 'clock_in', 'clock_out']
    });

    // Aggregate minutes by employee for the target day
    const totals = new Map(); // employee_id -> minutes
    const nowUTC = DateTime.now().toUTC().toISO();

    rows.forEach(r => {
      const ci = r.clock_in;
      const co = r.clock_out || nowUTC; // open shift: use "now"
      const parts = splitByMidnight(ci, co, BUSINESS_TZ);
      const match = parts.find(p => p.day === targetISODate);
      if (match && match.minutes > 0) {
        totals.set(r.employee_id, (totals.get(r.employee_id) || 0) + match.minutes);
      }
    });

    res.json(
      Array.from(totals.entries()).map(([employee_id, minutes]) => ({
        employee_id,
        minutes,
        hhmm: minutesToHHMM(minutes)
      }))
    );
  } catch (err) {
    console.error('Daily summary error:', err);
    res.status(500).json({ error: 'Failed to build daily summary' });
  }
};

// ================== TODAY STATUS (overnight-safe) ==================
// Marks an employee as "Clocked In" if they have ANY open session (regardless of the day they started).
exports.getStatus = async (req, res) => {
  try {
    // Find all open sessions
    const openRows = await Attendance.findAll({
      where: { clock_out: null },
      attributes: ['employee_id']
    });

    const openSet = new Set(openRows.map(r => Number(r.employee_id)));

    // Build status list: employees with open session => Clocked In
    // (If your UI needs all employees, join with Employees table here.
    // For now we return only employees that had any record today or are open.)
    const result = Array.from(openSet).map(id => ({ id, status: 'Clocked In' }));
    res.json(result);
  } catch (err) {
    console.error('Attendance Status Error:', err);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
};

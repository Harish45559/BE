const { DateTime } = require('luxon');
const { Op } = require('sequelize');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const bcrypt = require('bcryptjs');

const getUKTime = () => DateTime.now().setZone('Europe/London');

function minutesToHoursMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ✅ Clock In
exports.clockIn = async (req, res) => {
  try {
    const { pin, employeeId } = req.body;

    const employee = await Employee.findOne({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Invalid employee' });

    const isMatch = bcrypt.compareSync(pin, employee.pin);
    if (!isMatch) return res.status(401).json({ error: 'Invalid PIN' });

    const now = getUKTime();

    const openAttendance = await Attendance.findOne({
      where: { employee_id: employee.id, clock_out: null }
    });
    if (openAttendance) {
      return res.status(400).json({ error: 'Already clocked in' });
    }

    const newAttendance = await Attendance.create({
      employee_id: employee.id,
      clock_in: now.toUTC().toISO(),
      clock_in_uk: now.toFormat('dd/MM/yyyy HH:mm'),
    });

    return res.json({ message: 'Clock-in recorded', attendance: newAttendance });
  } catch (err) {
    console.error('Clock-In Error:', err);
    res.status(500).json({ error: 'Clock-in failed' });
  }
};

// ✅ Clock Out (with auto break + total hours)
exports.clockOut = async (req, res) => {
  try {
    const { pin, employeeId } = req.body;

    const employee = await Employee.findOne({ where: { id: employeeId } });
    if (!employee) return res.status(404).json({ error: 'Invalid employee' });

    const isMatch = bcrypt.compareSync(pin, employee.pin);
    if (!isMatch) return res.status(401).json({ error: 'Invalid PIN' });

    const now = getUKTime();

    const attendance = await Attendance.findOne({
      where: { employee_id: employee.id, clock_out: null },
      order: [['clock_in', 'DESC']]
    });
    if (!attendance) {
      return res.status(404).json({ error: 'No clock-in found or already clocked out' });
    }

    const clockInTime = DateTime.fromISO(attendance.clock_in);
    const grossMinutes = now.diff(clockInTime, 'minutes').minutes;

    // Auto break: 30 min if shift ≥ 6h
    let breakMinutes = grossMinutes >= 360 ? 30 : 0;
    const netMinutes = Math.max(0, grossMinutes - breakMinutes);

    attendance.clock_out = now.toUTC().toISO();
    attendance.clock_out_uk = now.toFormat('dd/MM/yyyy HH:mm');
    attendance.break_minutes = breakMinutes;
    attendance.total_work_hours = minutesToHoursMinutes(netMinutes);
    await attendance.save();

    return res.json({ message: 'Clock-out recorded', attendance });
  } catch (err) {
    console.error('Clock-Out Error:', err);
    res.status(500).json({ error: 'Clock-out failed' });
  }
};

// ✅ Attendance by date (handles overnight)
exports.getAttendanceByDate = async (req, res) => {
  try {
    const date = req.query.date
      ? DateTime.fromISO(req.query.date).setZone('Europe/London')
      : getUKTime();

    const start = date.startOf('day').toJSDate();
    const end = date.endOf('day').toJSDate();

    const records = await Attendance.findAll({
      where: {
        [Op.or]: [
          { clock_in: { [Op.between]: [start, end] } },     // started today
          { clock_out: { [Op.between]: [start, end] } },    // ended today
          {                                                 // spans overnight
            [Op.and]: [
              { clock_in: { [Op.lt]: start } },
              { clock_out: { [Op.or]: [{ [Op.gt]: end }, { [Op.is]: null }] } }
            ]
          }
        ]
      },
    });

    res.status(200).json(records);
  } catch (err) {
    console.error('Fetch attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};

// ✅ Current status (no midnight reset)
exports.getStatus = async (req, res) => {
  try {
    const records = await Attendance.findAll({
      attributes: ['employee_id', 'clock_in', 'clock_out'],
      order: [['clock_in', 'DESC']],
    });

    const latestStatusMap = {};
    records.forEach(record => {
      if (!record || !record.employee_id) return;
      if (!latestStatusMap[record.employee_id]) {
        latestStatusMap[record.employee_id] =
          record.clock_out === null ? 'Clocked In' : 'Clocked Out';
      }
    });

    const result = Object.entries(latestStatusMap).map(([id, status]) => ({
      id: parseInt(id),
      status,
    }));

    res.json(result);
  } catch (err) {
    console.error('Attendance Status Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch status', details: err.message });
  }
};

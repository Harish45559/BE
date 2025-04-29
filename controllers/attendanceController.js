const { DateTime } = require('luxon');
const { Op } = require('sequelize');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const bcrypt = require('bcryptjs');

const getUKTime = () => DateTime.now().setZone('Europe/London');
const formatBST = (dt) => dt.toFormat('dd/MM/yyyy HH:mm');
const formatDuration = (minutes) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

// ✅ Clock In
exports.clockIn = async (req, res) => {
  try {
    const { pin } = req.body;
    const employee = await Employee.findOne({ where: { pin } });
    if (!employee) return res.status(404).json({ error: 'Invalid PIN' });

    const today = DateTime.now().setZone('Europe/London').toFormat('yyyy-LL-dd');
    let attendance = await Attendance.findOne({ where: { employee_id: employee.id, date: today } });

    if (!attendance) {
      attendance = await Attendance.create({
        employee_id: employee.id,
        date: today,
        clock_times: [{ clock_in: DateTime.now().toISO() }]
      });
    } else {
      const clockTimes = attendance.clock_times || [];
      clockTimes.push({ clock_in: DateTime.now().toISO() });
      attendance.clock_times = clockTimes;
      await attendance.save();
    }

    return res.json({ message: 'Clock-in recorded', attendance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Clock-in failed' });
  }
};

// Clock Out
exports.clockOut = async (req, res) => {
  try {
    const { pin } = req.body;
    const employee = await Employee.findOne({ where: { pin } });
    if (!employee) return res.status(404).json({ error: 'Invalid PIN' });

    const today = DateTime.now().setZone('Europe/London').toFormat('yyyy-LL-dd');
    const attendance = await Attendance.findOne({ where: { employee_id: employee.id, date: today } });

    if (!attendance) return res.status(404).json({ error: 'No clock-in found for today' });

    const clockTimes = attendance.clock_times || [];
    const lastSession = clockTimes[clockTimes.length - 1];
    if (!lastSession || lastSession.clock_out) {
      return res.status(400).json({ error: 'Already clocked out. Please clock in again first.' });
    }

    lastSession.clock_out = DateTime.now().toISO();

    // Calculate work hours and break time
    let totalWorkMinutes = 0;
    let firstIn = null;
    let lastOut = null;

    clockTimes.forEach(session => {
      if (session.clock_in && session.clock_out) {
        const clockIn = DateTime.fromISO(session.clock_in);
        const clockOut = DateTime.fromISO(session.clock_out);
        totalWorkMinutes += clockOut.diff(clockIn, 'minutes').minutes;

        if (!firstIn || clockIn < firstIn) firstIn = clockIn;
        if (!lastOut || clockOut > lastOut) lastOut = clockOut;
      }
    });

    let totalSpanMinutes = firstIn && lastOut ? lastOut.diff(firstIn, 'minutes').minutes : 0;
    let breakMinutes = Math.max(0, totalSpanMinutes - totalWorkMinutes);

    attendance.clock_times = clockTimes;
    attendance.total_work_hours = minutesToHoursMinutes(totalWorkMinutes);
    attendance.break_time = minutesToHoursMinutes(breakMinutes);

    await attendance.save();

    return res.json({ message: 'Clock-out recorded', attendance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Clock-out failed' });
  }
};

function minutesToHoursMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// ✅ Get attendance records by date
exports.getAttendanceByDate = async (req, res) => {
  try {
    const date = req.query.date
      ? DateTime.fromISO(req.query.date).setZone('Europe/London')
      : getUKTime();

    const start = date.startOf('day').toJSDate();
    const end = date.endOf('day').toJSDate();

    const records = await Attendance.findAll({
      where: {
        clock_in: { [Op.between]: [start, end] },
      },
    });

    res.status(200).json(records);
  } catch (err) {
    console.error('Fetch attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
};

// ✅ Get today's status for all employees
exports.getStatus = async (req, res) => {
  try {
    const date = req.query.date
      ? DateTime.fromISO(req.query.date).setZone('Europe/London')
      : getUKTime();

    const start = date.startOf('day').toJSDate();
    const end = date.endOf('day').toJSDate();

    const employees = await Employee.findAll();

    const todayRecords = await Attendance.findAll({
      where: {
        clock_in: { [Op.between]: [start, end] },
      },
      order: [['clock_in', 'DESC']],
    });

    const openRecords = await Attendance.findAll({
      where: {
        clock_in: { [Op.lt]: start },
        clock_out: null,
      },
      order: [['clock_in', 'DESC']],
    });

    const combined = [...todayRecords, ...openRecords];

    const latestStatus = {};
    combined.forEach((record) => {
      if (!latestStatus[record.employee_id]) {
        latestStatus[record.employee_id] = record.clock_out ? 'Clocked Out' : 'Clocked In';
      }
    });

    const result = employees.map((emp) => ({
      id: emp.id,
      name: `${emp.first_name} ${emp.last_name}`,
      status: latestStatus[emp.id] || 'Not Clocked In',
    }));

    res.status(200).json(result);
  } catch (err) {
    console.error('Get status error:', err);
    res.status(500).json({ error: 'Failed to fetch employee status' });
  }
};

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
    const { pin, employeeId } = req.body;

    const employee = await Employee.findOne({ where: { id: employeeId } });
    if (!employee) {
      return res.status(404).json({ error: 'Invalid employee' });
    }

    console.log("Entered PIN:", pin);
    console.log("Stored PIN (hashed):", employee.pin);

    const isMatch = bcrypt.compareSync(pin, employee.pin);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }
    

    const now = DateTime.now().setZone('Europe/London');
    const today = now.toFormat('yyyy-LL-dd');

    const attendance = await Attendance.findOne({
      where: {
        employee_id: employee.id,
        clock_in_uk: { [Op.like]: `${today}%` }
      }
    });

    if (attendance) {
      return res.status(400).json({ error: 'Already clocked in today' });
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

// ✅ Clock Out
exports.clockOut = async (req, res) => {
  try {
    const { pin, employeeId } = req.body;

    const employee = await Employee.findOne({ where: { id: employeeId } });
    if (!employee) {
      return res.status(404).json({ error: 'Invalid employee' });
    }

    console.log("Entered PIN:", pin);
console.log("Stored PIN (hashed):", employee.pin);


    const isMatch = bcrypt.compareSync(pin, employee.pin);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }
    

    const now = DateTime.now().setZone('Europe/London');

    const attendance = await Attendance.findOne({
      where: {
        employee_id: employee.id,
        clock_out: null
      },
      order: [['clock_in', 'DESC']]
    });

    if (!attendance) {
      return res.status(404).json({ error: 'No clock-in found or already clocked out' });
    }

    const clockInTime = DateTime.fromISO(attendance.clock_in);
    const durationMinutes = now.diff(clockInTime, 'minutes').minutes;

    attendance.clock_out = now.toUTC().toISO();
    attendance.clock_out_uk = now.toFormat('dd/MM/yyyy HH:mm');
    attendance.total_work_hours = minutesToHoursMinutes(durationMinutes);

    await attendance.save();

    return res.json({ message: 'Clock-out recorded', attendance });
  } catch (err) {
    console.error('Clock-Out Error:', err);
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
    const today = DateTime.now().setZone('Europe/London').toFormat('yyyy-LL-dd');

    const records = await Attendance.findAll();

    const latestStatusMap = {};
    records.forEach(record => {
      latestStatusMap[record.employee_id] = record.clock_out ? 'Clocked Out' : 'Clocked In';
    });

    const result = Object.entries(latestStatusMap).map(([id, status]) => ({
      id: parseInt(id),
      status
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
};

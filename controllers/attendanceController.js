const { DateTime } = require('luxon');
const { Op } = require('sequelize');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');

// Utilities
const getUKTime = () => DateTime.now().setZone('Europe/London');
const formatBST = (dt) => dt.toFormat('dd/MM/yyyy HH:mm'); // UK string for display
const formatDuration = (minutes) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

// ✅ Clock In
exports.clockIn = async (req, res) => {
  try {
    const { employee_id, custom_time } = req.body;

    const dt = custom_time
      ? DateTime.fromISO(custom_time).setZone('Europe/London')
      : getUKTime();

    const attendance = await Attendance.create({
      employee_id,
      clock_in: dt.toJSDate(),           // ✅ stored as ISO Date
      clock_in_uk: formatBST(dt),        // ✅ stored as UK display string
    });

    res.status(200).json(attendance);
  } catch (err) {
    console.error('Clock In Error:', err);
    res.status(500).json({ error: 'Clock in failed' });
  }
};

// ✅ Clock Out
exports.clockOut = async (req, res) => {
  try {
    const { employee_id, custom_time } = req.body;

    const attendance = await Attendance.findOne({
      where: {
        employee_id,
        clock_out: null,
      },
      order: [['clock_in', 'DESC']],
    });

    if (!attendance || !attendance.clock_in) {
      return res.status(404).json({ error: 'Record not found or not clocked in yet' });
    }

    const clockInTime = DateTime.fromJSDate(attendance.clock_in).setZone('Europe/London');

    let clockOutTime = custom_time
      ? DateTime.fromISO(custom_time).setZone('Europe/London')
      : getUKTime();

    // Handle overnight shift
    if (clockOutTime < clockInTime) {
      clockOutTime = clockOutTime.plus({ days: 1 });
    }

    const totalMinutes = Math.floor(clockOutTime.diff(clockInTime, 'minutes').minutes);

    attendance.clock_out = clockOutTime.toJSDate();         // ✅ UTC-stored
    attendance.clock_out_uk = formatBST(clockOutTime);      // ✅ UK string
    attendance.total_work_hours = formatDuration(totalMinutes);

    await attendance.save();
    res.status(200).json(attendance);
  } catch (err) {
    console.error('Clock Out Error:', err);
    res.status(500).json({ error: 'Clock out failed' });
  }
};

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
    const attendance = await Attendance.findAll({
      where: {
        clock_in: { [Op.between]: [start, end] },
      },
    });

    const statusMap = {};
    attendance.forEach((a) => {
      statusMap[a.employee_id] = true;
    });

    const result = employees.map((emp) => ({
      id: emp.id,
      name: `${emp.first_name} ${emp.last_name}`,
      status: statusMap[emp.id] ? 'Clocked In' : 'Not Clocked In',
    }));

    res.status(200).json(result);
  } catch (err) {
    console.error('Get status error:', err);
    res.status(500).json({ error: 'Failed to fetch employee status' });
  }
};

const { DateTime } = require("luxon");
const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");

const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");

/* ----------------------------- helpers ----------------------------- */

const ukNow = () => DateTime.now().setZone("Europe/London");

const toHHMM = (mins) => {
  const m = Math.max(0, Math.round(Number(mins) || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${String(h).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
};

const parseUTC = (val) => {
  if (!val) return null;
  if (val instanceof Date) return DateTime.fromJSDate(val, { zone: "utc" });
  if (typeof val === "string") return DateTime.fromISO(val, { zone: "utc" });
  return null;
};

/* -------- reusable work calculation (used everywhere) -------- */
const calculateWork = (clockInISO, clockOutISO) => {
  if (!clockInISO || !clockOutISO) {
    return { break_minutes: 0, total_work_hours: null };
  }

  const ci = new Date(clockInISO);
  const co = new Date(clockOutISO);

  const diffMinutes = Math.floor((co - ci) / 60000);

  if (diffMinutes <= 0) {
    return { break_minutes: 0, total_work_hours: "00:00" };
  }

  const breakMinutes = diffMinutes >= 360 ? 30 : 0;

  const netMinutes = diffMinutes - breakMinutes;

  const hours = Math.floor(netMinutes / 60);
  const mins = netMinutes % 60;

  return {
    break_minutes: breakMinutes,
    total_work_hours: `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`,
  };
};

/* ------------------------------ clock in --------------------------- */

exports.clockIn = async (req, res) => {
  try {
    let { employeeId, pin } = req.body;

    if (!employeeId || !pin) {
      return res.status(400).json({
        error: "employeeId and pin are required",
      });
    }

    pin = String(pin);

    const employee = await Employee.findOne({
      where: { id: employeeId },
    });

    if (!employee) {
      return res.status(404).json({
        error: "Employee not found",
      });
    }

    const validPin = bcrypt.compareSync(pin, employee.pin);

    if (!validPin) {
      return res.status(401).json({
        error: "Invalid PIN",
      });
    }

    const openSession = await Attendance.findOne({
      where: {
        employee_id: employee.id,
        clock_out: { [Op.is]: null },
      },
    });

    if (openSession) {
      return res.status(400).json({
        error: "Employee already clocked in",
      });
    }

    const nowUTC = DateTime.utc();
    const nowUK = ukNow();

    const attendance = await Attendance.create({
      employee_id: employee.id,
      clock_in: nowUTC.toISO(),
      clock_in_uk: nowUK.toFormat("dd/MM/yyyy HH:mm"),
      clock_out: null,
      clock_out_uk: null,
      break_minutes: 0,
      total_work_hours: null,
    });

    res.json({
      message: "Clock-in recorded",
      attendance,
    });
  } catch (err) {
    console.error("Clock-in error:", err);

    res.status(500).json({
      error: "Failed to clock in",
    });
  }
};

/* ------------------------------ clock out -------------------------- */

exports.clockOut = async (req, res) => {
  try {
    let { employeeId, pin } = req.body;

    if (!employeeId || !pin) {
      return res.status(400).json({
        error: "employeeId and pin are required",
      });
    }

    pin = String(pin);

    const employee = await Employee.findOne({
      where: { id: employeeId },
    });

    if (!employee) {
      return res.status(404).json({
        error: "Employee not found",
      });
    }

    const validPin = bcrypt.compareSync(pin, employee.pin);

    if (!validPin) {
      return res.status(401).json({
        error: "Invalid PIN",
      });
    }

    const attendance = await Attendance.findOne({
      where: {
        employee_id: employee.id,
        clock_out: { [Op.is]: null },
      },
      order: [["clock_in", "DESC"]],
    });

    if (!attendance) {
      return res.status(400).json({
        error: "No open session to clock out",
      });
    }

    const nowUTC = DateTime.utc();
    const nowUK = ukNow();

    const result = calculateWork(attendance.clock_in, nowUTC.toISO());

    attendance.clock_out = nowUTC.toISO();
    attendance.clock_out_uk = nowUK.toFormat("dd/MM/yyyy HH:mm");
    attendance.break_minutes = result.break_minutes;
    attendance.total_work_hours = result.total_work_hours;

    await attendance.save();

    res.json({
      message: "Clock-out recorded",
      attendance,
    });
  } catch (err) {
    console.error("Clock-out error:", err);

    res.status(500).json({
      error: "Failed to clock out",
    });
  }
};

/* --------------------------- fetch by date ------------------------- */

exports.getAttendanceByDate = async (req, res) => {
  try {
    const qDate = req.query.date
      ? DateTime.fromISO(req.query.date).setZone("Europe/London")
      : ukNow();

    const startUTC = qDate.startOf("day").toUTC().toJSDate();
    const endUTC = qDate.endOf("day").toUTC().toJSDate();

    const rows = await Attendance.findAll({
      where: {
        [Op.or]: [
          { clock_in: { [Op.between]: [startUTC, endUTC] } },
          { clock_out: { [Op.between]: [startUTC, endUTC] } },
        ],
      },
      order: [["clock_in", "ASC"]],
    });

    let dailyMinutes = 0;

    const items = rows.map((r) => {
      const result = calculateWork(r.clock_in, r.clock_out);

      const mins = result.total_work_hours
        ? result.break_minutes + 0 // placeholder safe calc
        : 0;

      return {
        ...r.toJSON(),
        computed_work_hhmm: result.total_work_hours,
      };
    });

    res.json({
      date: qDate.toFormat("dd/MM/yyyy"),
      items,
    });
  } catch (err) {
    console.error("Fetch attendance error:", err);

    res.status(500).json({
      error: "Failed to fetch attendance",
    });
  }
};

/* ------------------------------ status ----------------------------- */

exports.getStatus = async (req, res) => {
  try {
    const employees = await Employee.findAll({
      attributes: ["id"],
    });

    const openSessions = await Attendance.findAll({
      attributes: ["employee_id"],
      where: {
        clock_out: { [Op.is]: null },
      },
    });

    const openMap = new Set(openSessions.map((s) => s.employee_id));

    const result = employees.map((emp) => ({
      id: emp.id,
      status: openMap.has(emp.id) ? "Clocked In" : "Clocked Out",
    }));

    res.json(result);
  } catch (err) {
    console.error("Attendance Status Error:", err);

    res.status(500).json({
      error: "Failed to fetch status",
    });
  }
};

/* --------------------------- manual entry -------------------------- */

exports.manualEntry = async (req, res) => {
  try {
    const { employeeId, clock_in, clock_out } = req.body;

    if (!clock_in) {
      return res.status(400).json({
        error: "clock_in is required",
      });
    }

    const ci = DateTime.fromISO(clock_in, { zone: "utc" });
    const co = clock_out ? DateTime.fromISO(clock_out, { zone: "utc" }) : null;

    if (!ci.isValid) {
      return res.status(400).json({
        error: "Invalid clock_in format",
      });
    }

    const result = calculateWork(ci.toISO(), co ? co.toISO() : null);

    const record = await Attendance.create({
      employee_id: employeeId,
      clock_in: ci.toISO(),
      clock_out: co ? co.toISO() : null,
      clock_in_uk: ci.setZone("Europe/London").toFormat("dd/MM/yyyy HH:mm"),
      clock_out_uk: co
        ? co.setZone("Europe/London").toFormat("dd/MM/yyyy HH:mm")
        : null,
      break_minutes: result.break_minutes,
      total_work_hours: result.total_work_hours,
    });

    res.json({
      message: "Manual attendance recorded",
      record,
    });
  } catch (err) {
    console.error("Manual entry error:", err);

    res.status(500).json({
      error: "Manual attendance failed",
    });
  }
};

/* --------------------------- update entry -------------------------- */

exports.updateAttendance = async (req, res) => {
  try {
    const { attendanceId, clock_in, clock_out } = req.body;

    if (!attendanceId) {
      return res.status(400).json({
        error: "attendanceId is required",
      });
    }

    const record = await Attendance.findByPk(attendanceId);

    if (!record) {
      return res.status(404).json({
        error: "Attendance record not found",
      });
    }

    if (clock_in) {
      const ci = DateTime.fromISO(clock_in, { zone: "utc" });

      if (!ci.isValid) {
        return res.status(400).json({
          error: "Invalid clock_in format",
        });
      }

      record.clock_in = ci.toISO();
      record.clock_in_uk = ci
        .setZone("Europe/London")
        .toFormat("dd/MM/yyyy HH:mm");
    }

    if (clock_out) {
      const co = DateTime.fromISO(clock_out, { zone: "utc" });

      if (!co.isValid) {
        return res.status(400).json({
          error: "Invalid clock_out format",
        });
      }

      record.clock_out = co.toISO();
      record.clock_out_uk = co
        .setZone("Europe/London")
        .toFormat("dd/MM/yyyy HH:mm");
    }

    if (new Date(record.clock_out) < new Date(record.clock_in)) {
      return res.status(400).json({
        error: "clock_out cannot be earlier than clock_in",
      });
    }

    const result = calculateWork(record.clock_in, record.clock_out);

    record.break_minutes = result.break_minutes;
    record.total_work_hours = result.total_work_hours;

    await record.save();

    res.json({
      message: "Attendance updated",
      record,
    });
  } catch (err) {
    console.error("Update attendance error:", err);

    res.status(500).json({
      error: "Failed to update attendance",
    });
  }
};

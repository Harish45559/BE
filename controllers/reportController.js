const { Attendance, Employee } = require("../models");
const { Op } = require("sequelize");
const { Parser } = require("json2csv");
const PdfPrinter = require("pdfmake");
const { DateTime } = require("luxon");

// UK time converter
const toUK = (date) => {
  if (!date) return null;
  return DateTime.fromJSDate(new Date(date)).setZone("Europe/London");
};

const minutesToHHMM = (minutes) => {
  if (!minutes || isNaN(minutes)) return "00:00";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const diffMinutes = (clockIn, clockOut) => {
  if (!clockIn || !clockOut) return 0;
  const inT = toUK(clockIn);
  const outT = toUK(clockOut);
  let mins = outT.diff(inT, "minutes").minutes;
  if (mins < 0) mins += 1440; // overnight safety
  return Math.round(mins);
};

// ✅ Reports
exports.getReports = async (req, res) => {
  try {
    const { employee_id, from, to } = req.query;
    const where = {};

    if (employee_id && employee_id !== "all") where.employee_id = employee_id;
    if (from || to) {
      where.clock_in = {};
      if (from) where.clock_in[Op.gte] = new Date(from);
      if (to) where.clock_in[Op.lte] = new Date(to);
    }

    const records = await Attendance.findAll({
      where,
      include: [
        {
          model: Employee,
          as: "employee",
          attributes: ["id", "first_name", "last_name"],
          required: false,
        },
      ],
      order: [["clock_in", "ASC"]],
    });

    const result = records
      .map((rec, index) => {
        if (!rec.clock_in || !rec.employee) return null;

        const clockInUK = toUK(rec.clock_in);
        const clockOutUK = rec.clock_out ? toUK(rec.clock_out) : null;
        const minutes = diffMinutes(rec.clock_in, rec.clock_out);

        return {
          id: rec.id || index + 1,
          employee: rec.employee,
          date: clockInUK.toFormat("dd-MM-yyyy"),
          clock_in_uk: clockInUK.toFormat("HH:mm"),
          clock_out_uk: clockOutUK ? clockOutUK.toFormat("HH:mm") : "—",
          total_work_hhmm: minutesToHHMM(minutes), // ✅ HH:MM
          total_work_minutes: minutes, // numeric (unchanged usage)
        };
      })
      .filter(Boolean);

    res.json(result);
  } catch (err) {
    console.error("❌ Fetch Reports Error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Daily Summary
exports.getDailySummary = async (req, res) => {
  try {
    const { employee_id, from, to } = req.query;
    const where = {};

    if (employee_id && employee_id !== "all") where.employee_id = employee_id;
    if (from || to) {
      where.clock_in = {};
      if (from) {
        const ukStart = DateTime.fromISO(from)
          .setZone("Europe/London")
          .startOf("day")
          .toUTC()
          .toJSDate();
        where.clock_in[Op.gte] = ukStart;
      }
      if (to) {
        const ukEnd = DateTime.fromISO(to)
          .setZone("Europe/London")
          .endOf("day")
          .toUTC()
          .toJSDate();
        where.clock_in[Op.lte] = ukEnd;
      }
    }

    const records = await Attendance.findAll({
      where,
      include: [
        {
          model: Employee,
          as: "employee",
          attributes: ["id", "first_name", "last_name"],
          required: false,
        },
      ],
      order: [["clock_in", "ASC"]],
    });

    const grouped = {};

    records.forEach((rec) => {
      if (!rec.clock_out || !rec.clock_in || !rec.employee) return;

      const dateKey = toUK(rec.clock_in).toFormat("yyyy-MM-dd");
      const empId = rec.employee_id;
      const key = `${empId}_${toUK(rec.clock_in).toFormat("dd-MM-yyyy")}`;

      if (!grouped[key]) {
        grouped[key] = {
          employee: rec.employee,
          date: toUK(rec.clock_in).toFormat("dd-MM-yyyy"),
          firstIn: toUK(rec.clock_in),
          lastOut: toUK(rec.clock_out),
          totalMinutes: 0,
          sessions: [],
        };
      } else {
        if (toUK(rec.clock_in) < grouped[key].firstIn)
          grouped[key].firstIn = toUK(rec.clock_in);
        if (toUK(rec.clock_out) > grouped[key].lastOut)
          grouped[key].lastOut = toUK(rec.clock_out);
      }

      const duration = toUK(rec.clock_out).diff(
        toUK(rec.clock_in),
        "minutes"
      ).minutes;
      grouped[key].totalMinutes += duration;

      grouped[key].sessions.push({
        clock_in: toUK(rec.clock_in).toFormat("HH:mm"),
        clock_out: toUK(rec.clock_out).toFormat("HH:mm"),
        duration: minutesToHoursMinutes(duration),
      });
    });

    const result = Object.values(grouped).map((entry, index) => {
      const spanMinutes = entry.lastOut.diff(entry.firstIn, "minutes").minutes;
      const breakMinutes = Math.max(spanMinutes - entry.totalMinutes, 0);

      return {
        id: index + 1,
        employee: entry.employee,
        date: entry.date,
        first_clock_in: entry.firstIn.toFormat("HH:mm"),
        last_clock_out: entry.lastOut.toFormat("HH:mm"),
        total_work_hours: minutesToHoursMinutes(entry.totalMinutes),
        break_time: minutesToHoursMinutes(breakMinutes),
        sessions: entry.sessions,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Summary fetch error:", err.message);
    res.status(500).json({ error: "Summary failed" });
  }
};

// ✅ Get Detailed Sessions
exports.getDetailedSessions = async (req, res) => {
  try {
    const { employee_id, date } = req.query;

    if (!employee_id || !date) {
      return res
        .status(400)
        .json({ error: "employee_id and date are required" });
    }

    const startDate = DateTime.fromISO(date)
      .setZone("Europe/London")
      .startOf("day")
      .toUTC()
      .toJSDate();
    const endDate = DateTime.fromISO(date)
      .setZone("Europe/London")
      .endOf("day")
      .toUTC()
      .toJSDate();

    const records = await Attendance.findAll({
      where: {
        employee_id,
        clock_in: { [Op.gte]: startDate, [Op.lte]: endDate },
      },
      include: [
        {
          model: Employee,
          as: "employee",
          attributes: ["id", "first_name", "last_name"],
        },
      ],
      order: [["clock_in", "ASC"]],
    });

    const completedSessions = records.filter((rec) => rec.clock_out);

    const sessions = completedSessions.map((rec) => {
      const clockInUK = toUK(rec.clock_in);
      const clockOutUK = toUK(rec.clock_out);
      const duration = clockOutUK.diff(clockInUK, "minutes").minutes;

      return {
        type: "work",
        clock_in: clockInUK.toFormat("HH:mm"),
        clock_out: clockOutUK.toFormat("HH:mm"),
        duration: minutesToHoursMinutes(duration),
        clock_in_full: clockInUK,
        clock_out_full: clockOutUK,
      };
    });

    const sessionsWithBreaks = [];

    for (let i = 0; i < sessions.length; i++) {
      sessionsWithBreaks.push({
        type: "work",
        clock_in: sessions[i].clock_in,
        clock_out: sessions[i].clock_out,
        duration: sessions[i].duration,
      });

      if (i < sessions.length - 1) {
        const breakMinutes = sessions[i + 1].clock_in_full.diff(
          sessions[i].clock_out_full,
          "minutes"
        ).minutes;
        if (breakMinutes > 0) {
          sessionsWithBreaks.push({
            type: "break",
            duration: minutesToHoursMinutes(breakMinutes),
            break_time: `${sessions[i].clock_out} - ${
              sessions[i + 1].clock_in
            }`,
          });
        }
      }
    }

    res.json({ sessions: sessionsWithBreaks, total_sessions: sessions.length });
  } catch (err) {
    console.error("Detailed Sessions Error:", err);
    res.status(500).json({ error: "Failed to fetch detailed sessions" });
  }
};

// ✅ DELETE Attendance
exports.deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findByPk(req.params.id);
    if (!attendance) return res.status(404).json({ error: "Not found" });
    await attendance.destroy();
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
};

// ✅ Export CSV
exports.exportCSV = async (req, res) => {
  try {
    const { employee_id, from, to } = req.query;
    const where = {};

    if (employee_id && employee_id !== "all") where.employee_id = employee_id;
    if (from || to) {
      where.clock_in = {};
      if (from) where.clock_in[Op.gte] = new Date(from);
      if (to) where.clock_in[Op.lte] = new Date(to);
    }

    const reports = await Attendance.findAll({
      where,
      include: [
        {
          model: Employee,
          as: "employee",
          attributes: ["first_name", "last_name"],
        },
      ],
      order: [["clock_in", "ASC"]],
    });

    let grandTotalMinutes = 0;

    const rows = reports.map((r) => {
      const mins = diffMinutes(r.clock_in, r.clock_out);
      grandTotalMinutes += mins;

      return {
        Employee: r.employee
          ? `${r.employee.first_name} ${r.employee.last_name}`
          : "",
        "Clock In": r.clock_in
          ? toUK(r.clock_in).toFormat("dd/MM/yyyy HH:mm")
          : "",
        "Clock Out": r.clock_out
          ? toUK(r.clock_out).toFormat("dd/MM/yyyy HH:mm")
          : "",
        "Total Hours": minutesToHHMM(mins),
      };
    });

    // ✅ TOTAL ROW
    rows.push({
      Employee: "",
      "Clock In": "",
      "Clock Out": "TOTAL",
      "Total Hours": minutesToHHMM(grandTotalMinutes),
    });

    const parser = new Parser({ withBOM: true });
    const csv = parser.parse(rows);

    res.header("Content-Type", "text/csv; charset=utf-8");
    res.attachment("attendance_report.csv");
    res.send(csv);
  } catch (err) {
    console.error("CSV Export Error:", err);
    res.status(500).json({ error: "Failed to generate CSV" });
  }
};

// ✅ Export PDF
const path = require("path");
const fs = require("fs");
// ... keep your other requires (PdfPrinter, Attendance, Employee, Op, toUK, computeTotalHours, etc.)

exports.exportPDF = async (req, res) => {
  try {
    const { employee_id, from, to } = req.query;
    const where = {};

    if (employee_id && employee_id !== "all") where.employee_id = employee_id;
    if (from || to) {
      where.clock_in = {};
      if (from) where.clock_in[Op.gte] = new Date(from);
      if (to) where.clock_in[Op.lte] = new Date(to);
    }

    const reports = await Attendance.findAll({
      where,
      include: [
        {
          model: Employee,
          as: "employee",
          attributes: ["first_name", "last_name"],
        },
      ],
      order: [["clock_in", "ASC"]],
    });

    const robotoNormal = path.resolve(
      process.cwd(),
      "node_modules/pdfmake/fonts/Roboto-Regular.ttf"
    );
    const robotoBold = path.resolve(
      process.cwd(),
      "node_modules/pdfmake/fonts/Roboto-Medium.ttf"
    );

    const fonts = { Roboto: { normal: robotoNormal, bold: robotoBold } };
    const printer = new PdfPrinter(fonts);

    let grandTotalMinutes = 0;

    const tableBody = [
      ["Employee", "Clock In", "Clock Out", "Total Hours"],
      ...reports.map((r) => {
        const mins = diffMinutes(r.clock_in, r.clock_out);
        grandTotalMinutes += mins;
        return [
          r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : "",
          r.clock_in ? toUK(r.clock_in).toFormat("dd/MM/yyyy HH:mm") : "",
          r.clock_out ? toUK(r.clock_out).toFormat("dd/MM/yyyy HH:mm") : "",
          minutesToHHMM(mins),
        ];
      }),
      ["", "", "TOTAL", minutesToHHMM(grandTotalMinutes)],
    ];

    const docDefinition = {
      content: [
        { text: "Attendance Report", style: "header" },
        {
          table: {
            headerRows: 1,
            widths: ["*", "*", "*", "*"],
            body: tableBody,
          },
        },
      ],
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          alignment: "center",
          margin: [0, 0, 0, 15],
        },
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=attendance_report.pdf"
    );

    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error("PDF Export Error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
};

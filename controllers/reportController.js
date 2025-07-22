const { Attendance, Employee } = require('../models');
const { Op } = require('sequelize');
const { Parser } = require('json2csv');
const PdfPrinter = require('pdfmake');
const { DateTime } = require('luxon');

// UK time conversion
const toUK = (date) => {
  if (!date) return null;
  return DateTime.fromJSDate(new Date(date)).setZone('Europe/London');
};

const computeTotalHours = (clockIn, clockOut) => {
  if (!clockIn || !clockOut) return '';
  const inTime = toUK(clockIn);
  const outTime = toUK(clockOut);
  const diff = outTime.diff(inTime, ['hours', 'minutes']).toObject();
  const hours = Math.floor(diff.hours);
  const minutes = Math.floor(diff.minutes);
  return `${hours}h ${minutes}m`;
};

function minutesToHoursMinutes(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

exports.getReports = async (req, res) => {
  try {
    const { employee_id, from, to } = req.query;
    const where = {};
    if (employee_id && employee_id !== 'all') where.employee_id = employee_id;
    if (from || to) {
      where.clock_in = {};
      if (from) where.clock_in[Op.gte] = new Date(from);
      if (to) where.clock_in[Op.lte] = new Date(to);
    }

    const records = await Attendance.findAll({
      where,
      include: [{ model: Employee, as: 'employee', attributes: ['id', 'first_name', 'last_name'] }],
      order: [['clock_in', 'ASC']],
    });

    const result = records.map((rec, index) => {
      const clockInUK = toUK(rec.clock_in);
      const clockOutUK = rec.clock_out ? toUK(rec.clock_out) : null;

      return {
        id: rec.id || index + 1,
        employee: rec.employee,
        date: clockInUK.toFormat('dd-MM-yyyy'),
        clock_in_uk: clockInUK.toFormat('HH:mm'),
        clock_out_uk: clockOutUK ? clockOutUK.toFormat('HH:mm') : '—',
        total_work_hours: clockOutUK
          ? minutesToHoursMinutes(clockOutUK.diff(clockInUK, 'minutes').minutes)
          : '—',
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Fetch Reports Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ✅ DAILY SUMMARY REPORT
exports.getDailySummary = async (req, res) => {
  try {
    const { employee_id, from, to } = req.query;
    const where = {};
    if (employee_id && employee_id !== 'all') where.employee_id = employee_id;
    if (from || to) {
      where.clock_in = {};

      if (from) {
        const ukStart = DateTime.fromISO(from).setZone('Europe/London').startOf('day').toUTC().toJSDate();
        where.clock_in[Op.gte] = ukStart;
      }

      if (to) {
        const ukEnd = DateTime.fromISO(to).setZone('Europe/London').endOf('day').toUTC().toJSDate();
        where.clock_in[Op.lte] = ukEnd;
      }
    }

    const records = await Attendance.findAll({
      where,
      include: [{ model: Employee, as: 'employee', attributes: ['id', 'first_name', 'last_name'] }],
      order: [['clock_in', 'ASC']],
    });

    console.log('Total matching records:', records.length);

    const grouped = {};

    records.forEach((rec) => {
      if (!rec.clock_out) return;

      const dateKey = toUK(rec.clock_in).toFormat('yyyy-MM-dd');
      const empId = rec.employee_id;
      const key = `${empId}_${dateKey}`;

      if (!grouped[key]) {
        grouped[key] = {
          employee: rec.employee,
          date: toUK(rec.clock_in).toFormat('dd-MM-yyyy'),
          firstIn: toUK(rec.clock_in),
          lastOut: toUK(rec.clock_out),
          totalMinutes: 0,
          sessions: [], // Add sessions array to track individual clock-in/out pairs
        };
      } else {
        if (toUK(rec.clock_in) < grouped[key].firstIn) {
          grouped[key].firstIn = toUK(rec.clock_in);
        }
        if (toUK(rec.clock_out) > grouped[key].lastOut) {
          grouped[key].lastOut = toUK(rec.clock_out);
        }
      }

      const duration = toUK(rec.clock_out).diff(toUK(rec.clock_in), 'minutes').minutes;
      grouped[key].totalMinutes += duration;
      
      // Add session details
      grouped[key].sessions.push({
        clock_in: toUK(rec.clock_in).toFormat('HH:mm'),
        clock_out: toUK(rec.clock_out).toFormat('HH:mm'),
        duration: minutesToHoursMinutes(duration)
      });
    });

    const result = Object.values(grouped).map((entry, index) => {
      const spanMinutes = entry.lastOut.diff(entry.firstIn, 'minutes').minutes;
      const breakMinutes = Math.max(spanMinutes - entry.totalMinutes, 0);

      return {
        id: index + 1,
        employee: entry.employee,
        date: entry.date,
        first_clock_in: entry.firstIn.toFormat('HH:mm'),
        last_clock_out: entry.lastOut.toFormat('HH:mm'),
        total_work_hours: minutesToHoursMinutes(entry.totalMinutes),
        break_time: minutesToHoursMinutes(breakMinutes),
        sessions: entry.sessions, // Include sessions in response
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Fetch Summary Error:', err);
    res.status(500).json({ error: 'Summary failed' });
  }
};

// ✅ NEW ENDPOINT: Get detailed sessions for tooltip// ✅ FIXED: Get detailed sessions for tooltip
exports.getDetailedSessions = async (req, res) => {
  try {
    const { employee_id, date } = req.query;
    
    if (!employee_id || !date) {
      return res.status(400).json({ error: 'employee_id and date are required' });
    }

    // Convert date from YYYY-MM-DD to proper date range
    const startDate = DateTime.fromISO(date).setZone('Europe/London').startOf('day').toUTC().toJSDate();
    const endDate = DateTime.fromISO(date).setZone('Europe/London').endOf('day').toUTC().toJSDate();

    const records = await Attendance.findAll({
      where: {
        employee_id: employee_id,
        clock_in: {
          [Op.gte]: startDate,
          [Op.lte]: endDate
        }
      },
      include: [{ model: Employee, as: 'employee', attributes: ['id', 'first_name', 'last_name'] }],
      order: [['clock_in', 'ASC']],
    });

    // If no records, return empty
    if (!records || records.length === 0) {
      return res.json({ sessions: [], total_sessions: 0 });
    }

    // Only include completed sessions (both clock_in and clock_out)
    const completedSessions = records.filter(rec => rec.clock_out);
    
    if (completedSessions.length === 0) {
      return res.json({ sessions: [], total_sessions: 0 });
    }

    // Create session objects with proper time conversion
    const sessions = completedSessions.map(rec => {
      const clockInUK = toUK(rec.clock_in);
      const clockOutUK = toUK(rec.clock_out);
      const duration = clockOutUK.diff(clockInUK, 'minutes').minutes;
      
      return {
        type: 'work',
        clock_in: clockInUK.toFormat('HH:mm'),
        clock_out: clockOutUK.toFormat('HH:mm'),
        duration: minutesToHoursMinutes(duration),
        clock_in_full: clockInUK, // Keep full DateTime for break calculation
        clock_out_full: clockOutUK
      };
    });

    // Calculate breaks between sessions
    const sessionsWithBreaks = [];
    
    for (let i = 0; i < sessions.length; i++) {
      // Add the work session
      sessionsWithBreaks.push({
        type: 'work',
        clock_in: sessions[i].clock_in,
        clock_out: sessions[i].clock_out,
        duration: sessions[i].duration
      });
      
      // Calculate break time to next session (if exists)
      if (i < sessions.length - 1) {
        const currentEnd = sessions[i].clock_out_full;
        const nextStart = sessions[i + 1].clock_in_full;
        
        const breakMinutes = nextStart.diff(currentEnd, 'minutes').minutes;
        
        // Only add break if it's positive (shouldn't be negative, but safety check)
        if (breakMinutes > 0) {
          sessionsWithBreaks.push({
            type: 'break',
            duration: minutesToHoursMinutes(breakMinutes),
            break_time: `${sessions[i].clock_out} - ${sessions[i + 1].clock_in}`
          });
        }
      }
    }

    res.json({
      sessions: sessionsWithBreaks,
      total_sessions: sessions.length
    });
  } catch (err) {
    console.error('Detailed Sessions Error:', err);
    res.status(500).json({ error: 'Failed to fetch detailed sessions' });
  }
};

exports.deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findByPk(req.params.id);
    if (!attendance) return res.status(404).json({ error: 'Not found' });
    await attendance.destroy();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Delete failed' });
  }
};

exports.exportCSV = async (req, res) => {
  try {
    const { employee_id, from, to } = req.query;
    const where = {};
    if (employee_id && employee_id !== 'all') where.employee_id = employee_id;
    if (from || to) {
      where.clock_in = {};
      if (from) where.clock_in[Op.gte] = new Date(from);
      if (to) where.clock_in[Op.lte] = new Date(to);
    }

    const reports = await Attendance.findAll({
      where,
      include: [{
        model: Employee,
        as: 'employee',
        attributes: ['first_name', 'last_name']
      }],
      order: [['clock_in', 'DESC']]
    });

    const data = reports.map((r) => ({
      Employee: r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : '',
      'Clock In': toUK(r.clock_in)?.toFormat('dd/MM/yyyy HH:mm') || '',
      'Clock Out': r.clock_out ? toUK(r.clock_out)?.toFormat('dd/MM/yyyy HH:mm') : '',
      'Total Hours': computeTotalHours(r.clock_in, r.clock_out),
    }));

    const fields = ['Employee', 'Clock In', 'Clock Out', 'Total Hours'];
    const parser = new Parser({ fields, withBOM: true });
    const csv = parser.parse(data);

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('attendance_report.csv');
    res.send(csv);
  } catch (err) {
    console.error('CSV Export Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate CSV' });
    }
  }
};

// ✅ PDF EXPORT (Styled Table)
exports.exportPDF = async (req, res) => {
  try {
    const { employee_id, from, to } = req.query;
    const where = {};
    if (employee_id && employee_id !== 'all') where.employee_id = employee_id;
    if (from || to) {
      where.clock_in = {};
      if (from) where.clock_in[Op.gte] = new Date(from);
      if (to) where.clock_in[Op.lte] = new Date(to);
    }

    const reports = await Attendance.findAll({
      where,
      include: [{
        model: Employee,
        as: 'employee',
        attributes: ['first_name', 'last_name']
      }],
      order: [['clock_in', 'DESC']]
    });

    const fonts = {
      Roboto: {
        normal: 'node_modules/pdfmake/fonts/Roboto-Regular.ttf',
        bold: 'node_modules/pdfmake/fonts/Roboto-Medium.ttf',
      }
    };
    const printer = new PdfPrinter(fonts);

    const tableBody = [
      [
        { text: 'Employee', style: 'tableHeader' },
        { text: 'Clock In', style: 'tableHeader' },
        { text: 'Clock Out', style: 'tableHeader' },
        { text: 'Total Hours', style: 'tableHeader' }
      ],
      ...reports.map((r) => [
        r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : '',
        toUK(r.clock_in)?.toFormat('dd/MM/yyyy HH:mm') || '',
        r.clock_out ? toUK(r.clock_out)?.toFormat('dd/MM/yyyy HH:mm') : '',
        computeTotalHours(r.clock_in, r.clock_out)
      ])
    ];

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      content: [
        { text: 'Attendance Report', style: 'header' },
        {
          style: 'tableStyle',
          table: {
            headerRows: 1,
            widths: ['*', '*', '*', '*'],
            body: tableBody
          },
          layout: {
            fillColor: (i) => (i === 0 ? '#f3f4f6' : null),
            hLineColor: () => '#d1d5db',
            vLineColor: () => '#d1d5db',
            hLineWidth: () => 0.6,
            vLineWidth: () => 0.6,
          }
        }
      ],
      styles: {
        header: {
          fontSize: 20,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 20]
        },
        tableHeader: {
          bold: true,
          fillColor: '#e5e7eb',
          color: '#111827',
          fontSize: 12,
          margin: [0, 4, 0, 4]
        },
        tableStyle: {
          margin: [0, 0, 0, 0],
          fontSize: 11
        }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.pdf');
    res.setHeader('Content-Type', 'application/pdf');
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    console.error('PDF Export Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  }
};
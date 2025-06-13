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

exports.getReports = async (req, res) => {
  const { employee_id, from, to, summary } = req.query;
  const where = {};
  if (employee_id && employee_id !== 'all') where.employee_id = employee_id;
  if (from || to) {
    where.clock_in = {};
    if (from) where.clock_in[Op.gte] = new Date(from);
    if (to) where.clock_in[Op.lte] = new Date(to);
  }

  const records = await Attendance.findAll({
    where,
    include: [{ model: Employee, as: 'employee', attributes: ['first_name', 'last_name'] }],
    order: [['clock_in', 'ASC']],
  });

  if (summary === 'true') {
    // Summarized view with break time
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
        };
      } else {
        if (toUK(rec.clock_in) < grouped[key].firstIn)
          grouped[key].firstIn = toUK(rec.clock_in);
        if (toUK(rec.clock_out) > grouped[key].lastOut)
          grouped[key].lastOut = toUK(rec.clock_out);
      }

      grouped[key].totalMinutes += toUK(rec.clock_out).diff(toUK(rec.clock_in), 'minutes').minutes;
    });

    const summaryResult = Object.values(grouped).map((entry, i) => {
      const totalSpan = entry.lastOut.diff(entry.firstIn, 'minutes').minutes;
      const breakTime = Math.max(totalSpan - entry.totalMinutes, 0);
      return {
        id: i + 1,
        employee: entry.employee,
        date: entry.date,
        first_clock_in: entry.firstIn.toFormat('HH:mm'),
        last_clock_out: entry.lastOut.toFormat('HH:mm'),
        total_work_hours: minutesToHoursMinutes(entry.totalMinutes),
        break_time: minutesToHoursMinutes(breakTime),
      };
    });

    return res.json(summaryResult);
  }

  // Detailed view
  const detailed = records.map((rec, i) => {
    const clockInUK = toUK(rec.clock_in);
    const clockOutUK = rec.clock_out ? toUK(rec.clock_out) : null;
    return {
      id: rec.id || i + 1,
      employee: rec.employee,
      date: clockInUK.toFormat('dd-MM-yyyy'),
      clock_in_uk: clockInUK.toFormat('HH:mm'),
      clock_out_uk: clockOutUK ? clockOutUK.toFormat('HH:mm') : '—',
      total_work_hours: clockOutUK
        ? minutesToHoursMinutes(clockOutUK.diff(clockInUK, 'minutes').minutes)
        : '—',
    };
  });

  res.json(detailed);
};
// ✅ DAILY SUMMARY REPORT
exports.getDailySummary = async (req, res) => {
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
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Fetch Summary Error:', err);
    res.status(500).json({ error: 'Summary failed' });
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
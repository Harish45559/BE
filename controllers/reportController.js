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
      include: [{ model: Employee, as: 'employee', attributes: ['id', 'first_name', 'last_name', 'username'] }],
      order: [['clock_in', 'DESC']],
    });

    const reportsWithHours = reports.map((r) => ({
      ...r.toJSON(),
      clock_in_uk: toUK(r.clock_in)?.toFormat('dd-MM-yyyy HH:mm'),
      clock_out_uk: r.clock_out ? toUK(r.clock_out)?.toFormat('dd-MM-yyyy HH:mm') : '—',
      total_work_hours: computeTotalHours(r.clock_in, r.clock_out),
    }));

    res.json(reportsWithHours);
  } catch (err) {
    console.error('Fetch Reports Error:', err);
    res.status(500).json({ error: 'Server error' });
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
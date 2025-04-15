
const { Attendance, Employee } = require('../models');
const { Op } = require('sequelize');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const { DateTime } = require('luxon');
const { formatToUK } = require('../utils/time');

// ✅ Convert JS Date to UK Luxon DateTime
const toUK = (date) => {
    if (!date) return null;
    return DateTime.fromJSDate(new Date(date)).setZone('Europe/London');
};

// ✅ Format HH:MM from Luxon DateTimes
function computeTotalHours(clockIn, clockOut) {
    if (!clockIn || !clockOut) return '';

    const inTime = toUK(clockIn);
    const outTime = toUK(clockOut);

    if (!inTime || !outTime) return '';

    const diff = outTime.diff(inTime, ['hours', 'minutes']).toObject();
    const hours = Math.floor(diff.hours);
    const minutes = Math.floor(diff.minutes);
    return `${hours}h ${minutes}m`;
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

        const reports = await Attendance.findAll({
            where,
            include: [{
                model: Employee,
                attributes: ['id', 'first_name', 'last_name', 'username'],
                as: 'employee'
            }],
            order: [['clock_in', 'DESC']]
        });

        const reportsWithHours = reports.map(r => ({
            ...r.toJSON(),
            clock_in: toUK(r.clock_in)?.toISO(), // Convert to UK time and format to ISO
            clock_out: r.clock_out ? toUK(r.clock_out)?.toISO() : null, // Convert to UK time and format to ISO
            total_work_hours: computeTotalHours(r.clock_in, r.clock_out)
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
        include: [{ model: Employee, required: false }],
        order: [['clock_in', 'DESC']]
      });
  
      const data = reports.map(r => {
        const emp = r.employee;
        return {
          Employee: emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown',
          Username: emp?.username || '—',
          ClockIn: toUK(r.clock_in)?.toFormat('dd-MM-yyyy HH:mm') || '',
          ClockOut: r.clock_out ? toUK(r.clock_out)?.toFormat('dd-MM-yyyy HH:mm') : '',
          TotalHours: computeTotalHours(r.clock_in, r.clock_out)
        };
      });
  
      // ✅ Ensure no crash when data is empty
      const fields = ['Employee', 'Username', 'ClockIn', 'ClockOut', 'TotalHours'];
      const parser = new Parser({ fields });
      const csv = parser.parse(data.length > 0 ? data : [{}]); // <-- fix is here
  
      res.header('Content-Type', 'text/csv');
      res.attachment('attendance_report.csv');
      res.send(csv);
    } catch (err) {
      console.error('CSV Download Error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to generate CSV' });
      }
    }
  };
  

exports.exportPDF = async (req, res) => {
    const doc = new PDFDocument();
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
            include: [{ model: Employee, required: false }],
            order: [['clock_in', 'DESC']]
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.pdf');
        doc.pipe(res);

        doc.fontSize(18).text('Attendance Report', { align: 'center' });
        doc.moveDown();

        reports.forEach((r, i) => {
            const emp = r.employee;
            const name = emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown';
            const clockInUK = toUK(r.clock_in)?.toFormat('dd-MM-yyyy HH:mm') || '—';
            const clockOutUK = r.clock_out ? toUK(r.clock_out)?.toFormat('dd-MM-yyyy HH:mm') : '—';

            doc.fontSize(12).text(
                `${i + 1}. ${name} | Clock In: ${clockInUK} | Clock Out: ${clockOutUK} | Total: ${computeTotalHours(r.clock_in, r.clock_out)}`
            );
        });

        doc.end();
    } catch (err) {
        console.error('PDF Download Error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate PDF' });
        }
        doc.end();
    }
};

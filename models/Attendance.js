const { DataTypes, Op } = require('sequelize');
const sequelize = require('../config/db');
const Employee = require('./Employee');

const Attendance = sequelize.define('Attendance', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  employee_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'employees',
      key: 'id'
    }
  },
  clock_in: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Stored in UTC'
  },
  clock_out: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Stored in UTC'
  },
  clock_in_uk: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'BST formatted date string for display'
  },
  clock_out_uk: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'BST formatted date string for display'
  },
  total_work_hours: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Stored as HH:MM'
  },
  break_minutes: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  latitude: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  longitude: {
    type: DataTypes.FLOAT,
    allowNull: true
  }
}, {
  tableName: 'attendance',
  timestamps: false
});

// Associations
Attendance.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

/**
 * Calculate work duration in milliseconds
 */
Attendance.calculateTotalWorkHours = (clock_in, clock_out, break_time = 0) => {
  const inTime = new Date(clock_in);
  const outTime = new Date(clock_out);

  if (outTime < inTime) outTime.setDate(outTime.getDate() + 1);

  const workDuration = (outTime - inTime) - break_time;
  return workDuration;
};

/**
 * Calculate break time from last clock out
 */
Attendance.calculateBreakTime = async (employee_id, currentClockInTime) => {
  const last = await Attendance.findOne({
    where: {
      employee_id,
      clock_out: { [Op.ne]: null }
    },
    order: [['clock_out', 'DESC']]
  });

  if (last && last.clock_out) {
    const lastOut = new Date(last.clock_out);
    let breakDuration = new Date(currentClockInTime) - lastOut;

    if (breakDuration < 0) breakDuration += 86400000;
    return breakDuration > 300000 ? breakDuration : 0;
  }

  return 0;
};

module.exports = Attendance;

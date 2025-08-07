// models/Attendance.js
const { DataTypes, Sequelize } = require('sequelize');
const sequelize = require('../config/db');
const Employee = require('./Employee');

const Attendance = sequelize.define('Attendance', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  employee_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: {
      model: 'employees',
      key: 'id',
    },
  },
  // ✅ Actual timestamps used for calculations
  clock_in: {
    type: DataTypes.DATE,
    allowNull: true, // TEMPORARILY allow null for existing data
    comment: 'Actual clock-in datetime',
  },
  clock_out: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Actual clock-out datetime',
  },

  // ✅ Display fields (already present in your DB)
  clock_in_uk: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Formatted clock-in time for UK (BST)',
  },
  clock_out_uk: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Formatted clock-out time for UK (BST)',
  },
  total_work_hours: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Total working duration, stored as HH:MM',
  },
  break_minutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Total break time in minutes',
  },
}, {
  tableName: 'attendance',
  timestamps: false,
});

// ✅ Relationship setup
Attendance.belongsTo(Employee, { foreignKey: 'employee_id', as: 'employee' });

module.exports = Attendance;

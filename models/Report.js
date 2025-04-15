const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Report = sequelize.define('Report', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  report_type: { type: DataTypes.STRING, allowNull: false },
  file_path: { type: DataTypes.STRING, allowNull: false, unique: true },
  generated_on: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'reports',
  timestamps: false
});

module.exports = Report;

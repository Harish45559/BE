const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');

// Models
const Admin = require('./Admin');
const Employee = require('./Employee');
const Attendance = require('./Attendance');
const Report = require('./Report');
const Category = require('./Category');
const MenuItem = require('./menuItem');
const Order = require('./Order')(sequelize, DataTypes);
const TillStatus = require('./tillStatus')(sequelize, DataTypes);




// 🖁️ Model Relationships

// Employee ↔️ Attendance
Employee.hasMany(Attendance, { foreignKey: 'employee_id' });
Attendance.belongsTo(Employee, {
  foreignKey: 'employee_id',
  as: 'employee'
});

// Employee ↔️ Report
Employee.hasMany(Report, { foreignKey: 'employee_id' });
Report.belongsTo(Employee, { foreignKey: 'employee_id' });

// Category ↔️ MenuItem
Category.hasMany(MenuItem, { foreignKey: 'categoryId' });
MenuItem.belongsTo(Category, { foreignKey: 'categoryId' });

// ✅ Export everything for use
module.exports = {
  sequelize,
  Admin,
  Employee,
  Attendance,
  Report,
  Category,
  MenuItem,
  Order,
  tillstatus // ✅ use this instead of Till
};
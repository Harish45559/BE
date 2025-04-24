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

// Relationships
Employee.hasMany(Attendance, { foreignKey: 'employee_id' }); // ✅ Keep
Employee.hasMany(Report, { foreignKey: 'employee_id' });     // ✅ Keep
Report.belongsTo(Employee, { foreignKey: 'employee_id' });   // ✅ Keep

Category.hasMany(MenuItem, { foreignKey: 'categoryId' });    // ✅ Keep
MenuItem.belongsTo(Category, { foreignKey: 'categoryId' });  // ✅ Keep


module.exports = {
  sequelize,
  Admin,
  Employee,
  Attendance,
  Report,
  Category,
  MenuItem,
  Order,
};

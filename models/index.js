const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');

// Models
const Admin = require('./Admin');
const Employee = require('./Employee');
const Attendance = require('./Attendance');
const Report = require('./Report');
const Category = require('./Category');
const MenuItem = require('./menuItem');
const OrderModel = require('./Order');

const Order = OrderModel(sequelize, DataTypes);

// ✅ Only define one side of association here (the one not already in model file)
Employee.hasMany(Attendance, { foreignKey: 'employee_id', as: 'attendances' }); // this is OK
// ❌ Remove duplicate: Attendance.belongsTo(Employee, ...) — already defined in Attendance.js

Employee.hasMany(Report, { foreignKey: 'employee_id' });
Report.belongsTo(Employee, { foreignKey: 'employee_id' });

Category.hasMany(MenuItem, { foreignKey: 'categoryId' });
MenuItem.belongsTo(Category, { foreignKey: 'categoryId' });

module.exports = {
  sequelize,
  Admin,
  Employee,
  Attendance,
  Report,
  Category,
  MenuItem,
  Order
};

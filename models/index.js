const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');

// Models (import normally)
const Admin = require('./Admin');
const Employee = require('./Employee');
const Attendance = require('./Attendance');
const Report = require('./Report');
const Category = require('./Category');
const MenuItem = require('./menuItem');

// ❗ Import Order correctly (because it's a function)
const OrderModel = require('./Order');

// Initialize Order properly
const Order = OrderModel(sequelize, DataTypes);

// Define relationships
Employee.hasMany(Attendance, { foreignKey: 'employee_id' });
Employee.hasMany(Report, { foreignKey: 'employee_id' });
Report.belongsTo(Employee, { foreignKey: 'employee_id' });

Category.hasMany(MenuItem, { foreignKey: 'categoryId' });
MenuItem.belongsTo(Category, { foreignKey: 'categoryId' });

// Export all models properly
module.exports = {
  sequelize,
  Admin,
  Employee,
  Attendance,
  Report,
  Category,
  MenuItem,
  Order // ✅ Correct now
};

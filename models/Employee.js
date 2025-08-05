// ✅ Employee.js (Model)
const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const bcrypt = require('bcryptjs');

const Employee = sequelize.define('Employee', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  first_name: { type: DataTypes.STRING, allowNull: false },
  last_name: { type: DataTypes.STRING, allowNull: false },
  dob: { type: DataTypes.DATEONLY, allowNull: false },
  joining_date: { type: DataTypes.DATEONLY, allowNull: false },
  brp: { type: DataTypes.STRING, allowNull: false },
  address: { type: DataTypes.TEXT, allowNull: false },
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: 'employee' },
  pin: { type: DataTypes.STRING, allowNull: true },
  email: { type: DataTypes.STRING, allowNull: true },
  phone: { type: DataTypes.STRING, allowNull: true },
  gender: { type: DataTypes.STRING, allowNull: true },
}, {
  tableName: 'employees',
  timestamps: false
});

Employee.beforeCreate(async (emp) => {
  if (!emp.password.startsWith('$2a$')) {
    emp.password = await bcrypt.hash(emp.password, 10);
  }
  if (emp.pin && !emp.pin.startsWith('$2a$')) {
    emp.pin = await bcrypt.hash(emp.pin, 10);
  }
});

Employee.beforeUpdate(async (emp) => {
  if (emp.changed('password') && !emp.password.startsWith('$2a$')) {
    emp.password = await bcrypt.hash(emp.password, 10);
  }
  if (emp.changed('pin') && emp.pin && !emp.pin.startsWith('$2a$')) {
    emp.pin = await bcrypt.hash(emp.pin, 10);
  }
});




module.exports = Employee;



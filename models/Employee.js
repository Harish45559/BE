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
  pin: {type: DataTypes.STRING(4),allowNull: true , validate: {len: [4, 4]}},
  email: { type: DataTypes.STRING,  allowNull: true },
  phone: {type: DataTypes.STRING, allowNull: true},
  gender: { type: DataTypes.STRING, allowNull: true },
  
}, {
  tableName: 'employees',
  timestamps: false
});

Employee.beforeCreate(async (emp) => {
  emp.password = await bcrypt.hash(emp.password, 10);
});
Employee.beforeUpdate(async (emp) => {
  if (emp.changed('password')) {
    emp.password = await bcrypt.hash(emp.password, 10);
  }
});

module.exports = Employee;

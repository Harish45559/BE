const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const bcrypt = require('bcryptjs');


const Admin = sequelize.define('Admin', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING, unique: true, allowNull: false },
  password: { type: DataTypes.STRING, allowNull: false },
}, {
  tableName: 'admins',
  timestamps: false
});

Admin.beforeCreate(async (admin) => {
  admin.password = await bcrypt.hash(admin.password, 10);
});

module.exports = Admin;

const sequelize = require("../config/db");
const { DataTypes } = require("sequelize");

// Models
const Admin = require("./Admin");
const Employee = require("./Employee");
const Attendance = require("./Attendance");
const Category = require("./Category");
const MenuItem = require("./menuItem");
const OrderModel = require("./Order");

const HeldOrderModel = require("./HeldOrder");
const Order = OrderModel(sequelize, DataTypes);
const HeldOrder = HeldOrderModel(sequelize, DataTypes);

Employee.hasMany(Attendance, { foreignKey: "employee_id", as: "attendances" });

Category.hasMany(MenuItem, { foreignKey: "categoryId" });
MenuItem.belongsTo(Category, { foreignKey: "categoryId" });

module.exports = {
  sequelize,
  Admin,
  Employee,
  Attendance,
  Category,
  MenuItem,
  Order,
  HeldOrder,
};

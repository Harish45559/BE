const sequelize = require("../config/db");
const { DataTypes } = require("sequelize");

// Models

const Employee = require("./Employee");
const Attendance = require("./Attendance");
const Category = require("./Category");
const MenuItem = require("./menuItem");
const Customer = require("./Customer");
const TimeSlotSettings = require("./TimeSlotSettings");
const OrderModel = require("./Order");

const HeldOrderModel = require("./HeldOrder");
const TillStatusModel = require("./tillstatuses");
const Order = OrderModel(sequelize, DataTypes);
const HeldOrder = HeldOrderModel(sequelize, DataTypes);
const TillStatus = TillStatusModel(sequelize, DataTypes);

Employee.hasMany(Attendance, { foreignKey: "employee_id", as: "attendances" });

Category.hasMany(MenuItem, { foreignKey: "categoryId" });
MenuItem.belongsTo(Category, { foreignKey: "categoryId" });

module.exports = {
  sequelize,

  Employee,
  Attendance,
  Category,
  MenuItem,
  Customer,
  TimeSlotSettings,
  Order,
  HeldOrder,
  TillStatus,
};

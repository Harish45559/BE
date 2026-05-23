const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const PromoUsage = sequelize.define("PromoUsage", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  promo_id: { type: DataTypes.INTEGER, allowNull: false },
  customer_id: { type: DataTypes.INTEGER, allowNull: false },
  order_id: { type: DataTypes.INTEGER, allowNull: true },
  used_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: "promo_usage",
  timestamps: false,
});

module.exports = PromoUsage;

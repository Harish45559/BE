const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const PromoCode = sequelize.define("PromoCode", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

  code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    set(val) { this.setDataValue("code", val.toUpperCase().trim()); },
  },

  description: { type: DataTypes.STRING, allowNull: true },

  // 'percentage' | 'fixed' | 'bogo'
  discount_type: { type: DataTypes.STRING, allowNull: false, defaultValue: "percentage" },

  // For percentage: 0–100. For fixed: £ amount. For bogo: ignored (cheapest item free).
  discount_value: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },

  // 'all' | 'categories' | 'items'
  applicable_to: { type: DataTypes.STRING, allowNull: false, defaultValue: "all" },

  // Array of category or item IDs when applicable_to != 'all'
  applicable_ids: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },

  // null = unlimited total uses
  max_uses: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },

  uses_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

  // null = unlimited per customer, 1 = one use per customer
  per_customer_limit: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },

  min_order_value: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },

  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },

  expires_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },

  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: "promo_codes",
  timestamps: false,
});

module.exports = PromoCode;

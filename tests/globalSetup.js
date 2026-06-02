// Runs once before all Jest tests — ensures test DB has all migrations applied
const { Sequelize, DataTypes } = require("sequelize");
require("dotenv").config();

module.exports = async function () {
  const db = new Sequelize(process.env.DATABASE_URL || process.env.TEST_DATABASE_URL, {
    dialect: "postgres",
    logging: false,
    dialectOptions: process.env.DATABASE_URL?.includes("render.com") || process.env.NODE_ENV === "production"
      ? { ssl: { require: true, rejectUnauthorized: false } }
      : {},
  });

  try {
    await db.authenticate();
    const qi = db.getQueryInterface();

    // Run all column migrations so test DB stays in sync with model
    const cols = [
      ["orders", "pager_token",              { type: DataTypes.STRING, allowNull: true, unique: true }],
      ["orders", "pager_status",             { type: DataTypes.STRING, allowNull: true }],
      ["orders", "ring_count",               { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 }],
      ["orders", "source",                   { type: DataTypes.STRING, allowNull: false, defaultValue: "pos" }],
      ["orders", "customer_id",              { type: DataTypes.INTEGER, allowNull: true, defaultValue: null }],
      ["orders", "pickup_time",              { type: DataTypes.STRING, allowNull: true, defaultValue: null }],
      ["orders", "payment_status",           { type: DataTypes.STRING, allowNull: false, defaultValue: "paid" }],
      ["orders", "order_status",             { type: DataTypes.STRING, allowNull: false, defaultValue: "pending" }],
      ["orders", "estimated_ready",          { type: DataTypes.STRING, allowNull: true, defaultValue: null }],
      ["orders", "customer_notes",           { type: DataTypes.TEXT, allowNull: true, defaultValue: null }],
      ["orders", "promo_code",               { type: DataTypes.STRING, allowNull: true, defaultValue: null }],
      ["orders", "sumup_transaction_code",   { type: DataTypes.STRING, allowNull: true, defaultValue: null }],
      ["menu_items", "available",            { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }],
      ["customers", "favourites",            { type: DataTypes.JSONB, allowNull: false, defaultValue: [] }],
      ["customers", "expo_push_token",       { type: DataTypes.STRING, allowNull: true }],
    ];

    for (const [table, col, def] of cols) {
      try {
        await qi.addColumn(table, col, def);
      } catch (_) {
        // already exists — skip silently
      }
    }
  } catch (err) {
    console.error("globalSetup migration error:", err.message);
  } finally {
    await db.close();
  }
};

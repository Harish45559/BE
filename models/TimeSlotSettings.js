const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

// Singleton table — always one row (id=1)
// Staff can update interval, opening/closing time, and prep buffer
const TimeSlotSettings = sequelize.define(
  "TimeSlotSettings",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      defaultValue: 1,
    },

    slot_interval_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
      comment: "Gap between pickup slots in minutes (e.g. 15, 30, 45, 60)",
    },

    opening_time: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "17:00",
      comment: "Store opening time for online takeaway slots HH:mm (UK local)",
    },

    closing_time: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "23:30",
      comment: "Store closing time for online takeaway slots HH:mm (UK local)",
    },

    prep_time_minutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 15,
      comment: "Minimum prep buffer from now before first available slot",
    },

    online_orders_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: "Staff can toggle online ordering on/off",
    },
  },
  {
    tableName: "time_slot_settings",
    timestamps: false,
  },
);

module.exports = TimeSlotSettings;

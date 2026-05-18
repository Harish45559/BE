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
      defaultValue: "17:15",
      comment: "Dinner opening time HH:mm (UK local)",
    },

    closing_time: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "22:45",
      comment: "Dinner closing time HH:mm (UK local)",
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

    breakfast_opening_time: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "09:00",
      comment: "Breakfast window start HH:mm (UK local)",
    },

    breakfast_closing_time: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "12:00",
      comment: "Breakfast window end HH:mm (UK local)",
    },
  },
  {
    tableName: "time_slot_settings",
    timestamps: false,
  },
);

module.exports = TimeSlotSettings;

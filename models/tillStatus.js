const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const TillStatus = sequelize.define('TillStatus', {
  opened_by: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  open_time: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  close_time: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  opening_amount: {
    type: DataTypes.FLOAT,
    defaultValue: 100.0,
  },
  closing_amount: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  closed_by: {
    type: DataTypes.STRING,
    allowNull: true,
  }
}, {
  tableName: 'till_status',
  timestamps: true,
});

module.exports = TillStatus;

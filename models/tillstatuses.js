// server/models/tillstatuses.js

module.exports = (sequelize, DataTypes) => {
  const TillStatus = sequelize.define('TillStatus', {
    date: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    open: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    open_time: {
      type: DataTypes.DATE,
    },
    close_time: {
      type: DataTypes.DATE,
    },
    opened_by: {
      type: DataTypes.STRING,
    },
    closed_by: {
      type: DataTypes.STRING,
    },
    opening_amount: {
      type: DataTypes.DECIMAL(10, 2),
    },
    closing_amount: {
      type: DataTypes.DECIMAL(10, 2),
    },
  }, {
    tableName: 'tillstatuses' // ✅ Match actual table name
  });

  return TillStatus;
};
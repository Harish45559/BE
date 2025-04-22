// ✅ tillStatus.js (model)
module.exports = (sequelize, DataTypes) => {
  const TillStatus = sequelize.define('TillStatus', {
    date: DataTypes.STRING,
    opened_by: DataTypes.STRING,
    open_time: DataTypes.DATE,
    closing_amount: DataTypes.DOUBLE,
    closed_by: DataTypes.STRING,
    close_time: DataTypes.DATE,
    opening_amount: DataTypes.DOUBLE,
  }, {
    tableName: 'till_status',
    timestamps: false
  });

  return TillStatus;
};
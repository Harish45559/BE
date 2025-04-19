module.exports = (sequelize, DataTypes) => {
  const TillStatus = sequelize.define('TillStatus', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    date: { type: DataTypes.DATEONLY, allowNull: false, unique: true },
    opened_by: { type: DataTypes.STRING },
    closed_by: { type: DataTypes.STRING },
    open_time: { type: DataTypes.DATE },
    close_time: { type: DataTypes.DATE },
    opening_amount: { type: DataTypes.FLOAT, defaultValue: 100 },
    closing_amount: { type: DataTypes.FLOAT }
  }, {
    tableName: 'till_statuses',
    timestamps: false
  });

  return TillStatus;
};

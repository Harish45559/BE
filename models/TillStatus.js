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
    openTime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    closeTime: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  });

  return TillStatus;
};

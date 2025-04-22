module.exports = (sequelize, DataTypes) => {
  const TillStatuses = sequelize.define('TillStatuses', {
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

  return tillstatus;
};

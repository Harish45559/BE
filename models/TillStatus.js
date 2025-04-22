module.exports = (sequelize, DataTypes) => {
  const tillstatus = sequelize.define('tillstatus', {
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

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Admin = sequelize.define('Admin', {
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    }
  }, {
    tableName: 'admins',
    timestamps: false
  });

  return Admin;
};

module.exports = (sequelize, DataTypes) => {
  const Till = sequelize.define('Till', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    date: {
      type: DataTypes.STRING,
      allowNull: false
    },
    opened_by: {
      type: DataTypes.STRING
    },
    open_time: {
      type: DataTypes.DATE
    },
    closing_amount: {
      type: DataTypes.DOUBLE
    },
    closed_by: {
      type: DataTypes.STRING
    },
    close_time: {
      type: DataTypes.DATE
    },
    opening_amount: {
      type: DataTypes.DOUBLE,
      defaultValue: 100
    }
  }, {
    tableName: 'till_status', // 🔑 maps to your actual DB table
    timestamps: false
  });

  return Till;
};

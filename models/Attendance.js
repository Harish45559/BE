module.exports = (sequelize, DataTypes) => {
  const Attendance = sequelize.define('Attendance', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    employee_id: { type: DataTypes.INTEGER, allowNull: false },
    clock_in: { type: DataTypes.DATE },
    clock_out: { type: DataTypes.DATE },
    clock_in_uk: { type: DataTypes.STRING },
    clock_out_uk: { type: DataTypes.STRING },
    total_work_hours: { type: DataTypes.STRING },
    break_minutes: { type: DataTypes.INTEGER },
    latitude: { type: DataTypes.FLOAT },
    longitude: { type: DataTypes.FLOAT }
  }, {
    tableName: 'attendance',
    timestamps: false
  });

  return Attendance;
};

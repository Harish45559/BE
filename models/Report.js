module.exports = (sequelize, DataTypes) => {
  const Report = sequelize.define('Report', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    report_type: { type: DataTypes.STRING, allowNull: false },
    file_path: { type: DataTypes.STRING, allowNull: false, unique: true },
    generated_on: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    employee_id: { type: DataTypes.INTEGER, allowNull: false }
  }, {
    tableName: 'reports',
    timestamps: false
  });

  return Report;
};

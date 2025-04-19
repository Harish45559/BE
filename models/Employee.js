module.exports = (sequelize, DataTypes) => {
  const Employee = sequelize.define('Employee', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    first_name: { type: DataTypes.STRING, allowNull: false },
    last_name: { type: DataTypes.STRING, allowNull: false },
    dob: { type: DataTypes.DATEONLY, allowNull: false },
    joining_date: { type: DataTypes.DATEONLY, allowNull: false },
    brp: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.TEXT, allowNull: false },
    username: { type: DataTypes.STRING, unique: true, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, defaultValue: 'employee' },
    pin: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    phone: { type: DataTypes.STRING },
    gender: { type: DataTypes.STRING },
  }, {
    tableName: 'employees',
    timestamps: false
  });

  return Employee;
};

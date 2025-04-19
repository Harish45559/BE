module.exports = (sequelize, DataTypes) => {
  const MenuItem = sequelize.define('MenuItem', {
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    price: { type: DataTypes.FLOAT, allowNull: false },
    is_veg: { type: DataTypes.BOOLEAN, allowNull: false },
    categoryId: { type: DataTypes.INTEGER, allowNull: false }
  }, {
    tableName: 'menu_items',
    timestamps: true,
    underscored: true
  });

  return MenuItem;
};

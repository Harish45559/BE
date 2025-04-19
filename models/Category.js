module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    }
  });

  // Association
  Category.associate = (models) => {
    Category.hasMany(models.MenuItem, {
      foreignKey: 'categoryId',
      as: 'menuItems',
    });
  };

  return Category;
};

const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Category = require('./Category'); // ✅

const MenuItem = sequelize.define('MenuItem', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  is_veg: {
    type: DataTypes.BOOLEAN,
    allowNull: false
  },
  categoryId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  image_url: {                    // ✅ NEW FIELD
    type: DataTypes.STRING,
    allowNull: true               // optional (if you don't have image now)
  }
}, {
  tableName: 'menu_items',
  timestamps: true,
  underscored: true
});

MenuItem.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });

module.exports = MenuItem;

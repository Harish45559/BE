const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const bcrypt = require("bcryptjs");

const Customer = sequelize.define(
  "Customer",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },

    phone: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    address_line1: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    city: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    postcode: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    favourites: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },

    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "customers",
    timestamps: false,
  }
);

Customer.beforeCreate(async (customer) => {
  if (!customer.password.startsWith("$2")) {
    customer.password = await bcrypt.hash(customer.password, 10);
  }
});

Customer.beforeUpdate(async (customer) => {
  if (customer.changed("password") && !customer.password.startsWith("$2")) {
    customer.password = await bcrypt.hash(customer.password, 10);
  }
});

module.exports = Customer;

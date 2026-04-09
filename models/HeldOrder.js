module.exports = (sequelize, DataTypes) => {
  const HeldOrder = sequelize.define(
    "HeldOrder",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      customer_name: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: "N/A",
      },
      server_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      order_type: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      items: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      total_amount: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },
      discount_percent: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
      },
      discount_amount: {
        type: DataTypes.FLOAT,
        defaultValue: 0,
      },
      date: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      display_number: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
    },
    {
      tableName: "held_orders",
      timestamps: true,
      underscored: true,
    },
  );

  return HeldOrder;
};

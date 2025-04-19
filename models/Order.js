// server/models/Order.js
module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    customer_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    server_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    order_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    table_number: DataTypes.STRING,
    covers: DataTypes.STRING,

    order_number: {
      type: DataTypes.BIGINT,
      allowNull: false,
      unique: true,
    },

    items: {
      type: DataTypes.JSONB,
      allowNull: false,
    },

    total_amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    payment_method: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // UTC timestamp stored normally
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    // ✅ NEW: BST/UK local time string (formatted)
    date: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Stored as formatted UK time (dd/MM/yyyy HH:mm:ss)'
    }
  }, {
    timestamps: false,
    tableName: 'orders'
  });

  return Order;
};

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
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
      comment: 'Format: DDMM-NNN (e.g. 1304-001). Resets daily.'
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

    final_amount: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },

    payment_method: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    date: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'Stored as formatted UK time (dd/MM/yyyy HH:mm:ss)'
    },

    pager_token: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },

    pager_status: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      comment: 'null = no pager, waiting = customer waiting, ready = food ready'
    },
  }, {
    timestamps: false,
    tableName: 'orders'
  });

  return Order;
};

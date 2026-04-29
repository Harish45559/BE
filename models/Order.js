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

    ring_count: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
      comment: 'Incremented each time staff marks the order ready — allows multiple buzzes per order'
    },

    source: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pos',
      comment: 'pos = placed by staff, online = placed by customer'
    },

    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: 'FK to customers table — null for walk-in/pos orders'
    },

    pickup_time: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      comment: 'Requested pickup time for takeaway online orders (stored as UK formatted string)'
    },

    payment_status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'paid',
      comment: 'paid = already paid, pending = pay on collection'
    },

    order_status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'pending',
      comment: 'pending | accepted | rejected | ready | completed',
    },

    estimated_ready: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
      comment: 'Staff-set estimated ready time e.g. "14:45"',
    },

    customer_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: 'Customer special requests e.g. no onions, less spicy',
    },
  }, {
    timestamps: false,
    tableName: 'orders'
  });

  return Order;
};

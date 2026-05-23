/**
 * One-time migration: creates promo_codes and promo_usage tables.
 * Run once with: node scripts/migrate-promos.js
 */

const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    const qi = sequelize.getQueryInterface();

    // Create promo_codes table
    await qi.createTable('promo_codes', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      code: { type: DataTypes.STRING, allowNull: false, unique: true },
      description: { type: DataTypes.STRING, allowNull: true },
      discount_type: { type: DataTypes.STRING, allowNull: false, defaultValue: 'percentage' },
      discount_value: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      applicable_to: { type: DataTypes.STRING, allowNull: false, defaultValue: 'all' },
      applicable_ids: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      max_uses: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      uses_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      per_customer_limit: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      min_order_value: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      expires_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    }).then(() => {
      console.log('✅ promo_codes table created');
    }).catch((err) => {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  promo_codes table already exists, skipping.');
      } else {
        throw err;
      }
    });

    // Create promo_usage table
    await qi.createTable('promo_usage', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      promo_id: { type: DataTypes.INTEGER, allowNull: false },
      customer_id: { type: DataTypes.INTEGER, allowNull: false },
      order_id: { type: DataTypes.INTEGER, allowNull: true },
      used_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    }).then(() => {
      console.log('✅ promo_usage table created');
    }).catch((err) => {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  promo_usage table already exists, skipping.');
      } else {
        throw err;
      }
    });

    console.log('✅ Migration complete — promo_codes and promo_usage tables ready.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();

/**
 * Fix migration: adds missing columns to promo_codes table.
 * Run once with: node scripts/migrate-promos-fix.js
 */

const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');

const add = async (qi, col, def) => {
  await qi.addColumn('promo_codes', col, def).then(() => {
    console.log(`✅ Added column: ${col}`);
  }).catch((err) => {
    if (err.message.includes('already exists')) {
      console.log(`ℹ️  Column ${col} already exists, skipping.`);
    } else {
      throw err;
    }
  });
};

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    const qi = sequelize.getQueryInterface();

    await add(qi, 'description',          { type: DataTypes.STRING,  allowNull: true });
    await add(qi, 'discount_type',        { type: DataTypes.STRING,  allowNull: false, defaultValue: 'percentage' });
    await add(qi, 'discount_value',       { type: DataTypes.FLOAT,   allowNull: false, defaultValue: 0 });
    await add(qi, 'applicable_to',        { type: DataTypes.STRING,  allowNull: false, defaultValue: 'all' });
    await add(qi, 'applicable_ids',       { type: DataTypes.JSONB,   allowNull: false, defaultValue: [] });
    await add(qi, 'max_uses',             { type: DataTypes.INTEGER, allowNull: true,  defaultValue: null });
    await add(qi, 'uses_count',           { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
    await add(qi, 'per_customer_limit',   { type: DataTypes.INTEGER, allowNull: true,  defaultValue: null });
    await add(qi, 'min_order_value',      { type: DataTypes.FLOAT,   allowNull: true,  defaultValue: null });
    await add(qi, 'active',               { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true });
    await add(qi, 'expires_at',           { type: DataTypes.DATE,    allowNull: true,  defaultValue: null });
    await add(qi, 'created_at',           { type: DataTypes.DATE,    defaultValue: DataTypes.NOW });

    console.log('✅ Fix migration complete — all promo_codes columns verified.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();

/**
 * One-time migration: adds promo_code column to orders table.
 * Run once with: node scripts/migrate-orders-promo.js
 */

const sequelize = require('../config/db');
const { DataTypes } = require('sequelize');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    const qi = sequelize.getQueryInterface();

    await qi.addColumn('orders', 'promo_code', {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    }).then(() => {
      console.log('✅ Added column: promo_code');
    }).catch((err) => {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  promo_code column already exists, skipping.');
      } else {
        throw err;
      }
    });

    console.log('✅ Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();

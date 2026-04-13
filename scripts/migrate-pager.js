/**
 * One-time migration: adds pager_token and pager_status columns to the orders table.
 * Run once with: node scripts/migrate-pager.js
 */

const sequelize = require('../config/db');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    const qi = sequelize.getQueryInterface();

    // Add pager_token column
    await qi.addColumn('orders', 'pager_token', {
      type: require('sequelize').DataTypes.STRING,
      allowNull: true,
      unique: true,
    }).catch((err) => {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  pager_token column already exists, skipping.');
      } else {
        throw err;
      }
    });

    // Add pager_status column
    await qi.addColumn('orders', 'pager_status', {
      type: require('sequelize').DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    }).catch((err) => {
      if (err.message.includes('already exists')) {
        console.log('ℹ️  pager_status column already exists, skipping.');
      } else {
        throw err;
      }
    });

    console.log('✅ Migration complete — pager_token and pager_status added to orders table.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();

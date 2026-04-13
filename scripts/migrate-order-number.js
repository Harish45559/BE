/**
 * Migration: change order_number column from BIGINT to VARCHAR(20)
 * so it can hold date-prefixed values like "1304-001".
 *
 * Run once with: node scripts/migrate-order-number.js
 *
 * Safe: PostgreSQL auto-converts existing integers to strings ('1001' → '1001').
 */

const sequelize = require('../config/db');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    await sequelize.query(`
      ALTER TABLE orders
      ALTER COLUMN order_number TYPE VARCHAR(20) USING order_number::text;
    `);

    console.log('✅ order_number column changed to VARCHAR(20).');
    console.log('   Existing orders kept as-is (e.g. "1001", "1002"...).');
    console.log('   New orders will use DDMM-NNN format (e.g. "1304-001").');
    process.exit(0);
  } catch (err) {
    if (err.message.includes('already') || err.message.includes('varchar')) {
      console.log('ℹ️  Column is already VARCHAR — nothing to do.');
      process.exit(0);
    }
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();

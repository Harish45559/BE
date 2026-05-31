const http = require("http");
const bcrypt = require("bcryptjs");
const { DataTypes } = require("sequelize");
const fs = require("fs");
const path = require("path");
const db = require("./config/db");
const { Employee } = require("./models");
const app = require("./app");
const { init: initSocket } = require("./socket");

/* ================= FILE LOGGING ================= */
const logDir = path.join(__dirname, "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
const logFile = fs.createWriteStream(path.join(logDir, "app.log"), { flags: "a" });

const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  const msg = `[${new Date().toISOString()}] INFO: ${args.join(" ")}\n`;
  logFile.write(msg);
  originalLog(...args);
};

console.error = (...args) => {
  const msg = `[${new Date().toISOString()}] ERROR: ${args.join(" ")}\n`;
  logFile.write(msg);
  originalError(...args);
};

/* ================= AUTO-MIGRATIONS ================= */

async function addCol(qi, table, col, def) {
  try {
    await qi.addColumn(table, col, def);
    console.log(`✅ Migration: ${col} added to ${table}`);
  } catch (err) {
    if (!err.message.includes("already exists")) {
      console.error(`⚠️  Migration ${col} failed:`, err.message);
    }
  }
}

async function runMigrations() {
  const qi = db.getQueryInterface();

  // 1. order_number: BIGINT → VARCHAR(20)
  try {
    await db.query(`ALTER TABLE orders ALTER COLUMN order_number TYPE VARCHAR(20) USING order_number::text;`);
    console.log("✅ Migration: order_number → VARCHAR(20)");
  } catch (err) {
    if (!err.message.includes("already") && !err.message.includes("varchar") && !err.message.includes("character varying")) {
      console.error("⚠️  Migration order_number failed:", err.message);
    }
  }

  // 2-19. Column migrations
  await addCol(qi, "orders", "pager_token",    { type: DataTypes.STRING, allowNull: true, unique: true });
  await addCol(qi, "orders", "pager_status",   { type: DataTypes.STRING, allowNull: true });
  await addCol(qi, "orders", "ring_count",     { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 });
  await addCol(qi, "orders", "source",         { type: DataTypes.STRING, allowNull: false, defaultValue: "pos" });
  await addCol(qi, "orders", "customer_id",    { type: DataTypes.INTEGER, allowNull: true, defaultValue: null });
  await addCol(qi, "orders", "pickup_time",    { type: DataTypes.STRING, allowNull: true, defaultValue: null });
  await addCol(qi, "orders", "payment_status", { type: DataTypes.STRING, allowNull: false, defaultValue: "paid" });
  await addCol(qi, "orders", "order_status",   { type: DataTypes.STRING, allowNull: false, defaultValue: "pending" });
  await addCol(qi, "orders", "estimated_ready",{ type: DataTypes.STRING, allowNull: true, defaultValue: null });
  await addCol(qi, "orders", "customer_notes", { type: DataTypes.TEXT, allowNull: true, defaultValue: null });
  await addCol(qi, "orders", "promo_code",     { type: DataTypes.STRING, allowNull: true, defaultValue: null });
  await addCol(qi, "menu_items", "available",  { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true });
  await addCol(qi, "customers", "favourites",  { type: DataTypes.JSONB, allowNull: false, defaultValue: [] });
  await addCol(qi, "customers", "expo_push_token", { type: DataTypes.STRING, allowNull: true });
  await addCol(qi, "time_slot_settings", "online_orders_enabled", { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true });
  await addCol(qi, "time_slot_settings", "breakfast_opening_time", { type: DataTypes.STRING, allowNull: false, defaultValue: "09:00" });
  await addCol(qi, "time_slot_settings", "breakfast_closing_time", { type: DataTypes.STRING, allowNull: false, defaultValue: "12:00" });

  // 17. Correct dinner times
  try {
    await db.query(`UPDATE time_slot_settings SET opening_time = '17:15', closing_time = '22:45' WHERE id = 1 AND opening_time = '17:00' AND closing_time = '23:30';`);
  } catch (err) {
    console.error("⚠️  Migration dinner times failed:", err.message);
  }

  // 20. promo_codes table
  try {
    await qi.createTable("promo_codes", {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      code: { type: DataTypes.STRING, allowNull: false, unique: true },
      description: { type: DataTypes.STRING, allowNull: true },
      discount_type: { type: DataTypes.STRING, allowNull: false, defaultValue: "percentage" },
      discount_value: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      applicable_to: { type: DataTypes.STRING, allowNull: false, defaultValue: "all" },
      applicable_ids: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      max_uses: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      uses_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      per_customer_limit: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
      min_order_value: { type: DataTypes.FLOAT, allowNull: true, defaultValue: null },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      expires_at: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
      created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    });
    console.log("✅ Migration: promo_codes table created");
  } catch (err) {
    if (err.message.includes("already exists")) {
      console.log("ℹ️  Migration: promo_codes table already exists — skipped");
    } else {
      console.error("⚠️  Migration promo_codes failed:", err.message);
    }
  }

  // 21. promo_usage table
  try {
    await qi.createTable("promo_usage", {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      promo_id: { type: DataTypes.INTEGER, allowNull: false },
      customer_id: { type: DataTypes.INTEGER, allowNull: false },
      order_id: { type: DataTypes.INTEGER, allowNull: true },
      used_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    });
    console.log("✅ Migration: promo_usage table created");
  } catch (err) {
    if (err.message.includes("already exists")) {
      console.log("ℹ️  Migration: promo_usage table already exists — skipped");
    } else {
      console.error("⚠️  Migration promo_usage failed:", err.message);
    }
  }

}

/* ================= DATABASE + SERVER START ================= */

runMigrations()
  .then(() => db.sync({ force: false }))
  .then(async () => {
    console.log("✅ PostgreSQL synced");

    /* ===== ADMIN SEED (USING EMPLOYEE TABLE) ===== */

    if (process.env.ADMIN_DEFAULT_PASSWORD) {
      const existingAdmin = await Employee.findOne({
        where: { username: "admin" },
      });

      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(
          process.env.ADMIN_DEFAULT_PASSWORD,
          10,
        );

        await Employee.create({
          first_name: "System",
          last_name: "Admin",
          username: "admin",
          password: hashedPassword,
          role: "admin", // ✅ KEY CHANGE
          email: "admin@system.com",
          phone: "9999999999",
          address: "System",
          gender: "other",
          dob: "2000-01-01",
          joining_date: "2000-01-01",
          brp: "ADMIN001",
          pin: "1234", // will be hashed by model
        });

        console.log("✅ Admin user created in Employee table");
      } else {
        console.log("ℹ️ Admin already exists, skipping seed");
      }
    } else {
      console.log("ℹ️ ADMIN_DEFAULT_PASSWORD not set, skipping admin seed");
    }

    /* ===== START SERVER ===== */

    const PORT = process.env.PORT || 5000;

    const server = http.createServer(app);
    initSocket(server);
    server.listen(PORT, () => {
      console.log(`🚀 Backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to sync DB or start server:", err);
  });

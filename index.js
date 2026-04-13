const bcrypt = require("bcryptjs");
const { DataTypes } = require("sequelize");
const db = require("./config/db");
const { Employee } = require("./models");
const app = require("./app");

/* ================= AUTO-MIGRATIONS ================= */

async function runMigrations() {
  const qi = db.getQueryInterface();

  // 1. order_number: BIGINT → VARCHAR(20) for DDMM-XXXX format
  try {
    await db.query(
      `ALTER TABLE orders ALTER COLUMN order_number TYPE VARCHAR(20) USING order_number::text;`
    );
    console.log("✅ Migration: order_number → VARCHAR(20)");
  } catch (err) {
    if (
      err.message.includes("already") ||
      err.message.includes("varchar") ||
      err.message.includes("character varying")
    ) {
      console.log("ℹ️  Migration: order_number already VARCHAR — skipped");
    } else {
      console.error("⚠️  Migration order_number failed:", err.message);
    }
  }

  // 2. pager_token column
  try {
    await qi.addColumn("orders", "pager_token", {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    });
    console.log("✅ Migration: pager_token column added");
  } catch (err) {
    if (err.message.includes("already exists")) {
      console.log("ℹ️  Migration: pager_token already exists — skipped");
    } else {
      console.error("⚠️  Migration pager_token failed:", err.message);
    }
  }

  // 3. pager_status column
  try {
    await qi.addColumn("orders", "pager_status", {
      type: DataTypes.STRING,
      allowNull: true,
    });
    console.log("✅ Migration: pager_status column added");
  } catch (err) {
    if (err.message.includes("already exists")) {
      console.log("ℹ️  Migration: pager_status already exists — skipped");
    } else {
      console.error("⚠️  Migration pager_status failed:", err.message);
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

    app.listen(PORT, () => {
      console.log(`🚀 Backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to sync DB or start server:", err);
  });

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
      `ALTER TABLE orders ALTER COLUMN order_number TYPE VARCHAR(20) USING order_number::text;`,
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

  // 4. ring_count column (multi-buzz support)
  try {
    await qi.addColumn("orders", "ring_count", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
    console.log("✅ Migration: ring_count column added");
  } catch (err) {
    if (err.message.includes("already exists")) {
      console.log("ℹ️  Migration: ring_count already exists — skipped");
    } else {
      console.error("⚠️  Migration ring_count failed:", err.message);
    }
  }

  // 5. source column — 'pos' | 'online'
  try {
    await qi.addColumn("orders", "source", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pos",
    });
    console.log("✅ Migration: source column added");
  } catch (err) {
    if (err.message.includes("already exists")) {
      console.log("ℹ️  Migration: source already exists — skipped");
    } else {
      console.error("⚠️  Migration source failed:", err.message);
    }
  }

  // 6. customer_id column — FK to customers table
  try {
    await qi.addColumn("orders", "customer_id", {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    });
    console.log("✅ Migration: customer_id column added");
  } catch (err) {
    if (err.message.includes("already exists")) {
      console.log("ℹ️  Migration: customer_id already exists — skipped");
    } else {
      console.error("⚠️  Migration customer_id failed:", err.message);
    }
  }

  // 7. pickup_time column — requested pickup time for takeaway
  try {
    await qi.addColumn("orders", "pickup_time", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    });
    console.log("✅ Migration: pickup_time column added");
  } catch (err) {
    if (err.message.includes("already exists")) {
      console.log("ℹ️  Migration: pickup_time already exists — skipped");
    } else {
      console.error("⚠️  Migration pickup_time failed:", err.message);
    }
  }

  // 8. payment_status column — 'paid' | 'pending' | 'failed'
  try {
    await qi.addColumn("orders", "payment_status", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "paid",
    });
    console.log("✅ Migration: payment_status column added");
  } catch (err) {
    if (err.message.includes("already exists")) {
      console.log("ℹ️  Migration: payment_status already exists — skipped");
    } else {
      console.error("⚠️  Migration payment_status failed:", err.message);
    }
  }

  // 9. order_status column — 'pending' | 'accepted' | 'rejected' | 'ready' | 'completed'
  try {
    await qi.addColumn("orders", "order_status", {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending",
    });
    console.log("✅ Migration: order_status column added");
  } catch (err) {
    if (err.message.includes("already exists")) {
      console.log("ℹ️  Migration: order_status already exists — skipped");
    } else {
      console.error("⚠️  Migration order_status failed:", err.message);
    }
  }

  // 10. estimated_ready column — staff-set ready time
  try {
    await qi.addColumn("orders", "estimated_ready", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    });
    console.log("✅ Migration: estimated_ready column added");
  } catch (err) {
    if (err.message.includes("already exists")) {
      console.log("ℹ️  Migration: estimated_ready already exists — skipped");
    } else {
      console.error("⚠️  Migration estimated_ready failed:", err.message);
    }
  }

  // 11. online_orders_enabled column on time_slot_settings
  try {
    await qi.addColumn("time_slot_settings", "online_orders_enabled", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    console.log("✅ Migration: online_orders_enabled column added");
  } catch (err) {
    if (
      err.message.includes("already exists") ||
      err.message.includes("does not exist")
    ) {
      console.log(
        "ℹ️  Migration: online_orders_enabled already exists — skipped",
      );
    } else {
      console.error("⚠️  Migration online_orders_enabled failed:", err.message);
    }
  }

  // 12. Force correct opening/closing times for online takeaway slots
  try {
    await db.query(
      `UPDATE time_slot_settings SET opening_time = '17:00', closing_time = '23:30' WHERE id = 1;`,
    );
    console.log("✅ Migration: time slot hours set to 17:00–23:30");
  } catch (err) {
    console.error("⚠️  Migration time slot hours failed:", err.message);
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

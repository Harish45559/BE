const bcrypt = require("bcryptjs");
const db = require("./config/db");
const { Employee } = require("./models");
const app = require("./app");

/* ================= DATABASE + SERVER START ================= */

db.sync({ force: false })
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

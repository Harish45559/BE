const bcrypt = require("bcryptjs");
const db = require("./config/db");
const { Admin } = require("./models");
const app = require("./app");

/* ================= DATABASE + SERVER START ================= */

db.sync({ force: false })
  .then(async () => {
    console.log("✅ PostgreSQL synced");

    /* ===== SAFE ADMIN SEED (PRODUCTION SAFE) ===== */

    if (process.env.ADMIN_DEFAULT_PASSWORD) {
      const existingAdmin = await Admin.findOne({
        where: { username: "admin" },
      });

      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(
          process.env.ADMIN_DEFAULT_PASSWORD,
          10,
        );

        await Admin.create({
          username: "admin",
          password: hashedPassword,
        });

        console.log("✅ Admin user created from environment variable");
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

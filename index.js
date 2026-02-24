const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const db = require("./config/db");
const { Admin } = require("./models");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");

dotenv.config();
const app = express();

/* ================= SECURITY ================= */
app.use(helmet());

/* ================= CORS ================= */

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://fe-2n6s.onrender.com",
];

const corsOptions = {
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ================= BODY PARSER ================= */

app.use(express.json());

/* ================= ROUTES ================= */

const authRoutes = require("./routes/authRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const reportRoutes = require("./routes/reportRoutes");
const orderRoutes = require("./routes/orderRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const menuRoutes = require("./routes/menuRoutes");
const salesRoutes = require("./routes/salesRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/sales", salesRoutes);

/* ================= SERVE FRONTEND (IF BUILT) ================= */

const distPath = path.join(__dirname, "client", "dist");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

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

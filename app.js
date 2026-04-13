const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
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
const tillRoutes = require("./routes/tillRoutes");
const pagerRoutes = require("./routes/pagerRoutes");
const { servePagerPage } = require("./controllers/pagerController");

app.use("/api/auth", authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/till", tillRoutes);
app.use("/api/pager", pagerRoutes);

/* ================= STATIC PUBLIC ASSETS ================= */
app.use('/public', express.static(path.join(__dirname, 'public')));

/* ================= PAGER — public customer page ================= */
app.get("/pager/:token", servePagerPage);

/* ================= HEALTH CHECK ================= */
app.get("/health", (req, res) => res.json({ status: "ok" }));

/* ================= SERVE FRONTEND (IF BUILT) ================= */

const distPath = path.join(__dirname, "client", "dist");

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

module.exports = app;

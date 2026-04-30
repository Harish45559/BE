const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");

dotenv.config();

const app = express();

/* ================= TRUST PROXY ================= */
// Required when running behind a proxy/forward port (mobile testing, Render, ngrok etc.)
// Allows express-rate-limit to correctly read the client IP from X-Forwarded-For
app.set("trust proxy", 1);

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
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (/https:\/\/.*\.onrender\.com$/.test(origin)) return cb(null, true);
    if (/https:\/\/.*\.devtunnels\.ms$/.test(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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

/* ================= PAYMENT ROUTES (SumUp — uses regular JSON body) ================= */

// Stripe required express.raw() before express.json() — SumUp uses normal JSON
const customerPaymentRoutes = require("./routes/customerPaymentRoutes");
app.use("/api/customer/payments", customerPaymentRoutes);

/* ================= ROUTES ================= */

const authRoutes = require("./routes/authRoutes");
const customerAuthRoutes = require("./routes/customerAuthRoutes");
const customerMenuRoutes = require("./routes/customerMenuRoutes");
const customerOrderRoutes = require("./routes/customerOrderRoutes");
const customerProfileRoutes = require("./routes/customerProfileRoutes");
const customerTimeslotRoutes = require("./routes/customerTimeslotRoutes");
const timeSlotRoutes = require("./routes/timeSlotRoutes");
const onlineOrderRoutes = require("./routes/onlineOrderRoutes");
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
app.use("/api/customer/auth", customerAuthRoutes);
app.use("/api/customer/menu", customerMenuRoutes);
app.use("/api/customer/orders", customerOrderRoutes);
app.use("/api/customer/profile", customerProfileRoutes);
app.use("/api/customer/timeslots", customerTimeslotRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/orders/online", onlineOrderRoutes);
app.use("/api/orders/timeslots", timeSlotRoutes);
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

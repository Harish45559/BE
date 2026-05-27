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

/* ================= STATIC FILES ================= */

app.use("/images", (req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static("public/images"));

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
const promoRoutes = require("./routes/promoRoutes");
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
app.use("/api/promos", promoRoutes);

/* ================= APP VERSION CHECK ================= */
// Update minimum_version here whenever you release a breaking update
app.get("/api/app/version", (req, res) => {
  res.json({ minimum_version: "1.0.0" });
});

/* ================= STATIC PUBLIC ASSETS ================= */
app.use('/public', express.static(path.join(__dirname, 'public')));

/* ================= ORDER INSTRUCTIONS PAGE ================= */
const QRCode = require('qrcode');
app.get('/order', async (req, res) => {
  const orderUrl = `${process.env.FRONTEND_URL || 'https://fe-2n6s.onrender.com'}/customer/login`;
  const qrDataUrl = await QRCode.toDataURL(orderUrl, {
    width: 180, margin: 1,
    color: { dark: '#dd3a00', light: '#ffffff' },
  });
  const html = fs.readFileSync(path.join(__dirname, 'public', 'order-instructions.html'), 'utf8');
  res.setHeader('Content-Type', 'text/html');
  res.send(html.replace('__QR_DATA_URL__', qrDataUrl).replace('__ORDER_URL__', orderUrl));
});


/* ================= PRIVACY POLICY PAGE ================= */
app.get("/privacy-policy", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Privacy Policy — Mirchi Mafiya</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 24px; }
    .card { background: #fff; border-radius: 16px; padding: 40px; max-width: 720px; margin: 0 auto; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .logo { font-size: 2rem; margin-bottom: 8px; }
    h1 { font-size: 1.6rem; font-weight: 800; color: #1a1a1a; margin-bottom: 4px; }
    .updated { font-size: 0.85rem; color: #aaa; margin-bottom: 28px; }
    h2 { font-size: 1rem; font-weight: 700; color: #dd3a00; margin: 24px 0 8px; }
    p, li { font-size: 0.92rem; color: #444; line-height: 1.7; margin-bottom: 8px; }
    ul { padding-left: 20px; margin-bottom: 8px; }
    a { color: #dd3a00; }
    .footer { text-align: center; margin-top: 32px; font-size: 0.82rem; color: #aaa; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🌶️</div>
    <h1>Privacy Policy</h1>
    <p class="updated">Last updated: May 2026</p>

    <p>Mirchi Mafiya ("we", "our", or "us") is committed to protecting your privacy. This policy explains how we collect, use, and protect your personal information when you use our mobile app.</p>

    <h2>1. Information We Collect</h2>
    <ul>
      <li>Name, email address, and phone number (when you register)</li>
      <li>Order history and preferences</li>
      <li>Device push notification token (for order status alerts)</li>
      <li>Payment information (processed securely by our payment provider — we do not store card details)</li>
    </ul>

    <h2>2. How We Use Your Information</h2>
    <ul>
      <li>To process and manage your food orders</li>
      <li>To send you order status notifications</li>
      <li>To manage your account and preferences</li>
      <li>To improve our service</li>
    </ul>

    <h2>3. Data Sharing</h2>
    <p>We do not sell or share your personal data with third parties except as necessary to process payments and deliver our service.</p>

    <h2>4. Data Security</h2>
    <p>All data is transmitted over HTTPS and stored securely. Passwords are hashed and never stored in plain text.</p>

    <h2>5. Data Retention</h2>
    <p>We retain your data for as long as your account is active. Anonymised transaction records may be kept for up to 7 years for legal and financial compliance.</p>

    <h2>6. Your Rights</h2>
    <p>You have the right to access, correct, or delete your personal data. To request account and data deletion, visit our <a href="/delete-account">Delete Account page</a> or email us at <a href="mailto:mirchimafiyarestaurant@gmail.com">mirchimafiyarestaurant@gmail.com</a>.</p>

    <h2>7. Contact Us</h2>
    <p>If you have any questions about this privacy policy, contact us at:<br />
    📧 <a href="mailto:mirchimafiyarestaurant@gmail.com">mirchimafiyarestaurant@gmail.com</a></p>

    <p class="footer">Mirchi Mafiya · mirchimafiyarestaurant@gmail.com</p>
  </div>
</body>
</html>`);
});

/* ================= DELETE ACCOUNT PAGE ================= */
app.get("/delete-account", (req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Delete Account — Mirchi Mafiya</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: #fff; border-radius: 16px; padding: 40px; max-width: 520px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .logo { font-size: 2rem; margin-bottom: 8px; }
    h1 { font-size: 1.5rem; font-weight: 800; color: #1a1a1a; margin-bottom: 8px; }
    .sub { color: #666; font-size: 0.95rem; margin-bottom: 28px; line-height: 1.5; }
    .steps { background: #fff8f5; border-radius: 10px; padding: 20px; margin-bottom: 24px; border-left: 4px solid #dd3a00; }
    .steps h2 { font-size: 0.95rem; font-weight: 700; color: #dd3a00; margin-bottom: 12px; }
    .steps ol { padding-left: 18px; color: #444; font-size: 0.9rem; line-height: 2; }
    .info { background: #fff0f0; border-radius: 10px; padding: 16px; margin-bottom: 24px; font-size: 0.88rem; color: #555; line-height: 1.6; }
    .info strong { color: #dd3a00; }
    .btn { display: block; width: 100%; padding: 14px; background: #dd3a00; color: #fff; text-align: center; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 1rem; }
    .btn:hover { background: #c43200; }
    .footer { text-align: center; margin-top: 16px; font-size: 0.82rem; color: #aaa; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🌶️</div>
    <h1>Delete Your Account</h1>
    <p class="sub">You can request deletion of your Mirchi Mafiya account and all associated data by emailing us.</p>

    <div class="steps">
      <h2>How to request account deletion</h2>
      <ol>
        <li>Send an email to <strong>mirchimafiyarestaurant@gmail.com</strong></li>
        <li>Use subject line: <strong>Account Deletion Request</strong></li>
        <li>Include the email address linked to your account</li>
        <li>We will process your request within <strong>7 days</strong></li>
      </ol>
    </div>

    <div class="info">
      <strong>Data that will be deleted:</strong> your name, email, phone number, address, order history, and saved favourites.<br /><br />
      <strong>Data that may be retained:</strong> anonymised transaction records required for legal/financial compliance (up to 7 years).
    </div>

    <a class="btn" href="mailto:mirchimafiyarestaurant@gmail.com?subject=Account%20Deletion%20Request">
      📧 Email Us to Delete Account
    </a>
    <p class="footer">Mirchi Mafiya · mirchimafiyarestaurant@gmail.com</p>
  </div>
</body>
</html>`);
});

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

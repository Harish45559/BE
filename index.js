const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const db = require('./config/db');
const { Admin } = require('./models');
const path = require('path');
const fs = require('fs');

dotenv.config();
const app = express();

// ✅ Allowed frontend origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://fe-2n6s.onrender.com' // your deployed frontend
];

// ✅ CORS (handles preflight + headers correctly)
const corsOptions = {
  origin(origin, cb) {
    // allow same-origin / server-to-server (no Origin) and the whitelisted fronts
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  optionsSuccessStatus: 204
};

// must be BEFORE routes
app.use(cors(corsOptions));
// respond to preflight for all routes
app.options('*', cors(corsOptions));

// ✅ Body parser
app.use(express.json());

// ✅ Import routes
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const reportRoutes = require('./routes/reportRoutes');
const orderRoutes = require('./routes/orderRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const menuRoutes = require('./routes/menuRoutes');
const salesRoutes = require('./routes/salesRoutes');

// ✅ Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/sales', require('./routes/salesRoutes'));  // ✅ IMPORTANT

// ✅ Serve React build only if it exists (for single-repo deploys)
const distPath = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ✅ Sync DB and start server
db.sync({ force: false }).then(async () => {
  console.log('✅ PostgreSQL synced');

  const defaultPassword = 'newSecure123';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const [adminUser, created] = await Admin.findOrCreate({
    where: { username: 'admin' },
    defaults: { password: hashedPassword }
  });

  if (!created) {
    adminUser.password = hashedPassword;
    await adminUser.save();
    console.log('🔁 Admin password updated (hashed)');
  } else {
    console.log('✅ Admin user created');
  }

  const PORT = process.env.PORT || 5000;

  // simple health/test route
  app.get('/api/reports/test', (req, res) => {
    res.send('✅ Direct reports test route reached.');
  });

  app.listen(PORT, () => {
    console.log(`🚀 Backend live at: https://be-i5z1.onrender.com`);
  });
}).catch(err => {
  console.error('❌ Failed to sync DB or start server:', err);
});

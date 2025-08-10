const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const db = require('./config/db');
const { Admin } = require('./models');
const path = require('path')

dotenv.config();
const app = express();

// ✅ Allowed frontend origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://fe-2n6s.onrender.com' // your deployed frontend
];

// ✅ CORS middleware
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// ✅ Preflight headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

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
app.use(express.static(path.join(__dirname, 'client', 'dist')));


app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

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

  app.get('/api/reports/test', (req, res) => {
  res.send('✅ Direct reports test route reached.');
});

  app.listen(PORT, () => {
    console.log(`🚀 Backend live at: https://be-i5z1.onrender.com`);
  });
}).catch(err => {
  console.error('❌ Failed to sync DB or start server:', err);
});

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./config/db');
const { Admin } = require('./models');

dotenv.config();
const app = express();

// ✅ FIXED: Allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  'https://fe-2n6s.onrender.com'
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

// ✅ Allow preflight responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

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

// ✅ Register routes
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/sales', salesRoutes);

// ✅ Sync DB and Start server
db.sync({ force: false }).then(async () => {
  console.log('✅ PostgreSQL synced');

  const [adminUser, created] = await Admin.findOrCreate({
    where: { username: 'admin' },
    defaults: { password: 'H@rish45559' }
  });

  if (!created) {
    adminUser.password = 'H@rish45559';
    await adminUser.save();
    console.log('🔁 Admin password updated');
  } else {
    console.log('✅ Admin user created');
  }

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Backend live at: https://be-i5z1.onrender.com`);
  });
}).catch(err => {
  console.error('❌ Failed to sync DB or start server:', err);
});

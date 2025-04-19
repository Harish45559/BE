const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./config/db');
const { Admin } = require('./models');

dotenv.config();

const app = express();

// ✅ Allow both deployed and local frontend
const allowedOrigins = [
  'https://fe-nb3e.onrender.com',
  'http://localhost:5173'
];

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

app.use(express.json());

// ✅ Route imports
const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const reportRoutes = require('./routes/reportRoutes');
const orderRoutes = require('./routes/orderRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const menuRoutes = require('./routes/menuRoutes');
const salesRoutes = require('./routes/salesRoutes');

// ✅ Register all routes with /api prefix
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/sales', salesRoutes);

// ✅ DB Sync and Server Start
db.sync({ force: false }).then(async () => {
  console.log('✅ PostgreSQL synced');

  const [adminUser, created] = await Admin.findOrCreate({
    where: { username: 'admin' },
    defaults: { password: 'H@rish45559' },
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
    console.log(`🚀 Backend live at: https://be-q39a.onrender.com`);
  });
}).catch(err => {
  console.error('❌ Failed to sync DB or start server:', err);
});

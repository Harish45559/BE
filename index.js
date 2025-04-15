const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./config/db');
const { Admin } = require('./models');

// ✅ Route imports
const authRoutes = require('./routes/authRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const reportRoutes = require('./routes/reportRoutes');
const orderRoutes = require('./routes/orderRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const menuRoutes = require('./routes/menuRoutes');
const salesRoutes = require('./routes/salesRoutes');

dotenv.config();

const app = express();

// ✅ CORS configuration for frontend hosted on Render
app.use(cors({
  origin: 'https://fe-nb3e.onrender.com', // ✅ Your frontend live link
  credentials: true
}));

app.use(express.json());

// ✅ Register routes
app.use('/api', authRoutes);
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

  await Admin.findOrCreate({
    where: { username: 'admin' },
    defaults: { password: 'H@rish45559' },
  });

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Backend live at: https://be-q39a.onrender.com`);
  });
}).catch(err => {
  console.error('❌ Failed to sync DB or start server:', err);
});

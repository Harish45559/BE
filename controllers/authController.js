const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Employee, Admin } = require('../models');

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    let user = null;
    let role = null;

    // 🔍 First try Admin
    const admin = await Admin.findOne({ where: { username } });
    if (admin) {
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid password' });
      }

      user = admin;
      role = 'admin';
    } else {
      // 🔍 Then try Employee
      const employee = await Employee.findOne({ where: { username } });
      if (employee) {
        const isMatch = await bcrypt.compare(password, employee.password);
        if (!isMatch) {
          return res.status(401).json({ success: false, message: 'Invalid password' });
        }

        user = employee;
        role = 'employee';
      }
    }

    // ❌ If neither found
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    // ✅ Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      'your_jwt_secret',
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      success: true,
      token,
      username: user.username,
      role,
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ Secure forgot password handler
exports.forgotPassword = async (req, res) => {
  const { username, newPassword } = req.body;

  if (!username || !newPassword) {
    return res.status(400).json({ message: 'Username and new password are required' });
  }

  try {
    let user = await Admin.findOne({ where: { username } });
    if (user) {
      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();
      return res.json({ message: 'Admin password updated successfully' });
    }

    user = await Employee.findOne({ where: { username } });
    if (user) {
      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();
      return res.json({ message: 'Employee password updated successfully' });
    }

    res.status(404).json({ message: 'User not found' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

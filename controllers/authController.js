const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const { Employee, Admin } = require('../models');


exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    let user = await Employee.findOne({ where: { username } });
    if (!user) {
      user = await Admin.findOne({ where: { username } });
      if (!user) return res.status(401).json({ success: false, message: 'User not found' });

      if (user.password !== password) {
        return res.status(401).json({ success: false, message: 'Invalid password' });
      }
    } else {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid password' });
    }

    return res.json({ success: true, username: user.username });

  } catch (err) {
    console.error('Login error:', err);
    return res.json({ success: true, token,username: user.username, role: user.role});
    
  }
};




// 🔐 Forgot Password: searches both Admin and Employee tables

exports.forgotPassword = async (req, res) => {
  const { username, newPassword } = req.body;

  if (!username || !newPassword) {
    return res.status(400).json({ message: 'Username and new password are required' });
  }

  try {
    let user = await Admin.findOne({ where: { username } });
    if (user) {
      user.password = newPassword;
      await user.save();
      return res.json({ message: 'Admin password updated successfully' });
    }

    user = await Employee.findOne({ where: { username } });
    if (user) {
      user.password = await bcrypt.hash(newPassword, 10); // ✅ hash before saving
      await user.save();
      return res.json({ message: 'Employee password updated successfully' });
    }

    res.status(404).json({ message: 'User not found' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


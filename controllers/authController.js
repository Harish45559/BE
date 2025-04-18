const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Admin, Employee } = require('../models'); // ✅ Already gives you Employee



exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    // Try Admin (plain text comparison)
    let user = await Admin.findOne({ where: { username } });
    let role = 'admin';

    if (user && user.password !== password) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // Try Employee (bcrypt comparison)
    if (!user) {
      user = await Employee.findOne({ where: { username } });
      role = 'employee';

      if (!user) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid password' });
      }
    }

    const token = jwt.sign({ id: user.id, role }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, role });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
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

// Verify PIN for employee login
exports.verifyPin = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await Employee.findOne({ where: { username } });

    if (!user) {
      return res.status(401).json({ message: 'Invalid username' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    return res.json({
      success: true,
      role: user.role,
      user: {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Verify PIN error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
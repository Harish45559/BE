const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { Employee } = require("../models");

// 🔐 Generate token
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" },
  );
};

// ✅ LOGIN
exports.login = async (req, res) => {
  try {
    let { username, password } = req.body || {};

    username = username?.trim();

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password required",
      });
    }

    const user = await Employee.findOne({ where: { username } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      token,
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

// 🔐 FORGOT PASSWORD (SAFE VERSION)
exports.forgotPassword = async (req, res) => {
  try {
    let { username, newPassword } = req.body || {};

    username = username?.trim();

    // 🚫 BLOCK ADMIN RESET
    if (username === "admin") {
      return res.status(403).json({
        message: "Admin reset not allowed",
      });
    }

    if (!username || !newPassword) {
      return res.status(400).json({
        message: "Username and new password required",
      });
    }

    const user = await Employee.findOne({ where: { username } });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // ✅ Let model handle hashing
    user.password = newPassword;

    await user.save();

    return res.status(200).json({
      message: "Password updated successfully",
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

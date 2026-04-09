const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { Employee, Admin } = require("../models");

// Utility: generate token
const generateToken = (user, role) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" },
  );
};

// ✅ Improved Login
exports.login = async (req, res) => {
  try {
    let { username, password } = req.body || {};

    // Normalize inputs
    username = username?.trim();

    // Field-level validation
    const errors = {};
    if (!username) errors.username = "Username is required";
    if (!password) errors.password = "Password is required";

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    let user = null;
    let role = null;

    // Admin check
    const admin = await Admin.findOne({ where: { username } });
    if (admin) {
      const isMatch = await bcrypt.compare(password, admin.password);
      if (isMatch) {
        user = admin;
        role = "admin";
      }
    }

    // Employee check
    if (!user) {
      const employee = await Employee.findOne({ where: { username } });
      if (employee) {
        const isMatch = await bcrypt.compare(password, employee.password);
        if (isMatch) {
          user = employee;
          role = "employee";
        }
      }
    }

    // ✅ Prevent user enumeration
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = generateToken(user, role);

    return res.status(200).json({
      success: true,
      token,
      username: user.username,
      role,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ✅ Secure Forgot Password (basic version)
exports.forgotPassword = async (req, res) => {
  try {
    let { username, newPassword } = req.body || {};

    username = username?.trim();

    const errors = {};
    if (!username) errors.username = "Username is required";
    if (!newPassword) errors.newPassword = "New password is required";

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    let user = await Admin.findOne({ where: { username } });
    if (!user) {
      user = await Employee.findOne({ where: { username } });
    }

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // ⚠️ NOTE: In real systems, require OTP/email verification here
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({
      message: "Password updated successfully",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({
      message: "Server error",
    });
  }
};

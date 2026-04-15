const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { Customer } = require("../models");

const RESET_SECRET = process.env.CUSTOMER_JWT_SECRET + "_reset";

const generateToken = (customer) => {
  return jwt.sign(
    {
      id: customer.id,
      email: customer.email,
      type: "customer",
    },
    process.env.CUSTOMER_JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// POST /api/customer/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, phone, address_line1, city, postcode, password } =
      req.body || {};

    // Check duplicate email
    const existing = await Customer.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const customer = await Customer.create({
      name,
      email,
      phone,
      address_line1,
      city,
      postcode,
      password,
    });

    const token = generateToken(customer);

    return res.status(201).json({
      success: true,
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address_line1: customer.address_line1,
        city: customer.city,
        postcode: customer.postcode,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Customer register error:", err.message);
    }
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/customer/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const customer = await Customer.findOne({ where: { email } });

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, customer.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const token = generateToken(customer);

    return res.status(200).json({
      success: true,
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address_line1: customer.address_line1,
        city: customer.city,
        postcode: customer.postcode,
      },
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Customer login error:", err.message);
    }
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/customer/auth/list  (staff only — requires staff authMiddleware)
exports.listCustomers = async (req, res) => {
  try {
    const customers = await Customer.findAll({
      attributes: ["id", "name", "email", "phone", "address_line1", "city", "postcode", "created_at"],
      order: [["created_at", "DESC"]],
    });
    return res.status(200).json({ success: true, customers });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch customers" });
  }
};

// POST /api/customer/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const customer = await Customer.findOne({ where: { email } });

    // Always respond the same way — don't reveal whether email exists
    if (!customer) {
      return res.status(200).json({
        success: true,
        message: "If that email is registered, a reset link has been generated.",
      });
    }

    // Generate a short-lived reset JWT (1 hour)
    const resetToken = jwt.sign(
      { id: customer.id, email: customer.email, purpose: "reset" },
      RESET_SECRET,
      { expiresIn: "1h" }
    );

    // In production: email the link to the customer
    // For now we return the token so the frontend can redirect directly
    return res.status(200).json({
      success: true,
      message: "Password reset link has been generated.",
      resetToken,  // frontend uses this to build /customer/reset-password?token=...
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/customer/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (!token || !password) {
      return res.status(400).json({ success: false, message: "Token and password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters" });
    }

    let payload;
    try {
      payload = jwt.verify(token, RESET_SECRET);
    } catch {
      return res.status(400).json({ success: false, message: "Reset link has expired or is invalid" });
    }

    if (payload.purpose !== "reset") {
      return res.status(400).json({ success: false, message: "Invalid reset token" });
    }

    const customer = await Customer.findByPk(payload.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }

    customer.password = password; // beforeUpdate hook hashes it
    await customer.save();

    return res.status(200).json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/customer/auth/me  (requires customerAuthMiddleware)
exports.me = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.customer.id, {
      attributes: ["id", "name", "email", "phone", "address_line1", "city", "postcode", "created_at"],
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    return res.status(200).json({ success: true, customer });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

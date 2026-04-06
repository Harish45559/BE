// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const authController = require("../controllers/authController");

// Rate limiter for login — max 10 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for forgot-password
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    error: "Too many password reset attempts, please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation for /login
const validateLogin = [
  body("username").notEmpty().trim().withMessage("Username is required"),
  body("password").notEmpty().withMessage("Password is required"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

// Validation for /forgot-password
const validateForgotPassword = [
  body("username").notEmpty().trim().withMessage("Username is required"),
  body("newPassword").notEmpty().withMessage("New password is required"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

router.post("/login", authLimiter, validateLogin, authController.login);
router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  validateForgotPassword,
  authController.forgotPassword,
);

module.exports = router;

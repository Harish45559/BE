const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
const customerAuthController = require("../controllers/customerAuthController");
const customerAuthMiddleware = require("../middleware/customerAuth");
const staffAuthMiddleware = require("../middleware/auth");

const isTest = process.env.NODE_ENV === "test";

const authLimiter = isTest
  ? (_req, _res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: { error: "Too many requests, please try again later" },
      standardHeaders: true,
      legacyHeaders: false,
    });

// Validation middleware helper
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

const validateRegister = [
  body("name").notEmpty().trim().withMessage("Name is required"),
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("phone").notEmpty().trim().withMessage("Phone number is required"),
  body("address_line1").notEmpty().trim().withMessage("Address line 1 is required"),
  body("city").notEmpty().trim().withMessage("City is required"),
  body("postcode").notEmpty().trim().withMessage("Postcode is required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
  validate,
];

const validateLogin = [
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
  validate,
];

// Public routes
router.post("/register", authLimiter, validateRegister, customerAuthController.register);
router.post("/login", authLimiter, validateLogin, customerAuthController.login);
router.post("/forgot-password", authLimiter, customerAuthController.forgotPassword);
router.post("/reset-password", customerAuthController.resetPassword);

// Protected route — customer must be logged in
router.get("/me", customerAuthMiddleware, customerAuthController.me);

// Staff-only route — list all customers
router.get("/list", staffAuthMiddleware, customerAuthController.listCustomers);

module.exports = router;

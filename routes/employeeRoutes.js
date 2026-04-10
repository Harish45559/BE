const express = require("express");
const router = express.Router();

const {
  listEmployees,
  addEmployee,
  editEmployee,
  deleteEmployee,
  getMyProfile, // 👈 added
} = require("../controllers/employeeController");

const authMiddleware = require("../middleware/auth");
const { requireAdmin } = require("../middleware/role");

// 🔐 All routes require login
router.use(authMiddleware);

// 👤 Logged-in user can view own profile
router.get("/me", getMyProfile);

// 📋 Admin-only: view all employees
router.get("/", requireAdmin, listEmployees);

// 🔒 Admin-only routes
router.post("/", requireAdmin, addEmployee);
router.put("/:id", requireAdmin, editEmployee);
router.delete("/:id", requireAdmin, deleteEmployee);

module.exports = router;

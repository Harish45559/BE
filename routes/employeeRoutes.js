const express = require("express");
const router = express.Router();

const {
  listEmployees,
  addEmployee,
  editEmployee,
  deleteEmployee,
} = require("../controllers/employeeController");

const authMiddleware = require("../middleware/auth");

// 🔒 Apply auth to ALL routes in this file
router.use(authMiddleware);

// 📌 Routes
router.get("/", listEmployees);
router.post("/", addEmployee);
router.put("/:id", editEmployee);
router.delete("/:id", deleteEmployee);

module.exports = router;

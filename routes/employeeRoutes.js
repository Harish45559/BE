const express = require('express');
const router = express.Router();
const {
  addEmployee,
  listEmployees,
  editEmployee,
  deleteEmployee
} = require('../controllers/employeeController'); // <-- this is important

// Routes
router.get('/', listEmployees);         // ✅ List employees
router.post('/', addEmployee);          // ✅ Add employee
router.put('/:id', editEmployee);       // ✅ Edit employee
router.delete('/:id', deleteEmployee);  // ✅ Delete employee

module.exports = router;

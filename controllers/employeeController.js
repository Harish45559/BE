// ✅ employeeController.js (Controller)
const { Employee, Attendance } = require('../models');

exports.addEmployee = async (req, res) => {
  try {
    const data = req.body;

    if (!data.password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const newEmp = await Employee.create({ ...data });
    res.status(201).json({ message: 'Employee added', employee: newEmp });
  } catch (err) {
    console.error('❌ Add Employee Error:', err.message);
    res.status(500).json({ error: 'Server error while adding employee' });
  }
};

exports.listEmployees = async (req, res) => {
  try {
    const employees = await Employee.findAll();
    res.json(employees);
  } catch (err) {
    console.error('List Employees Error:', err);
    res.status(500).json({ error: 'Error fetching employees' });
  }
};

exports.editEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Not found' });

    const dataToUpdate = { ...req.body };
    await employee.update(dataToUpdate);

    res.json({ message: 'Employee updated', employee });
  } catch (err) {
    console.error('Update Error:', err.message);
    res.status(500).json({ error: 'Error updating employee' });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    await Attendance.destroy({ where: { employee_id: employee.id } });
    await employee.destroy();

    res.json({ message: 'Employee deleted' });
  } catch (err) {
    console.error('Delete Employee Error:', err);
    res.status(500).json({ error: 'Error deleting employee' });
  }
};

exports.getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Not found' });
    res.json(employee);
  } catch (err) {
    console.error('Get Employee Error:', err);
    res.status(500).json({ error: 'Error fetching employee' });
  }
};
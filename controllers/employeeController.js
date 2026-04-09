const { Employee, Attendance } = require("../models");

// 🔥 Validation helper (FIELD-LEVEL)
const validateEmployee = (data, isEdit = false) => {
  const {
    first_name,
    last_name,
    username,
    password,
    email,
    phone,
    address,
    gender,
    dob,
    joining_date,
    brp,
    pin,
  } = data;

  const errors = {};

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[6-9]\d{9}$/;
  const pinRegex = /^\d{4}$/;
  const passwordRegex = /^.{6,}$/;

  if (!isEdit) {
    if (!first_name) errors.first_name = "First name is required";
    if (!last_name) errors.last_name = "Last name is required";
    if (!username) errors.username = "Username is required";
    if (!email) errors.email = "Email is required";
    if (!phone) errors.phone = "Phone number is required";
    if (!address) errors.address = "Address is required";
    if (!gender) errors.gender = "Gender is required";
    if (!dob) errors.dob = "Date of birth is required";
    if (!joining_date) errors.joining_date = "Joining date is required";
    if (!brp) errors.brp = "BRP is required";
  }

  if (!isEdit && !password) {
    errors.password = "Password is required";
  }

  // ✅ Format validations
  if (email && !emailRegex.test(email)) {
    errors.email = "Invalid email address";
  }

  if (phone && !phoneRegex.test(phone)) {
    errors.phone = "Invalid phone number";
  }

  if (data.pin !== undefined && !pinRegex.test(data.pin)) {
    errors.pin = "PIN must be 4 digits";
  }

  if (!isEdit && password && !passwordRegex.test(password)) {
    errors.password = "Password must be at least 6 characters";
  }

  if (joining_date && new Date(joining_date) > new Date()) {
    errors.joining_date = "Joining date cannot be in the future";
  }

  return Object.keys(errors).length > 0 ? errors : null;
};

// ➕ Add Employee
exports.addEmployee = async (req, res) => {
  try {
    const data = req.body;

    const errors = validateEmployee(data, false);
    if (errors) {
      return res.status(400).json({ errors });
    }

    // ✅ Duplicate checks
    const existingEmail = await Employee.findOne({
      where: { email: data.email },
    });
    if (existingEmail) {
      return res.status(400).json({
        errors: { email: "Email already exists" },
      });
    }

    const existingUsername = await Employee.findOne({
      where: { username: data.username },
    });
    if (existingUsername) {
      return res.status(400).json({
        errors: { username: "Username already exists" },
      });
    }

    const newEmp = await Employee.create({ ...data });

    const { password: _p, pin: _pin, ...safeEmp } = newEmp.toJSON();
    res.status(201).json({
      message: "Employee added successfully",
      employee: safeEmp,
    });
  } catch (err) {
    console.error("❌ Add Employee Error:", err.message);
    res.status(500).json({ error: "Server error while adding employee" });
  }
};

// 📋 List Employees
exports.listEmployees = async (req, res) => {
  try {
    const employees = await Employee.findAll({
      attributes: { exclude: ["password", "pin"] }, // 🔒 security fix
    });

    res.json(employees);
  } catch (err) {
    console.error("List Employees Error:", err);
    res.status(500).json({ error: "Error fetching employees" });
  }
};

// ✏️ Edit Employee
exports.editEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    const dataToUpdate = { ...req.body };

    const errors = validateEmployee(dataToUpdate, true);

    if (errors) {
      return res.status(400).json({ errors });
    }

    // ✅ Duplicate email check
    if (dataToUpdate.email) {
      const existingEmail = await Employee.findOne({
        where: { email: dataToUpdate.email },
      });

      if (existingEmail && existingEmail.id !== employee.id) {
        return res.status(400).json({
          errors: { email: "Email already exists" },
        });
      }
    }

    if (dataToUpdate.pin !== undefined) {
      if (!/^\d{4}$/.test(dataToUpdate.pin)) {
        return res.status(400).json({
          errors: { pin: "PIN must be 4 digits" },
        });
      }
    }

    // ✅ Duplicate username check
    if (dataToUpdate.username) {
      const existingUsername = await Employee.findOne({
        where: { username: dataToUpdate.username },
      });

      if (existingUsername && existingUsername.id !== employee.id) {
        return res.status(400).json({
          errors: { username: "Username already exists" },
        });
      }
    }

    // ✅ Prevent empty password overwrite
    if (!dataToUpdate.password) {
      delete dataToUpdate.password;
    }

    await employee.update(dataToUpdate);
    await employee.reload();

    const { password: _p, pin: _pin, ...safeEmp } = employee.toJSON();
    res.json({
      message: "Employee updated successfully",
      employee: safeEmp,
    });
  } catch (err) {
    console.error("Update Error:", err.message);
    res.status(500).json({ error: "Error updating employee" });
  }
};

// ❌ Delete Employee
exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id);

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    await Attendance.destroy({ where: { employee_id: employee.id } });
    await employee.destroy();

    res.json({ message: "Employee deleted successfully" });
  } catch (err) {
    console.error("Delete Employee Error:", err);
    res.status(500).json({ error: "Error deleting employee" });
  }
};

// 🔍 Get Single Employee
exports.getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByPk(req.params.id, {
      attributes: { exclude: ["password", "pin"] }, // 🔒 security fix
    });

    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json(employee);
  } catch (err) {
    console.error("Get Employee Error:", err);
    res.status(500).json({ error: "Error fetching employee" });
  }
};

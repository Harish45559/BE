const bcrypt = require("bcryptjs");
const { Customer } = require("../models");

// PUT /api/customer/profile
// Update name, phone, address fields
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, address_line1, city, postcode } = req.body || {};

    const customer = await Customer.findByPk(req.customer.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // Only update fields that were sent
    if (name !== undefined) customer.name = name.trim();
    if (phone !== undefined) customer.phone = phone.trim();
    if (address_line1 !== undefined) customer.address_line1 = address_line1.trim();
    if (city !== undefined) customer.city = city.trim();
    if (postcode !== undefined) customer.postcode = postcode.trim();

    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
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
      console.error("Profile update error:", err.message);
    }
    return res.status(500).json({ success: false, message: "Failed to update profile" });
  }
};

// PUT /api/customer/profile/password
// Change password — requires current password for verification
exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: "current_password and new_password are required",
      });
    }

    if (new_password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    const customer = await Customer.findByPk(req.customer.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const isMatch = await bcrypt.compare(current_password, customer.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    customer.password = new_password; // beforeUpdate hook hashes it automatically
    await customer.save();

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Change password error:", err.message);
    }
    return res.status(500).json({ success: false, message: "Failed to change password" });
  }
};

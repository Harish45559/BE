const { Category } = require("../models");

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.findAll();
    res.json(categories);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }
    const category = await Category.create({ name });
    res.json(category);
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ error: "Category already exists" });
    }
    res.status(500).json({ error: "Failed to create category" });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({ error: "Category name is required" });
    }
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json({ error: "Category not found" });
    await category.update({ name });
    res.json(category);
  } catch (err) {
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ error: "Category already exists" });
    }
    res.status(500).json({ error: "Failed to update category" });
  }
};
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // 🔒 Prevent delete if menu items exist under this category
    const { MenuItem } = require("../models");
    const itemCount = await MenuItem.count({
      where: { categoryId: req.params.id },
    });
    if (itemCount > 0) {
      return res.status(400).json({
        error: `Cannot delete — ${itemCount} menu item(s) are using this category`,
      });
    }

    await category.destroy();
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("Error deleting category:", err);
    res.status(500).json({ error: "Failed to delete category" });
  }
};

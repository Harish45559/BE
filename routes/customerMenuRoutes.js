const express = require("express");
const router = express.Router();
const { MenuItem, Category } = require("../models");

// GET /api/customer/menu
// Public — no auth required. Returns all available menu items grouped by category.
router.get("/", async (req, res) => {
  try {
    const { category_id } = req.query;

    const whereClause = {};
    if (category_id) {
      whereClause.categoryId = parseInt(category_id);
    }

    const items = await MenuItem.findAll({
      where: whereClause,
      attributes: ["id", "name", "price", "is_veg", "image_url", "categoryId", "available"],
      include: [
        { model: Category, as: "category", attributes: ["id", "name"] },
      ],
      order: [["categoryId", "ASC"], ["name", "ASC"]],
    });

    return res.status(200).json({ success: true, items });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("Customer menu fetch error:", err.message);
    }
    return res.status(500).json({ success: false, message: "Failed to fetch menu" });
  }
});

// GET /api/customer/menu/categories
// Public — returns all categories (useful for filter tabs on frontend)
router.get("/categories", async (req, res) => {
  try {
    const categories = await Category.findAll({
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
    });
    return res.status(200).json({ success: true, categories });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch categories" });
  }
});

module.exports = router;

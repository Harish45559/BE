const express = require("express");
const router = express.Router();
const { Op } = require("sequelize");
const { DateTime } = require("luxon");
const { MenuItem, Category, TimeSlotSettings } = require("../models");

// Items always visible during breakfast even if not in Breakfast category
const BREAKFAST_ALWAYS_VISIBLE = [
  "water", "tea", "coffee", "horlicks", "boost",
  "malai bun", "maska bun", "gulab jamun",
  "chai", "small chai", "medium chai", "large chai",
];

// GET /api/customer/menu
// Public — filters menu by current time window (breakfast vs dinner)
router.get("/", async (req, res) => {
  try {
    const { category_id } = req.query;

    // Determine current UK time window
    const now = DateTime.now().setZone("Europe/London");
    const settings = await TimeSlotSettings.findByPk(1);
    const bOpen  = settings?.breakfast_opening_time  || "09:00";
    const bClose = settings?.breakfast_closing_time  || "12:00";
    const dOpen  = settings?.opening_time            || "17:15";
    const dClose = settings?.closing_time            || "22:45";

    const toMins = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const nowMins = now.hour * 60 + now.minute;

    // Build where clause
    const whereClause = { available: true };
    if (category_id) whereClause.categoryId = parseInt(category_id);

    // Show breakfast menu only from 00:00 until breakfast closes (11:45am)
    // After that — full menu all day
    const breakfastOnly = nowMins < toMins(bClose);
    if (breakfastOnly) {
      const breakfastCat = await Category.findOne({ where: { name: { [Op.iLike]: "breakfast" } } });
      whereClause[Op.or] = [
        ...(breakfastCat ? [{ categoryId: breakfastCat.id }] : []),
        { name: { [Op.in]: BREAKFAST_ALWAYS_VISIBLE.map(n => n.charAt(0).toUpperCase() + n.slice(1)) } },
        { name: { [Op.iLike]: { [Op.any]: BREAKFAST_ALWAYS_VISIBLE } } },
      ];
    }
    // After 11:45am — show all available items

    const items = await MenuItem.findAll({
      where: whereClause,
      attributes: ["id", "name", "price", "is_veg", "image_url", "categoryId", "available"],
      include: [{ model: Category, as: "category", attributes: ["id", "name"] }],
      order: [["categoryId", "ASC"], ["name", "ASC"]],
    });

    return res.status(200).json({ success: true, items, window: breakfastOnly ? "breakfast" : "full" });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.error("Customer menu fetch error:", err.message);
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

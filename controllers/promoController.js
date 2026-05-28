const { Op } = require("sequelize");
const PromoCode = require("../models/PromoCode");
const PromoUsage = require("../models/PromoUsage");
const { getIo } = require("../socket");

// ── Shared: calculate discount for a promo against cart items ────────────────
function calculateDiscount(promo, items) {
  let qualifying = items;

  if (promo.applicable_to === "items" && promo.applicable_ids.length > 0) {
    qualifying = items.filter((it) => promo.applicable_ids.includes(it.id));
  } else if (promo.applicable_to === "categories" && promo.applicable_ids.length > 0) {
    qualifying = items.filter((it) => promo.applicable_ids.includes(it.category_id));
  }

  if (qualifying.length === 0 && promo.applicable_to !== "all") {
    return { discount_amount: 0, missingItems: true };
  }

  const cartTotal = items.reduce((s, it) => s + it.price * (it.qty ?? 1), 0);

  let discount_amount = 0;

  if (promo.discount_type === "percentage") {
    // Qualifying items act as a gate — discount applies to full cart total
    discount_amount = parseFloat(((cartTotal * promo.discount_value) / 100).toFixed(2));
  } else if (promo.discount_type === "fixed") {
    discount_amount = parseFloat(Math.min(promo.discount_value, cartTotal).toFixed(2));
  } else if (promo.discount_type === "bogo") {
    const units = [];
    qualifying.forEach((it) => {
      for (let i = 0; i < (it.qty ?? 1); i++) units.push(it.price);
    });
    units.sort((a, b) => a - b);
    const freeCount = Math.floor(units.length / 2);
    discount_amount = parseFloat(units.slice(0, freeCount).reduce((s, p) => s + p, 0).toFixed(2));
  }

  return { discount_amount };
}

// ── Public: GET /api/promos/active ───────────────────────────────────────────
exports.listActive = async (_req, res) => {
  try {
    const promos = await PromoCode.findAll({
      where: {
        active: true,
        [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }],
      },
      attributes: ["code", "description", "discount_type", "discount_value"],
      order: [["created_at", "DESC"]],
    });
    return res.json({ success: true, promos });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to fetch promos" });
  }
};

// ── Customer: POST /api/customer/orders/validate-promo ───────────────────────
exports.validate = async (req, res) => {
  try {
    const { code, items } = req.body;
    if (!code) return res.status(400).json({ success: false, message: "Promo code is required" });

    const promo = await PromoCode.findOne({
      where: { code: code.toUpperCase().trim(), active: true },
    });

    if (!promo) return res.status(404).json({ success: false, message: "Invalid or expired promo code" });

    if (promo.expires_at && new Date() > new Date(promo.expires_at)) {
      return res.status(400).json({ success: false, message: "This promo code has expired" });
    }

    if (promo.max_uses !== null && promo.uses_count >= promo.max_uses) {
      return res.status(400).json({ success: false, message: "This promo code has reached its usage limit" });
    }

    if (promo.per_customer_limit !== null) {
      const used = await PromoUsage.count({
        where: { promo_id: promo.id, customer_id: req.customer.id },
      });
      if (used >= promo.per_customer_limit) {
        return res.status(400).json({ success: false, message: "You have already used this promo code" });
      }
    }

    const cartItems = items || [];
    const cartTotal = cartItems.reduce((s, it) => s + it.price * (it.qty ?? 1), 0);

    if (promo.min_order_value !== null && cartTotal < promo.min_order_value) {
      return res.status(400).json({
        success: false,
        message: `Minimum order of £${promo.min_order_value.toFixed(2)} required for this code`,
      });
    }

    const { discount_amount, missingItems } = calculateDiscount(promo, cartItems);

    if (missingItems) {
      return res.status(400).json({
        success: false,
        message: "Add the required items to your cart to use this promo code",
      });
    }

    return res.json({
      success: true,
      promo_id: promo.id,
      code: promo.code,
      description: promo.description,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      discount_amount,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to validate promo code" });
  }
};

// ── Admin: GET /api/promos ───────────────────────────────────────────────────
exports.list = async (_req, res) => {
  try {
    const promos = await PromoCode.findAll({ order: [["created_at", "DESC"]] });
    return res.json({ success: true, promos });
  } catch (err) {
    console.error("❌ promo list error:", err.message, err.parent?.message);
    return res.status(500).json({ success: false, message: "Failed to fetch promos", detail: err.message });
  }
};

// ── Admin: POST /api/promos ──────────────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const {
      code, description, discount_type, discount_value,
      applicable_to, applicable_ids, min_order_value,
      max_uses, per_customer_limit, active, expires_at,
    } = req.body;

    if (!code) return res.status(400).json({ success: false, message: "Code is required" });

    const promo = await PromoCode.create({
      code,
      description: description || null,
      discount_type: discount_type || "percentage",
      discount_value: parseFloat(discount_value) || 0,
      applicable_to: applicable_to || "all",
      applicable_ids: applicable_ids || [],
      min_order_value: min_order_value ? parseFloat(min_order_value) : null,
      max_uses: max_uses || null,
      per_customer_limit: per_customer_limit || null,
      active: active !== false,
      expires_at: expires_at || null,
    });

    try { getIo().emit("promo:updated"); } catch (_) {}
    return res.status(201).json({ success: true, promo });
  } catch (err) {
    console.error("❌ promo create error:", err.message, err.parent?.message);
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ success: false, message: "A promo with this code already exists" });
    }
    return res.status(500).json({ success: false, message: "Failed to create promo", detail: err.message });
  }
};

// ── Admin: PATCH /api/promos/:id ─────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const promo = await PromoCode.findByPk(req.params.id);
    if (!promo) return res.status(404).json({ success: false, message: "Promo not found" });

    const fields = [
      "description", "discount_type", "discount_value",
      "applicable_to", "applicable_ids", "min_order_value",
      "max_uses", "per_customer_limit", "active", "expires_at",
    ];
    fields.forEach((f) => { if (req.body[f] !== undefined) promo[f] = req.body[f]; });
    await promo.save();
    try { getIo().emit("promo:updated"); } catch (_) {}
    return res.json({ success: true, promo });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to update promo" });
  }
};

// ── Admin: DELETE /api/promos/:id ────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const promo = await PromoCode.findByPk(req.params.id);
    if (!promo) return res.status(404).json({ success: false, message: "Promo not found" });
    await promo.destroy();
    try { getIo().emit("promo:updated"); } catch (_) {}
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to delete promo" });
  }
};

exports.calculateDiscount = calculateDiscount;

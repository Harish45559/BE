const { MenuItem, Category } = require('../models');

/**
 * Helper to coerce incoming values safely
 */
function coerceBool(v) {
  return v === true || v === 'true' || v === 1 || v === '1';
}
function coerceNumber(v) {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

// CREATE
exports.createMenuItem = async (req, res) => {
  try {
    const name = (req.body.name || '').trim();
    const price = coerceNumber(req.body.price);
    const is_veg = coerceBool(req.body.is_veg);
    const categoryId = coerceNumber(req.body.categoryId);

    if (!name || price === undefined) {
      return res.status(400).json({ error: 'name and price are required' });
    }

    const payload = { name, price, is_veg };
    if (categoryId !== undefined) payload.categoryId = categoryId;

    const item = await MenuItem.create(payload);
    res.json(item);
  } catch (err) {
    console.error('Create error:', err);
    res.status(500).json({ error: 'Failed to create item' });
  }
};

// READ (all)
exports.getAllMenuItems = async (_req, res) => {
  try {
    const items = await MenuItem.findAll({
      attributes: ['id', 'name', 'price', 'is_veg', 'categoryId'],
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name'] }
      ],
      order: [['id', 'ASC']],
    });
    res.json(items);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch menu items' });
  }
};

// UPDATE
exports.updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const name = req.body.name !== undefined ? String(req.body.name).trim() : undefined;
    const price = req.body.price !== undefined ? coerceNumber(req.body.price) : undefined;
    const is_veg = req.body.is_veg !== undefined ? coerceBool(req.body.is_veg) : undefined;
    const categoryIdRaw = req.body.categoryId;
    const categoryId = categoryIdRaw !== undefined ? coerceNumber(categoryIdRaw) : undefined;

    const payload = {};
    if (name !== undefined) payload.name = name;
    if (price !== undefined) payload.price = price;
    if (is_veg !== undefined) payload.is_veg = is_veg;
    if (categoryIdRaw !== undefined) {
      if (categoryId === undefined) {
        return res.status(400).json({ error: 'categoryId must be a number if provided' });
      }
      payload.categoryId = categoryId;
    }

    const [updated] = await MenuItem.update(payload, { where: { id } });
    if (updated === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    const fresh = await MenuItem.findByPk(id, {
      attributes: ['id', 'name', 'price', 'is_veg', 'categoryId'],
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
    });
    res.json(fresh);
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
};

// DELETE
exports.deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await MenuItem.destroy({ where: { id } });
    if (!deleted) return res.status(404).json({ error: 'Menu item not found' });
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
};

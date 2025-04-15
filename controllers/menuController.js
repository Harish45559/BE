const { MenuItem, Category } = require('../models');

// ✅ CREATE menu item with correct boolean for is_veg
exports.createMenuItem = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      is_veg: req.body.is_veg === true || req.body.is_veg === 'true' || req.body.is_veg === 1 || req.body.is_veg === '1',
    };
    const item = await MenuItem.create(payload);
    res.json(item);
  } catch (err) {
    console.error('Create error:', err);
    res.status(500).json({ error: 'Failed to create item' });
  }
};

// ✅ GET all items, and expose 'veg' to frontend
exports.getAllMenuItems = async (req, res) => {
  try {
    const items = await MenuItem.findAll({
      include: {
        model: Category,
        as: 'category',
        attributes: ['name'],
      }
    });

    const mapped = items.map(item => ({
      ...item.toJSON(),
      veg: item.is_veg, // 👈 frontend expects this
    }));

    res.json(mapped);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
};

// ✅ UPDATE menu item with correct is_veg logic
exports.updateMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = {
      ...req.body,
      is_veg: req.body.is_veg === true || req.body.is_veg === 'true' || req.body.is_veg === 1 || req.body.is_veg === '1',
    };
    await MenuItem.update(payload, { where: { id } });
    res.json({ message: 'Item updated successfully' });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
};

// ✅ DELETE
exports.deleteMenuItem = async (req, res) => {
  try {
    const { id } = req.params;
    await MenuItem.destroy({ where: { id } });
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
};

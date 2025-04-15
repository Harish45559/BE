const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');

router.post('/', menuController.createMenuItem);
router.get('/', menuController.getAllMenuItems);

// ✅ Add this line for update functionality
router.put('/:id', menuController.updateMenuItem);

// ✅ Also add delete route for safety
router.delete('/:id', menuController.deleteMenuItem);

module.exports = router;

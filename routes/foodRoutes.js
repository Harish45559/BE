const express = require('express');
const router = express.Router();
const foodController = require('../controllers/foodController');

router.get('/', foodController.getMenu);
router.post('/', foodController.addItem); // ✅ Add Item
router.put('/:id', foodController.updateItem);
router.delete('/:id', foodController.deleteItem);

module.exports = router;

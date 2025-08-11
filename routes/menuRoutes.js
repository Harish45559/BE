const express = require('express');
const router = express.Router();
const menu = require('../controllers/menuController');

router.get('/menu', menu.getAllMenuItems);
router.post('/menu', menu.createMenuItem);
router.put('/menu/:id', menu.updateMenuItem);
router.delete('/menu/:id', menu.deleteMenuItem);

module.exports = router;

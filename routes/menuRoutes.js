// server/routes/menuRoutes.js
const express = require('express');
const router = express.Router();
const menu = require('../controllers/menuController');

// IMPORTANT: index.js mounts as app.use('/api/menu', menuRoutes)
// So define routes RELATIVE to that mount: '/', '/:id', etc.
router.get('/', menu.getAllMenuItems);
router.post('/', menu.createMenuItem);
router.put('/:id', menu.updateMenuItem);
router.delete('/:id', menu.deleteMenuItem);

module.exports = router;

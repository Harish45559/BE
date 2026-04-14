const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  generatePager,
  getPagerStatus,
  markReady,
  completeOrder,
} = require('../controllers/pagerController');

// 🔒 Staff: generate a QR pager for an order
router.post('/generate/:orderId', authMiddleware, generatePager);

// 🔒 Staff: mark an order as ready by token
router.put('/mark-ready/:token', authMiddleware, markReady);

// 🔒 Staff: mark all items delivered — stops customer polling
router.put('/complete/:token', authMiddleware, completeOrder);

// 🌐 Public: customer polls this to check status
router.get('/status/:token', getPagerStatus);

module.exports = router;

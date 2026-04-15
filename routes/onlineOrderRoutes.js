const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const onlineOrdersController = require("../controllers/onlineOrdersController");

router.use(authMiddleware);

// GET  /api/orders/online             — all online orders for a date
// GET  /api/orders/online/pending     — only pending orders
// GET  /api/orders/online/status      — online orders enabled/disabled
// PATCH /api/orders/online/:id/accept — accept order + set ready time
// PATCH /api/orders/online/:id/reject — reject order
// PATCH /api/orders/online/toggle     — toggle online ordering on/off
router.get("/status", onlineOrdersController.getOnlineStatus);
router.get("/pending", onlineOrdersController.getPendingOnlineOrders);
router.get("/", onlineOrdersController.getOnlineOrders);
router.patch("/toggle", onlineOrdersController.toggleOnlineOrders);
router.patch("/:id/accept", onlineOrdersController.acceptOrder);
router.patch("/:id/ready", onlineOrdersController.readyOrder);
router.patch("/:id/reject", onlineOrdersController.rejectOrder);
router.patch("/:id/complete", onlineOrdersController.completeOrder);

module.exports = router;

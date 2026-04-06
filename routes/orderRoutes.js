const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const {
  placeOrder,
  getOrdersByDate,
  getSalesSummary,
  getAllOrders,
  holdOrder,
  getHeldOrders,
  deleteHeldOrder,
  clearAllHeldOrders,
} = require("../controllers/orderController");

router.use(authMiddleware); // 🔒 protect all routes

router.post("/", placeOrder);
router.get("/all", getAllOrders);
router.get("/by-date", getOrdersByDate);
router.get("/summary", getSalesSummary);

router.post("/held", holdOrder);
router.get("/held", getHeldOrders);
router.delete("/held/clear-all", clearAllHeldOrders); // ⚠️ must be before /:id
router.delete("/held/:id", deleteHeldOrder);

module.exports = router;

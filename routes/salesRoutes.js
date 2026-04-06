const express = require("express");
const router = express.Router();
const salesController = require("../controllers/salesController");
const authMiddleware = require("../middleware/auth");

router.use(authMiddleware); // 🔒 protect all routes

router.get("/summary", salesController.getSalesSummary);
router.get("/topselling", salesController.getTopSellingItems);
router.get("/totalsales", salesController.getTotalSales);

module.exports = router;

const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const { getTillStatus, openTill, closeTill } = require("../controllers/tillController");

router.use(authMiddleware);

router.get("/status", getTillStatus);
router.post("/open", openTill);
router.post("/close", closeTill);

module.exports = router;

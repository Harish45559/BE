const express = require("express");
const router = express.Router();
const menu = require("../controllers/menuController");
const authMiddleware = require("../middleware/auth");

router.use(authMiddleware);
router.get("/", menu.getAllMenuItems);
router.post("/", menu.createMenuItem);
router.put("/:id", menu.updateMenuItem);
router.delete("/:id", menu.deleteMenuItem);

module.exports = router;

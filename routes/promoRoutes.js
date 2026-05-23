const express = require("express");
const router = express.Router();
const promoController = require("../controllers/promoController");
const staffAuth = require("../middleware/auth");

// Public — used by mobile menu banner
router.get("/active", promoController.listActive);

// Admin routes
router.get("/", staffAuth, promoController.list);
router.post("/", staffAuth, promoController.create);
router.patch("/:id", staffAuth, promoController.update);
router.delete("/:id", staffAuth, promoController.remove);

module.exports = router;

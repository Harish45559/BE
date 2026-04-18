const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const customerAuthMiddleware = require("../middleware/customerAuth");
const customerOrderController = require("../controllers/customerOrderController");
const customerReceiptController = require("../controllers/customerReceiptController");
const customerPaymentController = require("../controllers/customerPaymentController");

// All order routes require customer to be logged in
router.use(customerAuthMiddleware);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

const validateOrder = [
  body("order_type")
    .notEmpty()
    .isIn(["Eat In", "Takeaway"])
    .withMessage("order_type must be 'Eat In' or 'Takeaway'"),
  body("items")
    .isArray({ min: 1 })
    .withMessage("items must be a non-empty array"),
  body("items.*.name").notEmpty().withMessage("Each item must have a name"),
  body("items.*.price").isNumeric().withMessage("Each item must have a valid price"),
  body("items.*.qty").isInt({ min: 1 }).withMessage("Each item must have qty >= 1"),
  body("payment_method")
    .notEmpty()
    .isIn(["Cash", "Pay at Collection", "Card"])
    .withMessage("payment_method must be 'Cash', 'Pay at Collection', or 'Card'"),
  validate,
];

// POST /api/customer/orders           — place a new order
// GET  /api/customer/orders           — get all my orders
// GET  /api/customer/orders/:id       — get a single order
// GET  /api/customer/orders/:id/receipt  — download receipt PDF
// POST /api/customer/orders/:id/pay   — create SumUp checkout
router.post("/", validateOrder, customerOrderController.placeOrder);
router.get("/", customerOrderController.getMyOrders);
router.get("/:id", customerOrderController.getOrderById);
router.get("/:id/receipt", customerReceiptController.downloadReceipt);
router.post("/:id/pay", customerPaymentController.createCheckout);
// router.patch("/:id/confirm-payment", ...) — not needed with SumUp (webhook handles it)

module.exports = router;

const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const customerAuthMiddleware = require("../middleware/customerAuth");
const customerProfileController = require("../controllers/customerProfileController");

router.use(customerAuthMiddleware);

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

const validateProfile = [
  body("name").optional().notEmpty().trim().withMessage("Name cannot be empty"),
  body("phone").optional().notEmpty().trim().withMessage("Phone cannot be empty"),
  body("address_line1").optional().notEmpty().trim().withMessage("Address cannot be empty"),
  body("city").optional().notEmpty().trim().withMessage("City cannot be empty"),
  body("postcode").optional().notEmpty().trim().withMessage("Postcode cannot be empty"),
  validate,
];

const validatePassword = [
  body("current_password").notEmpty().withMessage("Current password is required"),
  body("new_password").isLength({ min: 8 }).withMessage("New password must be at least 8 characters"),
  validate,
];

// PUT /api/customer/profile           — update name, phone, address
// PUT /api/customer/profile/password  — change password
// GET /api/customer/profile/favourites
// POST /api/customer/profile/favourites/toggle/:itemId
router.put("/", validateProfile, customerProfileController.updateProfile);
router.put("/password", validatePassword, customerProfileController.changePassword);
router.get("/favourites", customerProfileController.getFavourites);
router.post("/favourites/toggle/:itemId", customerProfileController.toggleFavourite);

module.exports = router;

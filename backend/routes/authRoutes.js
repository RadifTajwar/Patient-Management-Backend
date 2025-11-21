const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const validate = require("../middlewares/validate").default;
const { body, header } = require("express-validator");
const authenticateToken = require("../middlewares/authenticateToken");

router.post(
  "/register",
  [
    // ✅ Name (letters, spaces, dots)
    body("name")
      .trim()
      .matches(/^[A-Za-z.\s]+$/)
      .withMessage(
        "Name must contain only alphabetic characters, spaces, and dots (e.g. Dr. Radif Tajwar, A. K. M. Rahman)"
      )
      .notEmpty()
      .withMessage("Name is required"),

    // ✅ Email — trimmed + lowercased
    body("email")
      .trim()
      .isEmail()
      .withMessage("Email is invalid")
      .normalizeEmail({ all_lowercase: true }),

    // ✅ BMDC — exactly 10 alphanumeric characters, auto-uppercase
    body("bmdc")
      .trim()
      .isLength({ min: 10, max: 10 })
      .withMessage("BMDC must have exactly 10 characters")
      .isAlphanumeric()
      .withMessage("BMDC must contain only letters and numbers")
      .customSanitizer((value) => value.toUpperCase()),

    // ✅ Phone — exactly 11 digits
    body("phone")
      .trim()
      .matches(/^[0-9]{11}$/)
      .withMessage("Phone number must be exactly 11 digits"),

    // ✅ Password — no restrictions, just required
    body("password").trim().notEmpty().withMessage("Password is required"),
  ],
  validate,
  authController.register
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Valid password is required "),
    body("password")
      .isLength({ min: 6, max: 10 })
      .withMessage(
        "Password must have minimum 6 characters and maximum 10 characters "
      ),
  ],
  validate,
  authController.login
);

router.post("/refresh", authenticateToken, authController.refreshToken);

module.exports = router;

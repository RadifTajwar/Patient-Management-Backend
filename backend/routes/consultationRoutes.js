const express = require("express");
const router = express.Router();
const consultationController = require("../controllers/consultationController");
const authenticateToken = require("../middlewares/authenticateToken");
const validate = require("../middlewares/validate").default;
const { body, check } = require("express-validator");

router.post(
  "/addconsultation",
  [
    body("name").isString().notEmpty().withMessage("Enter valid patient name"),

    body("age").isNumeric().withMessage("Enter valid age"),

    body("sex").isString().notEmpty().withMessage("Enter valid gender"),

    body("phone").isString().notEmpty().withMessage("Enter valid phone number"),

    body("email")
      .optional({ checkFalsy: true }) // ✅ optional field
      .isEmail()
      .withMessage("Enter valid email"),

    body("date").isISO8601().withMessage("Enter valid appointment date"),

    body("timeSlotId") // ✅ new: must be numeric ID
      .isInt()
      .withMessage("Enter valid time slot ID"),

    body("address")
      .optional({ checkFalsy: true })
      .isString()
      .notEmpty()
      .withMessage("Enter valid address"),

    body("consultLocationId") // ✅ new: must be numeric ID
      .isInt()
      .withMessage("Enter valid consultation location ID"),
  ],
  validate,
  consultationController.addConsultation
);

router.post(
  "/getappointments",
  [
    body("consultlocation")
      .optional({ checkFalsy: true })
      .isString()
      .trim()
      .matches(/^[a-zA-Z0-9\s\-]*$/)
      .withMessage("Enter valid consultation location"),

    body("consultType")
      .optional({ checkFalsy: true })
      .isString()
      .trim()
      .matches(/^[a-zA-Z0-9\s\-]*$/)
      .withMessage("Enter valid consultation type"),

    body("appointmentStatus")
      .optional({ checkFalsy: true })
      .isString()
      .trim()
      .matches(/^[a-zA-Z\s\-]*$/)
      .withMessage("Enter valid appointment status"),
  ],
  validate,
  authenticateToken,
  consultationController.getAppointments
);

router.post(
  "/createPatientAndUpdateAppointment",
  consultationController.createPatientAndUpdateAppointment
);
router.get(
  "/singleappointment/:id",
  authenticateToken,
  consultationController.getSingleAppointment
);

router.put(
  "/cancelappointment",
  [body("appointmentId").isNumeric().withMessage("Enter valid id")],
  validate,
  authenticateToken,
  consultationController.cancelAppointment
);

router.put(
  "/update",
  [body("id").isNumeric().withMessage("Enter valid id")],
  validate,
  authenticateToken,
  consultationController.updateConsultation
);

router.post(
  "/getnotes",
  [
    body("consultlocation")
      .isString()
      .withMessage("Enter valid consultation location"),
    body("consultType").isString().withMessage("Enter valid consultation type"),
    body("disease").isString().withMessage("Enter valid disease"),
  ],
  validate,
  authenticateToken,
  consultationController.getNotes
);

router.post(
  "/all",
  [
    body("consultationId")
      .isNumeric()
      .withMessage("Enter valid consultationId"),
    body("patientId").isNumeric().withMessage("Enter valid patientId"),
  ],
  validate,
  authenticateToken,
  consultationController.getAllConsultations
);

router.get(
  "/:id",
  [],
  validate,
  authenticateToken,
  consultationController.getSingleConsultation
);

module.exports = router;

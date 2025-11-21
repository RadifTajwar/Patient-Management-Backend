const express = require("express");
const router = express.Router();
const doctorController = require("../controllers/doctorController");
const authenticateToken = require("../middlewares/authenticateToken");

router.get("/profile", doctorController.getDoctorProfile);

router.put(
  "/updateprofile",
  authenticateToken,
  doctorController.updateDoctorProfile
);

// Create new location
router.post(
  "/addconsultations",
  authenticateToken,
  doctorController.addDoctorConsultations
);

// Fetch consultation locations
router.get("/consultations", doctorController.getConsultationLocations);

// Publish / Unpublish
router.put(
  "/publish-location",
  authenticateToken,
  doctorController.togglePublishLocation
);

/*  
|--------------------------------------------------------------------------
| UPDATE CONSULTATION LOCATION (EDIT)
| PUT /doctor/updateconsultations/:id
|--------------------------------------------------------------------------
*/
router.put(
  "/updateconsultations/:id",
  authenticateToken,
  doctorController.updateConsultationLocation
);

/*  
|--------------------------------------------------------------------------
| DELETE CONSULTATION LOCATION
| DELETE /doctor/deleteconsultations/:id
|--------------------------------------------------------------------------
*/
router.delete(
  "/deleteconsultations/:id",
  authenticateToken,
  doctorController.deleteConsultationLocation
);

module.exports = router;

const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analyticsController");
const authenticateToken = require("../middlewares/authenticateToken");
const validate = require('../middlewares/validate').default;
const { body } = require('express-validator');

router.get("/counts", [
], validate, authenticateToken, analyticsController.getCounts);

router.post("/consultationpermonth",[
    body('consultlocation').isString().withMessage('Enter valid consultation location'),
    body('consultType').isString().withMessage('Enter valid consultation type'),
    body('disease').isString().withMessage('Enter valid disease'),
],validate, authenticateToken, analyticsController.getConsultationPerMonth);

router.post("/patientpermonth",[
    body('treatmentStatus').isString().withMessage('Enter valid treatmentStatus'),
    body('age').isNumeric().withMessage('Enter valid age'),
    body('sex').isString().withMessage('Enter valid sex'),
],validate, authenticateToken,analyticsController.getPatientPerMonth);

router.get("/genderdist", authenticateToken, analyticsController.getGenderDist);

//router.get("/processquery", authenticateToken, analyticsController.getQueryResults);

module.exports = router;
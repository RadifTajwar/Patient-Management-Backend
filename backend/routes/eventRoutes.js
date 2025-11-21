const express = require("express");
const router = express.Router();
const consultationController = require("../controllers/eventController");
const authenticateToken = require("../middlewares/authenticateToken");
const validate = require('../middlewares/validate').default;
const { body, check } = require('express-validator');

router.post("/addevent", [
    ], validate, authenticateToken, consultationController.addEvent);


router.post("/getdailyevent", [
], validate, authenticateToken, consultationController.getDailyEvents);


router.post("/getrangeevent", [
], validate, authenticateToken, consultationController.getRangeEvents);

router.put("/updateevent", [
], validate, authenticateToken, consultationController.updateEvent);

router.post("/deleteevent", [
], validate, authenticateToken, consultationController.deleteEvent);

module.exports = router;
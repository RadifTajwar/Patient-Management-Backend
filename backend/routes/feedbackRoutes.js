const express = require("express");
const router = express.Router();
const feedbackController = require("../controllers/feedbackController");
const authenticateToken = require("../middlewares/authenticateToken");
const validate = require('../middlewares/validate').default;
const { body, check } = require('express-validator');

router.post("/addfeedback", [
    body('title').isAlpha('en-US', {ignore: ' '}).withMessage('Enter valid feedback title'),
    body('review').isString().withMessage('Enter valid review format'),
], validate, authenticateToken, feedbackController.addFeedback);


//router.get("/all",authenticateToken, feedbackController.getFeedback);

module.exports = router;
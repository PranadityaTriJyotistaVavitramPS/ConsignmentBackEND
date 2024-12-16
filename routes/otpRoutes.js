const express = require("express");
const router = express.Router();
const otpController = require("../controllers/otpController");
const {authenticateResetToken} = require('../middleware/authenticateResetToken')

// Route: Generate OTP
router.post("/generate-otp", otpController.generateOTP);
router.post("/get-stored-otp", otpController.getStoredOTP);
router.post("/verify-otp", otpController.verifyOTP);
router.post("/reset-password", authenticateResetToken, otpController.resetPassword);




module.exports = router;

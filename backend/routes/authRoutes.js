// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const {
	register,
	sendRegisterOtp,
	login,
	googleAuth,
	forgotPassword,
	resetPassword,
	getProfile,
	updateProfile,
} = require("../controllers/authController");

router.post("/register/send-otp", sendRegisterOtp);
router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/profile", getProfile); // ?userId=
router.put("/profile", updateProfile);

module.exports = router;

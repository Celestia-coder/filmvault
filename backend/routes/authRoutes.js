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
const { requireLogin, ownUserId } = require("../middleware/authGuards");

router.post("/register/send-otp", sendRegisterOtp);
router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
// Your own profile only: ownUserId swaps in the logged-in user's id.
router.get("/profile", requireLogin, ownUserId("query"), getProfile);
router.put("/profile", requireLogin, ownUserId("body"), updateProfile);

module.exports = router;

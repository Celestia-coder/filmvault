// routes/authRoutes.js
const express = require("express");
const router = express.Router();
const { register, login, getProfile, updateProfile } = require("../controllers/authController");
const { authenticate } = require("../middleware/authenticate");

router.post("/register", register);
router.post("/login", login);
router.get("/profile", authenticate, getProfile); // user from verified token
router.put("/profile", authenticate, updateProfile);

module.exports = router;

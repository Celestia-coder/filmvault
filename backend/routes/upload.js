// routes/upload.js
// Image uploads to Cloudinary. Mounted at /api/upload (see server.js).
//
//   POST /api/upload/poster    movie poster (public image)
//   POST /api/upload/profile   profile picture (public image)
//
// Both return { url } with the permanent Cloudinary URL to save in the database.
// ID photos are not handled here: they go through POST /api/bookings.
//
// TODO: no auth yet. Once login issues tokens, protect /poster with requireAdmin
// and /profile with requireAuth (put them before the multer middleware).

const express = require("express");
const cloudinary = require("../config/cloudinary");
const {
	posterUpload,
	profileUpload,
	checkRealImage,
} = require("../middleware/upload");
// const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Sends an in-memory file to Cloudinary and resolves with the upload result.
const uploadBuffer = (buffer, options) =>
	new Promise((resolve, reject) => {
		cloudinary.uploader
			.upload_stream(
				{ resource_type: "image", ...options },
				(err, result) => (err ? reject(err) : resolve(result)),
			)
			.end(buffer);
	});

// Poster (admin only once auth exists)
router.post(
	"/poster",
	/* requireAdmin, */
	posterUpload.single("image"),
	checkRealImage,
	async (req, res) => {
		try {
			const result = await uploadBuffer(req.file.buffer, {
				folder: "filmvault/posters",
			});
			res.json({ url: result.secure_url });
		} catch (e) {
			console.error("Poster upload error:", e.message);
			res.status(500).json({
				message: "Upload failed. Please try again.",
			});
		}
	},
);

// Profile picture (any logged-in user once auth exists), cropped to a 400x400 square
router.post(
	"/profile",
	/* requireAuth, */
	profileUpload.single("image"),
	checkRealImage,
	async (req, res) => {
		try {
			const result = await uploadBuffer(req.file.buffer, {
				folder: "filmvault/profiles",
				transformation: [
					{ width: 400, height: 400, crop: "fill", gravity: "face" },
				],
			});
			res.json({ url: result.secure_url });
		} catch (e) {
			console.error("Profile upload error:", e.message);
			res.status(500).json({
				message: "Upload failed. Please try again.",
			});
		}
	},
);

// Turns multer errors (file too large, wrong type) into clean JSON messages
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
	if (err.code === "LIMIT_FILE_SIZE") {
		return res.status(413).json({ message: "File is too large." });
	}
	res.status(400).json({ message: err.message || "Upload error." });
});

module.exports = router;

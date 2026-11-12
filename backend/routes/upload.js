const express = require("express");
const cloudinary = require("../config/cloudinary");
const {
	posterUpload,
	profileUpload,
	idUpload,
	checkRealImage,
} = require("../middleware/upload");
// const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();

const uploadBuffer = (buffer, options) =>
	new Promise((resolve, reject) => {
		cloudinary.uploader
			.upload_stream(
				{ resource_type: "image", ...options },
				(err, result) => (err ? reject(err) : resolve(result)),
			)
			.end(buffer);
	});

// Poster: admin only, public image
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
			res.status(500).json({ message: "Upload failed. Please try again." });
		}
	},
);

// Profile picture: any logged-in user, public image
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
			res.status(500).json({ message: "Upload failed. Please try again." });
		}
	},
);

// ID photo: private. Save the returned publicId in the DB, NOT a URL.
// Not used by Checkout yet (it still uses the local uploadIdImage middleware).
router.post(
	"/id",
	/* requireAuth, */
	idUpload.single("image"),
	checkRealImage,
	async (req, res) => {
		try {
			const result = await uploadBuffer(req.file.buffer, {
				folder: "filmvault/ids",
				type: "authenticated",
			});
			res.json({ publicId: result.public_id });
		} catch (e) {
			console.error("ID upload error:", e.message);
			res.status(500).json({ message: "Upload failed. Please try again." });
		}
	},
);

// Admin only: signed URL to view an ID photo
router.get("/id/view", /* requireAdmin, */ (req, res) => {
	const { publicId } = req.query;
	if (!publicId) return res.status(400).json({ message: "Missing publicId." });
	const url = cloudinary.url(publicId, {
		type: "authenticated",
		sign_url: true,
		secure: true,
	});
	res.json({ url });
});

// Turn multer errors (too big, wrong type) into clean JSON messages
router.use((err, req, res, next) => {
	if (err.code === "LIMIT_FILE_SIZE") {
		return res.status(413).json({ message: "File is too large." });
	}
	res.status(400).json({ message: err.message || "Upload error." });
});

module.exports = router;
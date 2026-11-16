// middleware/uploadIdImageCloud.js
// Same job as uploadIdImage.js, but stores the senior/PWD ID photo on Cloudinary
// as a PRIVATE ("authenticated") image instead of on the server's disk.
// Nothing is written to disk, so nothing can end up in git.

// After this runs, req.file.filename holds the Cloudinary public_id
// (e.g. "filmvault/ids/abc123"), so the booking controller can save it as before.
// Admins view the photo through a signed URL:
// GET /api/admin/bookings/:id/id-image (see bookingController.js).

const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const { looksLikeImage } = require("./upload");

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB, same as the local version
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

class UploadError extends Error {
	constructor(status, code, message) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: MAX_BYTES, files: 1 },
	fileFilter: (req, file, cb) => {
		if (!ALLOWED.includes(file.mimetype)) {
			return cb(
				new UploadError(
					415,
					"INVALID_FILE_TYPE",
					"The ID must be a JPG, PNG or WebP image.",
				),
			);
		}
		return cb(null, true);
	},
});

const uploadToCloudinary = (buffer) =>
	new Promise((resolve, reject) => {
		cloudinary.uploader
			.upload_stream(
				{
					resource_type: "image",
					folder: "filmvault/ids",
					type: "authenticated",
				},
				(err, result) => (err ? reject(err) : resolve(result)),
			)
			.end(buffer);
	});

const uploadIdImage = (req, res, next) => {
	upload.single("idImage")(req, res, async (err) => {
		const reject = (status, code, message) =>
			res.status(status).json({ success: false, code, message });

		if (err) {
			if (err instanceof UploadError)
				return reject(err.status, err.code, err.message);
			if (err instanceof multer.MulterError) {
				if (err.code === "LIMIT_FILE_SIZE") {
					return reject(
						413,
						"FILE_TOO_LARGE",
						"The ID image is too large. The maximum size is 5 MB.",
					);
				}
				return reject(
					400,
					"INVALID_UPLOAD",
					'Upload the ID as a single file in the "idImage" field.',
				);
			}
			console.error("uploadIdImageCloud error:", err);
			return reject(
				500,
				"UPLOAD_FAILED",
				"Failed to process the uploaded file.",
			);
		}

		// No file: the ID is optional (only needed for senior/PWD discounts)
		if (!req.file) return next();

		if (!looksLikeImage(req.file.buffer, req.file.mimetype)) {
			return reject(
				415,
				"INVALID_FILE_TYPE",
				"That file isn't a valid JPG, PNG or WebP image.",
			);
		}

		try {
			const result = await uploadToCloudinary(req.file.buffer);
			req.file.filename = result.public_id; // saved by the booking controller
			req.file.cloudinary = true;
			delete req.file.buffer; // free the memory
			return next();
		} catch (e) {
			console.error("ID upload to Cloudinary failed:", e.message);
			return reject(
				502,
				"UPLOAD_FAILED",
				"Couldn't store the ID image. Please try again.",
			);
		}
	});
};

module.exports = { uploadIdImage, MAX_BYTES };

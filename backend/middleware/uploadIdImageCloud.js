// middleware/uploadIdImageCloud.js
// Stores the senior/PWD ID photos on Cloudinary as PRIVATE ("authenticated")
// images instead of on the server's disk. Nothing is written to disk, so
// nothing can end up in git.
//
// A booking can have several discounted seats, and each one needs its own ID
// photo. The client sends one file per seat, in a field named idImage_<seatId>
// (e.g. idImage_41, idImage_42).
//
// After this runs, req.files holds one entry per photo. Each entry has:
//   fieldname   "idImage_<seatId>", used by the booking controller to match the seat
//   filename    the Cloudinary public_id (e.g. "filmvault/ids/abc123")
//   cloudinary  true
// Admins view the photos through signed URLs:
// GET /api/admin/bookings/:id/id-images (see bookingController.js).

const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const { looksLikeImage } = require("./upload");

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per photo, same as the local version
const MAX_FILES = 8; // one per seat, and a booking has at most 8 seats
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const FIELD_RE = /^idImage_\d+$/;

class UploadError extends Error {
	constructor(status, code, message) {
		super(message);
		this.status = status;
		this.code = code;
	}
}

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: MAX_BYTES, files: MAX_FILES, fields: 30, parts: 40 },
	fileFilter: (req, file, cb) => {
		if (!FIELD_RE.test(file.fieldname)) {
			return cb(
				new UploadError(
					400,
					"INVALID_UPLOAD",
					'Upload each ID in a field named "idImage_<seatId>".',
				),
			);
		}
		// The type label from the browser is not trusted (and some computers label real
		// photos "application/octet-stream" or "image/jpg"). The real type is decided
		// below from the file's first bytes.
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

// Best effort: removes photos that were uploaded before a later one failed.
const destroyUploaded = (publicIds) =>
	Promise.all(
		publicIds.map((publicId) =>
			cloudinary.uploader
				.destroy(publicId, {
					type: "authenticated",
					resource_type: "image",
				})
				.catch((e) =>
					console.error(
						"Could not delete partial ID upload:",
						e.message,
					),
				),
		),
	);

const uploadIdImages = (req, res, next) => {
	upload.any()(req, res, async (err) => {
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
						"An ID image is too large. The maximum size is 5 MB per photo.",
					);
				}
				if (err.code === "LIMIT_FILE_COUNT") {
					return reject(
						400,
						"INVALID_UPLOAD",
						`You can upload at most ${MAX_FILES} ID photos.`,
					);
				}
				return reject(
					400,
					"INVALID_UPLOAD",
					'Upload each ID in a field named "idImage_<seatId>".',
				);
			}
			console.error("uploadIdImageCloud error:", err);
			return reject(
				500,
				"UPLOAD_FAILED",
				"Failed to process the uploaded files.",
			);
		}

		// No files: IDs are only needed for senior/PWD discounts
		const files = req.files ?? [];
		if (files.length === 0) return next();

		// Check everything before uploading anything, so a bad file costs no uploads.
		const seen = new Set();
		for (const file of files) {
			if (seen.has(file.fieldname)) {
				return reject(
					400,
					"INVALID_UPLOAD",
					"Send only one ID photo per seat.",
				);
			}
			seen.add(file.fieldname);
			const realType = ALLOWED.find((type) =>
				looksLikeImage(file.buffer, type),
			);
			if (realType) file.mimetype = realType;
			if (!realType) {
				return reject(
					415,
					"INVALID_FILE_TYPE",
					"That file isn't a valid JPG, PNG or WebP image.",
				);
			}
		}

		const results = await Promise.allSettled(
			files.map((file) => uploadToCloudinary(file.buffer)),
		);

		if (results.some((r) => r.status === "rejected")) {
			const failed = results.find((r) => r.status === "rejected");
			console.error(
				"ID upload to Cloudinary failed:",
				failed.reason?.message,
			);
			// All or nothing: don't leave half of the photos behind.
			await destroyUploaded(
				results
					.filter((r) => r.status === "fulfilled")
					.map((r) => r.value.public_id),
			);
			return reject(
				502,
				"UPLOAD_FAILED",
				"Couldn't store the ID images. Please try again.",
			);
		}

		files.forEach((file, i) => {
			file.filename = results[i].value.public_id; // saved by the booking controller
			file.cloudinary = true;
			delete file.buffer; // free the memory
		});
		return next();
	});
};

// uploadIdImage keeps the old export name, so existing route imports still work.
module.exports = {
	uploadIdImage: uploadIdImages,
	uploadIdImages,
	MAX_BYTES,
	MAX_FILES,
};

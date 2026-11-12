const multer = require("multer");

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

const make = (maxMB) =>
	multer({
		storage: multer.memoryStorage(),
		limits: { fileSize: maxMB * 1024 * 1024, files: 1 },
		fileFilter: (req, file, cb) => {
			if (!ALLOWED.includes(file.mimetype)) {
				return cb(
					new Error("Only JPG, PNG, and WEBP images are allowed."),
				);
			}
			cb(null, true);
		},
	});

// The MIME type comes from the browser and can be faked, so also check that the
// file really starts like the image type it claims to be.
const looksLikeImage = (buf, mimetype) => {
	if (mimetype === "image/jpeg")
		return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
	if (mimetype === "image/png")
		return buf
			.subarray(0, 8)
			.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
	if (mimetype === "image/webp")
		return (
			buf.subarray(0, 4).toString("ascii") === "RIFF" &&
			buf.subarray(8, 12).toString("ascii") === "WEBP"
		);
	return false;
};

// Run after multer and before sending to Cloudinary
const checkRealImage = (req, res, next) => {
	if (!req.file) {
		return res.status(400).json({ message: "No file uploaded." });
	}
	if (!looksLikeImage(req.file.buffer, req.file.mimetype)) {
		return res
			.status(415)
			.json({ message: "That file isn't a valid JPG, PNG or WebP image." });
	}
	next();
};

module.exports = {
	posterUpload: make(5),
	profileUpload: make(2),
	idUpload: make(5),
	checkRealImage,
};
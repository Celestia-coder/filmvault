// middleware/uploadIdImage.js
// Accepts the senior/PWD ID photo on POST /api/bookings (multipart/form-data,
// field name "idImage").
//
// The file is stored in backend/private/id-uploads/. That folder is NOT served
// by Express (there is no express.static anywhere) and is git-ignored, so an ID
// photo can only ever be read by server code. The stored filename is a random
// UUID chosen by the server — the original filename is never used, so it can't
// be used for path tricks.
//
// Rejects, with a JSON error the Checkout page can show:
//   415 INVALID_FILE_TYPE  not a JPG / PNG / WebP (checked by MIME type AND by
//                          the file's actual first bytes, not just its name)
//   413 FILE_TOO_LARGE     over 5 MB
//   400 INVALID_UPLOAD     wrong field name, or more than one file

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const UPLOAD_DIR = path.join(__dirname, "..", "private", "id-uploads");
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

class UploadError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.${EXTENSIONS[file.mimetype]}`),
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!EXTENSIONS[file.mimetype]) {
      return cb(new UploadError(415, "INVALID_FILE_TYPE", "The ID must be a JPG, PNG or WebP image."));
    }
    return cb(null, true);
  },
});

// The MIME type comes from the browser and can be faked, so also check that the
// saved file really starts like the image type it claims to be.
const looksLikeImage = (filePath, mimetype) => {
  const fd = fs.openSync(filePath, "r");
  const head = Buffer.alloc(12);
  try {
    fs.readSync(fd, head, 0, 12, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (mimetype === "image/jpeg") return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  if (mimetype === "image/png") {
    return head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimetype === "image/webp") {
    return head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
};

const uploadIdImage = (req, res, next) => {
  upload.single("idImage")(req, res, (err) => {
    const reject = (status, code, message) => res.status(status).json({ success: false, code, message });

    if (err) {
      if (err instanceof UploadError) return reject(err.status, err.code, err.message);
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return reject(413, "FILE_TOO_LARGE", "The ID image is too large. The maximum size is 5 MB.");
        }
        return reject(400, "INVALID_UPLOAD", "Upload the ID as a single file in the \"idImage\" field.");
      }
      console.error("uploadIdImage error:", err);
      return reject(500, "UPLOAD_FAILED", "Failed to process the uploaded file.");
    }

    if (req.file && !looksLikeImage(req.file.path, req.file.mimetype)) {
      fs.unlink(req.file.path, () => {});
      return reject(415, "INVALID_FILE_TYPE", "That file isn't a valid JPG, PNG or WebP image.");
    }

    return next();
  });
};

module.exports = { uploadIdImage, UPLOAD_DIR, MAX_BYTES };

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
// The file type is decided by what is INSIDE the file (its first bytes), never by the
// type label the browser sends. Some computers label perfectly good photos as
// "application/octet-stream", "image/jpg" or "image/pjpeg", and trusting that label
// rejected valid images.
//
// Rejects, with a JSON error the Checkout page can show:
//   415 INVALID_FILE_TYPE  not really a JPG / PNG / WebP
//   413 FILE_TOO_LARGE     over 5 MB
//   400 INVALID_UPLOAD     wrong field name, or more than one file

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const UPLOAD_DIR = path.join(__dirname, "..", "private", "id-uploads");
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Saved under a random temporary name first; once the contents are checked it gets its
// real extension (see uploadIdImage below).
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.upload`),
  }),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

// "jpg" | "png" | "webp" | null, from the file's first bytes.
const detectImageType = (filePath) => {
  const fd = fs.openSync(filePath, "r");
  const head = Buffer.alloc(12);
  try {
    fs.readSync(fd, head, 0, 12, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpg";
  if (head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
};

const uploadIdImage = (req, res, next) => {
  upload.single("idImage")(req, res, (err) => {
    const reject = (status, code, message) => res.status(status).json({ success: false, code, message });

    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return reject(413, "FILE_TOO_LARGE", "The ID image is too large. The maximum size is 5 MB.");
        }
        return reject(400, "INVALID_UPLOAD", "Upload the ID as a single file in the \"idImage\" field.");
      }
      console.error("uploadIdImage error:", err);
      return reject(500, "UPLOAD_FAILED", "Failed to process the uploaded file.");
    }

    if (req.file) {
      const kind = detectImageType(req.file.path);
      if (!kind) {
        fs.unlink(req.file.path, () => {});
        return reject(415, "INVALID_FILE_TYPE", "That file isn't a valid JPG, PNG or WebP image.");
      }
      // Give it its real extension and tell the rest of the code the true type.
      const finalName = `${path.parse(req.file.filename).name}.${kind}`;
      const finalPath = path.join(UPLOAD_DIR, finalName);
      fs.renameSync(req.file.path, finalPath);
      req.file.filename = finalName;
      req.file.path = finalPath;
      req.file.mimetype = kind === "jpg" ? "image/jpeg" : `image/${kind}`;
    }

    return next();
  });
};

module.exports = { uploadIdImage, UPLOAD_DIR, MAX_BYTES };

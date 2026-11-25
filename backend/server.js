// server.js — entry point, starts the server

require("dotenv").config(); // must stay first so .env values are loaded before anything else
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const movieRoutes = require("./routes/movieRoutes");
const showtimeRoutes = require("./routes/showtimeRoutes");
const searchRoutes = require("./routes/searchRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const seatRoutes = require("./routes/seatRoutes");
const seatHoldRoutes = require("./routes/seatHoldRoutes");
const customerBookingRoutes = require("./routes/customerBookingRoutes");
const snackRoutes = require("./routes/snackRoutes");
const uploadRoutes = require("./routes/upload");
const paymentRoutes = require("./routes/paymentRoutes");

// Refuse to start a production server with unsafe settings (they only apply when
// NODE_ENV=production, so local development is unaffected).
if (process.env.NODE_ENV === "production") {
	const problems = [];
	if ((process.env.AUTH_TOKEN_SECRET || "").length < 32)
		problems.push(
			"AUTH_TOKEN_SECRET must be a random string of at least 32 characters",
		);
	if (process.env.PAYMENT_PROVIDER !== "xendit")
		problems.push(
			"PAYMENT_PROVIDER must be xendit (otherwise every booking counts as paid)",
		);
	if (!process.env.CORS_ORIGIN)
		problems.push("CORS_ORIGIN must be set to your website's address");
	if (problems.length) {
		console.error(
			"Unsafe production configuration:\n - " + problems.join("\n - "),
		);
		process.exit(1);
	}
}

const app = express();

// Don't advertise "Express" to scanners.
app.disable("x-powered-by");

// When hosted behind a proxy (Render, Railway, Nginx...), set TRUST_PROXY=1 so
// rate limiting sees each visitor's real IP instead of the proxy's.
if (process.env.TRUST_PROXY)
	app.set("trust proxy", Number(process.env.TRUST_PROXY));

// Standard security headers (no sniffing, no framing, HSTS on https, ...).
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// Only the FilmVault frontend may call this API from a browser.
// CORS_ORIGIN is a comma-separated list, e.g. "https://filmvault.example.com".
const allowedOrigins = (
	process.env.CORS_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173"
)
	.split(",")
	.map((o) => o.trim())
	.filter(Boolean);
app.use(
	cors({
		origin(origin, callback) {
			// No Origin header = curl/Postman/server-to-server, not a browser page.
			if (!origin || allowedOrigins.includes(origin))
				return callback(null, true);
			return callback(null, false);
		},
	}),
);

// Read JSON request bodies (req.body). Our JSON bodies are tiny; images go through multer.
app.use(express.json({ limit: "100kb" }));

// Rate limits: slow down scripts that hammer the API or guess passwords.
const tooMany = (message) => ({
	success: false,
	code: "RATE_LIMITED",
	message,
});
const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 600, // per IP per 15 minutes
	standardHeaders: "draft-7",
	legacyHeaders: false,
	message: tooMany("Too many requests. Please try again in a few minutes."),
});
// Login, signup, OTP and password reset. Successful requests are not counted,
// so normal users are fine; repeated failures lock the IP out for a while.
const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 30,
	skipSuccessfulRequests: true,
	standardHeaders: "draft-7",
	legacyHeaders: false,
	message: tooMany("Too many attempts. Please try again in 15 minutes."),
});
// Anything that sends an email (signup code, password reset code). Every request counts,
// so nobody can use the site to spam strangers' inboxes or run up the email quota.
const emailLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 10, // per IP per hour
	standardHeaders: "draft-7",
	legacyHeaders: false,
	message: tooMany("Too many code requests. Please try again later."),
});
app.use("/api", apiLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/auth/register/send-otp", emailLimiter);
app.use("/api/auth/forgot-password", emailLimiter);

app.use(require("./middleware/authenticate"));

// Health check
app.get("/", (req, res) => {
	res.send("FilmVault backend server is running.");
});

// Auth: /api/auth/register, /api/auth/login
app.use("/api/auth", authRoutes);

// Search: must be mounted BEFORE movieRoutes, or GET /api/movies/search
// would match GET /movies/:id and treat "search" as a movie ID.
app.use("/api", searchRoutes);

// Movies: public (/api/movies) and admin (/api/admin/movies)
app.use("/api", movieRoutes);

// Showtimes: public (/api/showtimes, /api/movies/:id/showtimes) and admin (/api/admin/showtimes)
app.use("/api", showtimeRoutes);

// Admin bookings: /api/admin/bookings (list, cancel, view ID photo)
app.use("/api", bookingRoutes);

// Admin seats: seat map and Seat Inspector block/release
app.use("/api", seatRoutes);

// Customer seats: seat map for a showtime and temporary seat holds
app.use("/api", seatHoldRoutes);

// Customer bookings: POST /api/bookings (checkout, ID photo upload), GET /api/bookings, GET /api/bookings/:id
app.use("/api", customerBookingRoutes);

// Snacks: GET /api/snacks (food menu shown at Checkout)
app.use("/api", snackRoutes);

// Image uploads to Cloudinary: POST /api/upload/poster and /api/upload/profile.
// ID photos are not uploaded here; they go through POST /api/bookings.
app.use("/api/upload", uploadRoutes);

// Payments: Xendit invoice status (Checkout polls it)
app.use("/api", paymentRoutes);

// Unknown URL
app.use((req, res) => {
	res.status(404).json({
		success: false,
		code: "NOT_FOUND",
		message: "Not found.",
	});
});

// Last-resort error handler: log the details here, never send stack traces to the browser.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
	if (err.type === "entity.parse.failed" || err.type === "entity.too.large") {
		return res.status(err.status || 400).json({
			success: false,
			code: "VALIDATION_ERROR",
			message: "Invalid request body.",
		});
	}
	console.error("Unhandled error:", err);
	res.status(500).json({
		success: false,
		code: "SERVER_ERROR",
		message: "Something went wrong.",
	});
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});

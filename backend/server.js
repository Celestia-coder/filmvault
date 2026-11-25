// server.js — entry point, starts the server

require("dotenv").config(); // must stay first so .env values are loaded before anything else
const express = require("express");
const cors = require("cors");

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

const app = express();

// Allow the React frontend (different port) to call this API
app.use(cors());

// Read JSON request bodies (req.body)
app.use(express.json());

app.use(require("./middleware/authenticate"));

// temporary test route; delete it once emails work
app.get("/api/auth/me", (req, res) => res.json({ auth: req.auth ?? null }));

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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});

// routes/customerBookingRoutes.js
// Customer booking routes. (Admin booking routes are in bookingRoutes.js.)
const express = require("express");
const router = express.Router();
const {
	createBooking,
	getUserBookings,
	getBookingById,
	verifyTicket,
} = require("../controllers/customerBookingController");
const { requireCustomer, ownUserId } = require("../middleware/authGuards");

// ID photo storage: ID_STORAGE=cloud uses Cloudinary (private), anything else uses local disk.
const useCloudIds =
	(process.env.ID_STORAGE || "").trim().toLowerCase() === "cloud";
const { uploadIdImage } = useCloudIds
	? require("../middleware/uploadIdImageCloud")
	: require("../middleware/uploadIdImage");
console.log(
	`ID photo storage: ${useCloudIds ? "Cloudinary (private)" : "local disk"}`,
);

// Customer login required. ownUserId replaces any userId sent by the browser with the
// logged-in customer's own id, so nobody can book for, or read the bookings of, someone else.
// On POST it runs after the upload middleware, because the form fields only exist after that.
router.post(
	"/bookings",
	requireCustomer,
	uploadIdImage,
	ownUserId("body"),
	createBooking,
); // multipart: "idImage_<seatId>" files
router.get("/bookings", requireCustomer, ownUserId("query"), getUserBookings);
router.get(
	"/bookings/:id",
	requireCustomer,
	ownUserId("query"),
	getBookingById,
);
router.get("/tickets/verify/:token", verifyTicket); // public: opened by the e-ticket QR code

module.exports = router;

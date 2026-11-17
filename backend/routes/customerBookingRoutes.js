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
const { requireCustomer } = require("../middleware/authenticate");

// ID photo storage: ID_STORAGE=cloud uses Cloudinary (private), anything else uses local disk.
const useCloudIds =
	(process.env.ID_STORAGE || "").trim().toLowerCase() === "cloud";
const { uploadIdImage } = useCloudIds
	? require("../middleware/uploadIdImageCloud")
	: require("../middleware/uploadIdImage");
console.log(
	`ID photo storage: ${useCloudIds ? "Cloudinary (private)" : "local disk"}`,
);

// Customer routes require a verified token; QR verification remains public.
router.post("/bookings", ...requireCustomer, uploadIdImage, createBooking); // multipart: optional "idImage" file
router.get("/bookings", ...requireCustomer, getUserBookings);
router.get("/bookings/:id", ...requireCustomer, getBookingById);
router.get("/tickets/verify/:token", verifyTicket); // public: opened by the e-ticket QR code

module.exports = router;

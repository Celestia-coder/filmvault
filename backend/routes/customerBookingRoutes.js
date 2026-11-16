// routes/customerBookingRoutes.js

// Customer booking routes. (Admin booking routes are in bookingRoutes.js.)
const express = require("express");
const router = express.Router();
const {
	createBooking,
	getUserBookings,
	getBookingById,
} = require("../controllers/customerBookingController");

// ID photo storage: ID_STORAGE=cloud uses Cloudinary (private), anything else uses local disk.
const useCloudIds =
	(process.env.ID_STORAGE || "").trim().toLowerCase() === "cloud";
    
const { uploadIdImage } = useCloudIds
	? require("../middleware/uploadIdImageCloud")
	: require("../middleware/uploadIdImage");
console.log(
	`ID photo storage: ${useCloudIds ? "Cloudinary (private)" : "local disk"}`,
);

// No auth middleware yet: userId is sent by the client (see the TODO in the controller).
router.post("/bookings", uploadIdImage, createBooking); // multipart: optional "idImage" file
router.get("/bookings", getUserBookings); 
router.get("/bookings/:id", getBookingById); 

module.exports = router;

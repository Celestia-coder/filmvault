// routes/bookingRoutes.js

// Admin booking routes. (Customer booking routes are in customerBookingRoutes.js.)
const express = require("express");
const router = express.Router();
const {
	getAdminBookings,
	cancelBooking,
	getBookingIdImage,
	getBookingIdImageFile,
} = require("../controllers/bookingController");

// No auth middleware yet: branch scoping comes from ?branchId=
router.get("/admin/bookings", getAdminBookings); // ?branchId=&status=&date=&movieId=
router.patch("/admin/bookings/:id", cancelBooking); // ?branchId=
router.get("/admin/bookings/:id/id-image", getBookingIdImage); // ?branchId= -> { url }
router.get("/admin/bookings/:id/id-image/file", getBookingIdImageFile); // ?branchId= -> image (local fallback)

module.exports = router;

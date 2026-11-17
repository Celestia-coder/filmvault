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
const { requireAdmin } = require("../middleware/authenticate");

// Admin identity and branch scope come from verified backend authentication.
router.get("/admin/bookings", ...requireAdmin, getAdminBookings);
router.patch("/admin/bookings/:id", ...requireAdmin, cancelBooking);
router.get("/admin/bookings/:id/id-image", ...requireAdmin, getBookingIdImage);
router.get("/admin/bookings/:id/id-image/file", ...requireAdmin, getBookingIdImageFile);

module.exports = router;

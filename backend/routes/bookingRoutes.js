// routes/bookingRoutes.js

// Admin booking routes. (Customer booking routes are in customerBookingRoutes.js.)
const express = require("express");
const router = express.Router();
const {
	getAdminBookings,
	cancelBooking,
	getBookingIdImages,
	getBookingIdImageFile,
} = require("../controllers/bookingController");
const { branchAdminOnly } = require("../middleware/authGuards");

// Admin only. branchAdminOnly checks the login token and forces ?branchId= to the
// admin's own branch, so a branch can only see and change its own bookings and ID photos.
router.use("/admin/bookings", branchAdminOnly);
router.get("/admin/bookings", getAdminBookings); // ?branchId=&status=&date=&movieId=
router.patch("/admin/bookings/:id", cancelBooking); // ?branchId=
router.get("/admin/bookings/:id/id-images", getBookingIdImages); // ?branchId= -> { images: [{ seat, url, ... }] }
router.get("/admin/bookings/:id/id-image", getBookingIdImages); // older name, same response (also has `url`)
router.get("/admin/bookings/:id/id-image/file", getBookingIdImageFile); // ?branchId=&seatId= -> image (local fallback)

module.exports = router;
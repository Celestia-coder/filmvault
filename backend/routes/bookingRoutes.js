// routes/bookingRoutes.js
const express = require("express");
const router = express.Router();
const { getAdminBookings, cancelBooking } = require("../controllers/bookingController");

// Admin (no auth middleware yet; branch scoping comes from ?branchId=)
router.get("/admin/bookings", getAdminBookings);
router.patch("/admin/bookings/:id", cancelBooking);

module.exports = router;

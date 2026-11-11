// routes/customerBookingRoutes.js
// Customer-facing booking routes. (Admin booking routes are in bookingRoutes.js.)
const express = require("express");
const router = express.Router();
const { uploadIdImage } = require("../middleware/uploadIdImage");
const { createBooking, getUserBookings, getBookingById } = require("../controllers/customerBookingController");

// No auth middleware yet: userId is sent by the client for now (see the TODO in the controller).
router.post("/bookings", uploadIdImage, createBooking); // multipart: optional "idImage" file
router.get("/bookings", getUserBookings); // ?userId=
router.get("/bookings/:id", getBookingById); // ?userId=

module.exports = router;

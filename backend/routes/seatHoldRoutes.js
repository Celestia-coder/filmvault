// routes/seatHoldRoutes.js
// Customer-facing seat routes. (Admin seat routes are in seatRoutes.js.)
const express = require("express");
const router = express.Router();
const { getSeatMap, holdSeats } = require("../controllers/seatHoldController");
const { requireCustomer, ownUserId } = require("../middleware/authGuards");

// Public read
router.get("/showtimes/:id/seats", getSeatMap);

// Used by a logged-in customer (not admin-only, so no /admin prefix).
// ownUserId sets the userId in the body to the logged-in customer, whatever the browser sent.
router.post(
	"/showtimes/:id/seats/hold",
	requireCustomer,
	ownUserId("body"),
	holdSeats,
);

module.exports = router;

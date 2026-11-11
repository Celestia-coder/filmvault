// routes/seatHoldRoutes.js
// Customer-facing seat routes. (Admin seat routes are in seatRoutes.js.)
const express = require("express");
const router = express.Router();
const { getSeatMap, holdSeats } = require("../controllers/seatHoldController");

// Public read
router.get("/showtimes/:id/seats", getSeatMap);

// Used by a logged-in customer (not admin-only, so no /admin prefix).
// No auth middleware yet: userId is read from the request body for now.
router.post("/showtimes/:id/seats/hold", holdSeats);

module.exports = router;
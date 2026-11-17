// routes/seatHoldRoutes.js
// Customer-facing seat routes. (Admin seat routes are in seatRoutes.js.)
const express = require("express");
const router = express.Router();
const { getSeatMap, holdSeats } = require("../controllers/seatHoldController");
const { requireCustomer } = require("../middleware/authenticate");

// A customer's own held seats are visible only with verified identity.
router.get("/showtimes/:id/seats", ...requireCustomer, getSeatMap);

// Used by a logged-in customer (not admin-only, so no /admin prefix).
// Hold ownership comes from the verified customer context.
router.post("/showtimes/:id/seats/hold", ...requireCustomer, holdSeats);

module.exports = router;

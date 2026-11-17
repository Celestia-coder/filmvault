// routes/seatRoutes.js
const express = require("express");
const router = express.Router();
const { getSeatMap, updateSeatStatus } = require("../controllers/seatController");
const { requireAdmin } = require("../middleware/authenticate");

// Admin-only; seat controllers use the authenticated admin's assigned branch.
router.get("/admin/cinemas/:id/seat-map", ...requireAdmin, getSeatMap);
router.put("/admin/showtimes/:id/seats/:seatId", ...requireAdmin, updateSeatStatus);

module.exports = router;

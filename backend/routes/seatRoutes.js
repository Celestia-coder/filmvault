// routes/seatRoutes.js
const express = require("express");
const router = express.Router();
const { getSeatMap, updateSeatStatus } = require("../controllers/seatController");

// Admin (no auth middleware yet; branch scoping comes from ?branchId=)
router.get("/admin/cinemas/:id/seat-map", getSeatMap);
router.put("/admin/showtimes/:id/seats/:seatId", updateSeatStatus);

module.exports = router;

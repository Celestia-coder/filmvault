// routes/seatRoutes.js
const express = require("express");
const router = express.Router();
const {
	getSeatMap,
	updateSeatStatus,
} = require("../controllers/seatController");
const { branchAdminOnly } = require("../middleware/authGuards");

// Admin only. branchAdminOnly forces ?branchId= to the admin's own branch.
router.get("/admin/cinemas/:id/seat-map", branchAdminOnly, getSeatMap);
router.put(
	"/admin/showtimes/:id/seats/:seatId",
	branchAdminOnly,
	updateSeatStatus,
);

module.exports = router;

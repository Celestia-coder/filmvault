// routes/showtimeRoutes.js
const express = require("express");
const router = express.Router();
const {
	getAllShowtimes,
	getShowtimesForMovie,
	createShowtime,
	updateShowtime,
	deleteShowtime,
} = require("../controllers/showtimeController");
const { branchAdminOnly } = require("../middleware/authGuards");

// Public
router.get("/showtimes", getAllShowtimes);
router.get("/movies/:id/showtimes", getShowtimesForMovie);

// Admin only (the controller also checks the branch of the cinema).
router.post("/admin/showtimes", branchAdminOnly, createShowtime);
router.put("/admin/showtimes/:id", branchAdminOnly, updateShowtime);
router.delete("/admin/showtimes/:id", branchAdminOnly, deleteShowtime);

module.exports = router;

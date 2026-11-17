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
const { requireAdmin } = require("../middleware/authenticate");

// Public
router.get("/showtimes", getAllShowtimes);
router.get("/movies/:id/showtimes", getShowtimesForMovie);

// Admin-only; writes validate the screening and cinema's stored branch.
router.post("/admin/showtimes", ...requireAdmin, createShowtime);
router.put("/admin/showtimes/:id", ...requireAdmin, updateShowtime);
router.delete("/admin/showtimes/:id", ...requireAdmin, deleteShowtime);

module.exports = router;

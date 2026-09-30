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

// Public
router.get("/showtimes", getAllShowtimes);
router.get("/movies/:id/showtimes", getShowtimesForMovie);

// Admin (no auth middleware yet, /admin is just a naming convention — same as movieRoutes)
router.post("/admin/showtimes", createShowtime);
router.put("/admin/showtimes/:id", updateShowtime);
router.delete("/admin/showtimes/:id", deleteShowtime);

module.exports = router;

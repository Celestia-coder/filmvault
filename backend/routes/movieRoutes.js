// routes/movieRoutes.js
const express = require("express");
const router = express.Router();
const { getAllMovies, getMovieById, createMovie, updateMovie, deleteMovie } = require("../controllers/movieController");
const { requireAdmin } = require("../middleware/authenticate");

// Public
router.get("/movies", getAllMovies);
router.get("/movies/:id", getMovieById);

// Admin-only writes. MOVIE is a global catalog without branch ownership.
router.post("/admin/movies", ...requireAdmin, createMovie);
router.put("/admin/movies/:id", ...requireAdmin, updateMovie);
router.delete("/admin/movies/:id", ...requireAdmin, deleteMovie);

module.exports = router;

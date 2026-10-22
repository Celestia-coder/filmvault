// routes/movieRoutes.js
const express = require("express");
const router = express.Router();
const { getAllMovies, getMovieById, createMovie, updateMovie, deleteMovie } = require("../controllers/movieController");

// Public
router.get("/movies", getAllMovies);
router.get("/movies/:id", getMovieById);

// Admin (no auth middleware yet, /admin is just a naming convention)
router.post("/admin/movies", createMovie);
router.put("/admin/movies/:id", updateMovie);
router.delete("/admin/movies/:id", deleteMovie);

module.exports = router;
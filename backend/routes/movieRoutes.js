// routes/movieRoutes.js
const express = require("express");
const router = express.Router();
const { getAllMovies, getMovieById, createMovie } = require("../controllers/movieController");

// Public
router.get("/movies", getAllMovies);
router.get("/movies/:id", getMovieById);

// Admin (no auth middleware yet, /admin is just a naming convention)
router.post("/admin/movies", createMovie);

module.exports = router;
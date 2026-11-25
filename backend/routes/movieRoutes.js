// routes/movieRoutes.js
const express = require("express");
const router = express.Router();
const {
	getAllMovies,
	getMovieById,
	createMovie,
	updateMovie,
	deleteMovie,
} = require("../controllers/movieController");
const authenticate = require("../middleware/authenticate");
const requireAdmin = require("../middleware/requireAdmin");

// Public
router.get("/movies", getAllMovies);
router.get("/movies/:id", getMovieById);

// Admin only: the login token must belong to an admin.
// (Movies are shared by all branches, so any branch admin may manage them.)
router.post("/admin/movies", authenticate, requireAdmin, createMovie);
router.put("/admin/movies/:id", authenticate, requireAdmin, updateMovie);
router.delete("/admin/movies/:id", authenticate, requireAdmin, deleteMovie);

module.exports = router;

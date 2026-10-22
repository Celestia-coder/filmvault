// routes/searchRoutes.js
const express = require("express");
const router = express.Router();
const { searchMovies, searchBranches } = require("../controllers/searchController");

router.get("/movies/search", searchMovies);
router.get("/branches/search", searchBranches);

module.exports = router;

// controllers/searchController.js
// Search & filter logic for movies and branches (kept in its own file per
// the Week 3 spec, separate from basic CRUD in movieController.js).
//
// Both handlers build their WHERE clause dynamically: a condition is only
// added for a query param that was actually sent, so any combination of
// params works and sending none returns the full list (same as the base
// GET /api/movies endpoint). All string matching uses LOWER(...) LIKE
// LOWER(?) so it's case-insensitive regardless of the DB's collation, and
// LIKE with %...% gives partial matches (title=dragon matches "How To
// Train Your Dragon").

const pool = require("../config/database");

// Same base query/formatter as movieController.js, so search results have
// the identical shape (genres collapsed into an array) as GET /api/movies.
const MOVIE_SELECT = `
  SELECT m.*, GROUP_CONCAT(g.genre_name ORDER BY g.genre_name SEPARATOR ',') AS genres
  FROM MOVIE m
  LEFT JOIN MOVIE_GENRE mg ON mg.movie_id = m.movie_id
  LEFT JOIN GENRE g ON g.genre_id = mg.genre_id
`;

const formatMovie = (row) => ({
  ...row,
  genres: row.genres ? row.genres.split(",") : [],
});

// GET /api/movies/search?title=&genre=&branch=
const searchMovies = async (req, res) => {
  const { title, genre, branch } = req.query;
  const conditions = [];
  const params = [];

  if (title) {
    conditions.push("LOWER(m.title) LIKE LOWER(?)");
    params.push(`%${title}%`);
  }

  // genre and branch both depend on a joined/many-to-many table, so they're
  // filtered via an IN (subquery) rather than a WHERE on the joined alias
  // directly. Filtering the joined GENRE row directly (WHERE g.genre_name
  // LIKE ...) would also silently truncate the GROUP_CONCAT'd genres list
  // below to just the matching genre, instead of returning each movie's
  // full genre list the way GET /api/movies does.
  if (genre) {
    conditions.push(`m.movie_id IN (
      SELECT mg2.movie_id FROM MOVIE_GENRE mg2
      JOIN GENRE g2 ON g2.genre_id = mg2.genre_id
      WHERE LOWER(g2.genre_name) LIKE LOWER(?)
    )`);
    params.push(`%${genre}%`);
  }

  if (branch) {
    // A movie "matches" a branch if it has at least one showtime scheduled
    // at a cinema belonging to a branch whose name matches.
    conditions.push(`m.movie_id IN (
      SELECT s.movie_id
      FROM SCREENING s
      JOIN CINEMA c ON c.cinema_id = s.cinema_id
      JOIN BRANCH b ON b.branch_id = c.branch_id
      WHERE LOWER(b.branch_name) LIKE LOWER(?)
    )`);
    params.push(`%${branch}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [rows] = await pool.query(
      `${MOVIE_SELECT} ${where} GROUP BY m.movie_id ORDER BY m.movie_id`,
      params
    );
    // No matches is a valid successful search, not an error.
    return res.status(200).json({ success: true, movies: rows.map(formatMovie) });
  } catch (error) {
    console.error("searchMovies error:", error);
    return res.status(500).json({ success: false, message: "Failed to search movies." });
  }
};

// GET /api/branches/search?name=
const searchBranches = async (req, res) => {
  const { name } = req.query;
  const conditions = [];
  const params = [];

  if (name) {
    conditions.push("LOWER(branch_name) LIKE LOWER(?)");
    params.push(`%${name}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [rows] = await pool.query(`SELECT * FROM BRANCH ${where} ORDER BY branch_id`, params);
    return res.status(200).json({ success: true, branches: rows });
  } catch (error) {
    console.error("searchBranches error:", error);
    return res.status(500).json({ success: false, message: "Failed to search branches." });
  }
};

module.exports = { searchMovies, searchBranches };

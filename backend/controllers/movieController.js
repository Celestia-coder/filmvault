// controllers/movieController.js
// Public + admin movie logic (routes decide which is which).

const pool = require("../config/database");

const VALID_STATUSES = ["upcoming", "now-showing", "ended"];

// Base query: one row per movie, genres collapsed into a comma list
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

// GET /api/movies
const getAllMovies = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `${MOVIE_SELECT} GROUP BY m.movie_id ORDER BY m.movie_id`
    );
    return res.status(200).json({ success: true, movies: rows.map(formatMovie) });
  } catch (error) {
    console.error("getAllMovies error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch movies." });
  }
};

// GET /api/movies/:id
const getMovieById = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid movie ID." });
  }

  try {
    const [rows] = await pool.query(
      `${MOVIE_SELECT} WHERE m.movie_id = ? GROUP BY m.movie_id`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Movie not found." });
    }
    return res.status(200).json({ success: true, movie: formatMovie(rows[0]) });
  } catch (error) {
    console.error("getMovieById error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch movie." });
  }
};

// POST /api/admin/movies
const createMovie = async (req, res) => {
  const {
    title, synopsis, duration, ageRating, language,
    price, poster, director, releaseDate, status, trailerUrl, genres,
  } = req.body;

  if (!title || !director || !poster || !price || !duration || !status ||
      !Array.isArray(genres) || genres.length === 0) {
    return res.status(400).json({
      success: false,
      message: "title, director, poster, price, duration, status, and at least one genre are required.",
    });
  }
  if (Number(price) <= 0 || Number(duration) <= 0) {
    return res.status(400).json({
      success: false,
      message: "price and duration must be greater than 0.",
    });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${VALID_STATUSES.join(", ")}.`,
    });
  }

  const conn = await pool.getConnection();
  try {
    const [genreRows] = await conn.query(
      "SELECT genre_id, genre_name FROM GENRE WHERE genre_name IN (?)",
      [genres]
    );
    if (genreRows.length !== genres.length) {
      return res.status(400).json({ success: false, message: "One or more genres do not exist." });
    }

    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO MOVIE
        (title, synopsis, duration, age_rating, language, base_price,
         poster, director, release_date, status, trailer_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, synopsis || null, duration, ageRating || null, language || null,
       price, poster, director, releaseDate || null, status, trailerUrl || null]
    );

    const movieId = result.insertId;
    await conn.query(
      "INSERT INTO MOVIE_GENRE (movie_id, genre_id) VALUES ?",
      [genreRows.map((g) => [movieId, g.genre_id])]
    );

    await conn.commit();

    return res.status(201).json({
      success: true,
      message: "Movie created.",
      movie: { movieId, title, director, status, genres },
    });
  } catch (error) {
    await conn.rollback();
    console.error("createMovie error:", error);
    return res.status(500).json({ success: false, message: "Failed to create movie." });
  } finally {
    conn.release();
  }
};

// PUT /api/admin/movies/:id
const updateMovie = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid movie ID." });
  }

  const {
    title, synopsis, duration, ageRating, language,
    price, poster, director, releaseDate, status, trailerUrl, genres,
  } = req.body;

  if (!title || !director || !poster || !price || !duration || !status ||
      !Array.isArray(genres) || genres.length === 0) {
    return res.status(400).json({
      success: false,
      message: "title, director, poster, price, duration, status, and at least one genre are required.",
    });
  }
  if (Number(price) <= 0 || Number(duration) <= 0) {
    return res.status(400).json({
      success: false,
      message: "price and duration must be greater than 0.",
    });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${VALID_STATUSES.join(", ")}.`,
    });
  }

  const conn = await pool.getConnection();
  try {
    const [existing] = await conn.query("SELECT movie_id FROM MOVIE WHERE movie_id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Movie not found." });
    }

    const [genreRows] = await conn.query(
      "SELECT genre_id, genre_name FROM GENRE WHERE genre_name IN (?)",
      [genres]
    );
    if (genreRows.length !== genres.length) {
      return res.status(400).json({ success: false, message: "One or more genres do not exist." });
    }

    await conn.beginTransaction();

    await conn.query(
      `UPDATE MOVIE SET
         title = ?, synopsis = ?, duration = ?, age_rating = ?, language = ?,
         base_price = ?, poster = ?, director = ?, release_date = ?, status = ?, trailer_url = ?
       WHERE movie_id = ?`,
      [title, synopsis || null, duration, ageRating || null, language || null,
       price, poster, director, releaseDate || null, status, trailerUrl || null, id]
    );

    // Simplest correct way to sync genres: wipe and re-insert rather than diffing.
    await conn.query("DELETE FROM MOVIE_GENRE WHERE movie_id = ?", [id]);
    await conn.query(
      "INSERT INTO MOVIE_GENRE (movie_id, genre_id) VALUES ?",
      [genreRows.map((g) => [id, g.genre_id])]
    );

    await conn.commit();

    return res.status(200).json({
      success: true,
      message: "Movie updated.",
      movie: { movieId: id, title, director, status, genres },
    });
  } catch (error) {
    await conn.rollback();
    console.error("updateMovie error:", error);
    return res.status(500).json({ success: false, message: "Failed to update movie." });
  } finally {
    conn.release();
  }
};

// DELETE /api/admin/movies/:id
//
// Decision (documented per Week 3 checklist): deletion is BLOCKED if the movie
// has any existing showtimes, rather than cascading or leaving them orphaned.
// Rationale: a showtime pointing at a deleted movie would break the Showtime
// Selection and Booking pages downstream. Admin must remove/reassign the
// movie's showtimes first. Revisit this with Database/QA if a cascade or
// "archive instead of delete" approach is preferred later.
const deleteMovie = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid movie ID." });
  }

  try {
    const [existing] = await pool.query("SELECT movie_id FROM MOVIE WHERE movie_id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Movie not found." });
    }

    const [showtimes] = await pool.query(
      "SELECT showtime_id FROM SHOWTIME WHERE movie_id = ? LIMIT 1",
      [id]
    );
    if (showtimes.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete a movie that has existing showtimes. Remove its showtimes first.",
      });
    }

    // MOVIE_GENRE rows for this movie are cleaned up first to avoid an FK constraint error.
    await pool.query("DELETE FROM MOVIE_GENRE WHERE movie_id = ?", [id]);
    await pool.query("DELETE FROM MOVIE WHERE movie_id = ?", [id]);

    return res.status(200).json({ success: true, message: "Movie deleted." });
  } catch (error) {
    console.error("deleteMovie error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete movie." });
  }
};

module.exports = { getAllMovies, getMovieById, createMovie, updateMovie, deleteMovie };
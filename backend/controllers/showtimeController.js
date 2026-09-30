// controllers/showtimeController.js
// Public + admin showtime logic (routes decide which is which).
//
// Naming note: the DB table is SCREENING (see database/schema.sql), but the
// product/API vocabulary everywhere else (frontend, task briefs) is
// "showtime". We alias screening_id AS showtime_id in every query so the API
// speaks "showtime" consistently, even though the underlying table is
// SCREENING. (This also sidesteps the bug in movieController.deleteMovie,
// which queries a nonexistent `SHOWTIME` table — worth fixing separately.)

const pool = require("../config/database");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;
const VALID_STATUSES = ["scheduled", "cancelled", "completed"];

// Base query: one row per showtime, with cinema/branch info joined in so the
// frontend doesn't need a second round trip just to label the cinema.
const SHOWTIME_SELECT = `
  SELECT
    s.screening_id AS showtime_id,
    s.movie_id,
    s.cinema_id,
    s.show_date,
    s.show_time,
    s.total_seats,
    s.booked_seats,
    s.status,
    c.branch_id,
    c.cinema_num,
    b.branch_name
  FROM SCREENING s
  JOIN CINEMA c ON c.cinema_id = s.cinema_id
  JOIN BRANCH b ON b.branch_id = c.branch_id
`;

const formatShowtime = (row) => ({
  ...row,
  seatsAvailable: row.total_seats - row.booked_seats,
});

const isPositiveInt = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

// GET /api/showtimes?movieId=&cinemaId=&date=
const getAllShowtimes = async (req, res) => {
  const { movieId, cinemaId, date } = req.query;
  const conditions = [];
  const params = [];

  if (movieId !== undefined) {
    if (!isPositiveInt(movieId)) {
      return res.status(400).json({ success: false, message: "movieId must be a positive integer." });
    }
    conditions.push("s.movie_id = ?");
    params.push(Number(movieId));
  }

  if (cinemaId !== undefined) {
    if (!isPositiveInt(cinemaId)) {
      return res.status(400).json({ success: false, message: "cinemaId must be a positive integer." });
    }
    conditions.push("s.cinema_id = ?");
    params.push(Number(cinemaId));
  }

  if (date !== undefined) {
    if (!DATE_RE.test(date)) {
      return res.status(400).json({ success: false, message: "date must be in YYYY-MM-DD format." });
    }
    conditions.push("s.show_date = ?");
    params.push(date);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const [rows] = await pool.query(
      `${SHOWTIME_SELECT} ${where} ORDER BY s.show_date, s.show_time`,
      params
    );
    return res.status(200).json({ success: true, showtimes: rows.map(formatShowtime) });
  } catch (error) {
    console.error("getAllShowtimes error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch showtimes." });
  }
};

// GET /api/movies/:id/showtimes
// Powers the (not-yet-wired) Showtime Selection page — built now per spec so
// Frontend has a real endpoint ready when they get to it.
const getShowtimesForMovie = async (req, res) => {
  const movieId = Number(req.params.id);
  if (!Number.isInteger(movieId) || movieId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid movie ID." });
  }

  try {
    const [movieRows] = await pool.query("SELECT movie_id FROM MOVIE WHERE movie_id = ?", [movieId]);
    if (movieRows.length === 0) {
      return res.status(404).json({ success: false, message: "Movie not found." });
    }

    const [rows] = await pool.query(
      `${SHOWTIME_SELECT} WHERE s.movie_id = ? ORDER BY s.show_date, s.show_time`,
      [movieId]
    );
    return res.status(200).json({ success: true, movieId, showtimes: rows.map(formatShowtime) });
  } catch (error) {
    console.error("getShowtimesForMovie error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch showtimes for movie." });
  }
};

// POST /api/admin/showtimes  ("Add Showtime")
const createShowtime = async (req, res) => {
  const { movieId, cinemaId, showDate, showTime, totalSeats, status } = req.body;

  if (!isPositiveInt(movieId) || !isPositiveInt(cinemaId) || !isPositiveInt(totalSeats)) {
    return res.status(400).json({
      success: false,
      message: "movieId, cinemaId, and totalSeats are required and must be positive integers.",
    });
  }
  if (!DATE_RE.test(showDate || "")) {
    return res.status(400).json({ success: false, message: "showDate must be in YYYY-MM-DD format." });
  }
  if (!TIME_RE.test(showTime || "")) {
    return res.status(400).json({ success: false, message: "showTime must be in HH:MM or HH:MM:SS format." });
  }
  const finalStatus = status || "scheduled";
  if (!VALID_STATUSES.includes(finalStatus)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${VALID_STATUSES.join(", ")}.`,
    });
  }

  try {
    const [movieRows] = await pool.query("SELECT movie_id FROM MOVIE WHERE movie_id = ?", [movieId]);
    if (movieRows.length === 0) {
      return res.status(400).json({ success: false, message: "Movie does not exist." });
    }
    const [cinemaRows] = await pool.query("SELECT cinema_id FROM CINEMA WHERE cinema_id = ?", [cinemaId]);
    if (cinemaRows.length === 0) {
      return res.status(400).json({ success: false, message: "Cinema does not exist." });
    }

    // Guard against double-booking the same cinema at the same date/time.
    const [conflicts] = await pool.query(
      "SELECT screening_id FROM SCREENING WHERE cinema_id = ? AND show_date = ? AND show_time = ?",
      [cinemaId, showDate, showTime]
    );
    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: "This cinema already has a showtime scheduled at that date and time.",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO SCREENING (movie_id, cinema_id, show_date, show_time, total_seats, booked_seats, status)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [movieId, cinemaId, showDate, showTime, totalSeats, finalStatus]
    );

    const [rows] = await pool.query(`${SHOWTIME_SELECT} WHERE s.screening_id = ?`, [result.insertId]);
    return res.status(201).json({
      success: true,
      message: "Showtime created.",
      showtime: formatShowtime(rows[0]),
    });
  } catch (error) {
    console.error("createShowtime error:", error);
    return res.status(500).json({ success: false, message: "Failed to create showtime." });
  }
};

// PUT /api/admin/showtimes/:id  ("Reschedule" — date/time/cinema only)
const updateShowtime = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid showtime ID." });
  }

  const { cinemaId, showDate, showTime } = req.body;
  if (!isPositiveInt(cinemaId)) {
    return res.status(400).json({ success: false, message: "cinemaId is required and must be a positive integer." });
  }
  if (!DATE_RE.test(showDate || "")) {
    return res.status(400).json({ success: false, message: "showDate must be in YYYY-MM-DD format." });
  }
  if (!TIME_RE.test(showTime || "")) {
    return res.status(400).json({ success: false, message: "showTime must be in HH:MM or HH:MM:SS format." });
  }

  try {
    const [existing] = await pool.query("SELECT screening_id FROM SCREENING WHERE screening_id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Showtime not found." });
    }

    const [cinemaRows] = await pool.query("SELECT cinema_id FROM CINEMA WHERE cinema_id = ?", [cinemaId]);
    if (cinemaRows.length === 0) {
      return res.status(400).json({ success: false, message: "Cinema does not exist." });
    }

    const [conflicts] = await pool.query(
      "SELECT screening_id FROM SCREENING WHERE cinema_id = ? AND show_date = ? AND show_time = ? AND screening_id != ?",
      [cinemaId, showDate, showTime, id]
    );
    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: "This cinema already has a showtime scheduled at that date and time.",
      });
    }

    await pool.query(
      "UPDATE SCREENING SET cinema_id = ?, show_date = ?, show_time = ? WHERE screening_id = ?",
      [cinemaId, showDate, showTime, id]
    );

    const [rows] = await pool.query(`${SHOWTIME_SELECT} WHERE s.screening_id = ?`, [id]);
    return res.status(200).json({
      success: true,
      message: "Showtime rescheduled.",
      showtime: formatShowtime(rows[0]),
    });
  } catch (error) {
    console.error("updateShowtime error:", error);
    return res.status(500).json({ success: false, message: "Failed to reschedule showtime." });
  }
};

// DELETE /api/admin/showtimes/:id
//
// Decision (same rationale as movieController.deleteMovie): blocked, not
// cascaded, if the showtime already has bookings — otherwise a ticket
// holder's booking would point at nothing. Admin must handle
// cancellation/refunds through a separate flow first.
const deleteShowtime = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid showtime ID." });
  }

  try {
    const [existing] = await pool.query(
      "SELECT screening_id, booked_seats FROM SCREENING WHERE screening_id = ?",
      [id]
    );
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: "Showtime not found." });
    }
    if (existing[0].booked_seats > 0) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete a showtime that already has bookings.",
      });
    }

    await pool.query("DELETE FROM SCREENING WHERE screening_id = ?", [id]);
    return res.status(200).json({ success: true, message: "Showtime deleted." });
  } catch (error) {
    console.error("deleteShowtime error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete showtime." });
  }
};

module.exports = {
  getAllShowtimes,
  getShowtimesForMovie,
  createShowtime,
  updateShowtime,
  deleteShowtime,
};

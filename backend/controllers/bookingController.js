// controllers/bookingController.js
// Admin booking management.
//
// A "booking" is one TOTAL_PURCHASE row. Its movie/showtime/branch aren't
// stored on the purchase itself — they come from its TICKETs, so every query
// joins TICKET -> SCREENING -> CINEMA. We alias purchase_id AS booking_id so
// the API speaks "booking" (same idea as showtime_id in showtimeController).

const pool = require("../config/database");
const { parseBranchId } = require("../utils/branchScope");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = ["pending", "confirmed", "cancelled"];

// One row per (purchase, showtime). Seat labels like "A1" are built from
// row_num (1 = A) + seat_num.
const BOOKING_SELECT = `
  SELECT
    p.purchase_id AS booking_id,
    p.status,
    p.payment_method,
    p.total_price,
    p.purchase_datetime,
    u.user_id,
    u.name AS customer_name,
    u.email AS customer_email,
    s.screening_id AS showtime_id,
    s.show_date,
    s.show_time,
    m.movie_id,
    m.title AS movie_title,
    c.cinema_id,
    c.cinema_num,
    b.branch_id,
    b.branch_name,
    COUNT(t.ticket_id) AS ticket_count,
    GROUP_CONCAT(
      CONCAT(CHAR(64 + se.row_num USING utf8mb4), se.seat_num)
      ORDER BY se.row_num, se.seat_num SEPARATOR ','
    ) AS seats
  FROM TOTAL_PURCHASE p
  JOIN \`USER\` u ON u.user_id = p.user_id
  JOIN TICKET t ON t.purchase_id = p.purchase_id
  JOIN SEAT se ON se.seat_id = t.seat_id
  JOIN SCREENING s ON s.screening_id = t.screening_id
  JOIN MOVIE m ON m.movie_id = s.movie_id
  JOIN CINEMA c ON c.cinema_id = s.cinema_id
  JOIN BRANCH b ON b.branch_id = c.branch_id
`;
const BOOKING_GROUP_BY = "GROUP BY p.purchase_id, s.screening_id";

const formatBooking = (row) => ({
  ...row,
  total_price: Number(row.total_price),
  seats: row.seats ? row.seats.split(",") : [],
});

const isPositiveInt = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

// GET /api/admin/bookings?branchId=&status=&date=&movieId=
// branchId is required: admins only ever see their own branch.
// date filters on the showtime date (show_date), not the purchase date.
const getAdminBookings = async (req, res) => {
  const { status, date, movieId } = req.query;

  const scope = parseBranchId(req.query.branchId, { required: true });
  if (scope.error) {
    return res.status(400).json({ success: false, message: scope.error });
  }

  const conditions = ["c.branch_id = ?"];
  const params = [scope.branchId];

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${VALID_STATUSES.join(", ")}.`,
      });
    }
    conditions.push("p.status = ?");
    params.push(status);
  }

  if (date !== undefined) {
    if (!DATE_RE.test(date)) {
      return res.status(400).json({ success: false, message: "date must be in YYYY-MM-DD format." });
    }
    conditions.push("s.show_date = ?");
    params.push(date);
  }

  if (movieId !== undefined) {
    if (!isPositiveInt(movieId)) {
      return res.status(400).json({ success: false, message: "movieId must be a positive integer." });
    }
    conditions.push("s.movie_id = ?");
    params.push(Number(movieId));
  }

  try {
    const [rows] = await pool.query(
      `${BOOKING_SELECT} WHERE ${conditions.join(" AND ")} ${BOOKING_GROUP_BY}
       ORDER BY s.show_date DESC, s.show_time DESC, p.purchase_id DESC`,
      params
    );
    return res.status(200).json({ success: true, bookings: rows.map(formatBooking) });
  } catch (error) {
    console.error("getAdminBookings error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch bookings." });
  }
};

// PATCH /api/admin/bookings/:id?branchId=   body (optional): { "status": "cancelled" }
// Cancels the booking and releases its seats. The purchase and its tickets
// are kept (status = 'cancelled') as a record; seat availability ignores
// tickets on cancelled purchases, so the seats become sellable again.
const cancelBooking = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid booking ID." });
  }

  const scope = parseBranchId(req.query.branchId);
  if (scope.error) {
    return res.status(400).json({ success: false, message: scope.error });
  }

  const requestedStatus = req.body?.status;
  if (requestedStatus !== undefined && requestedStatus !== "cancelled") {
    return res.status(400).json({
      success: false,
      message: 'Only cancellation is supported: status must be "cancelled".',
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the purchase so two admins can't cancel it at the same time.
    const [purchases] = await conn.query(
      "SELECT purchase_id, status FROM TOTAL_PURCHASE WHERE purchase_id = ? FOR UPDATE",
      [id]
    );
    const [tickets] = await conn.query(
      `SELECT t.seat_id, t.screening_id, c.branch_id
       FROM TICKET t
       JOIN SCREENING s ON s.screening_id = t.screening_id
       JOIN CINEMA c ON c.cinema_id = s.cinema_id
       WHERE t.purchase_id = ?`,
      [id]
    );

    // Another branch's booking is reported as "not found" so admins can't
    // probe for bookings outside their branch.
    const outOfScope =
      scope.branchId !== null &&
      (tickets.length === 0 || tickets.some((t) => t.branch_id !== scope.branchId));
    if (purchases.length === 0 || outOfScope) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Booking not found." });
    }
    if (purchases[0].status === "cancelled") {
      await conn.rollback();
      return res.status(409).json({ success: false, message: "Booking is already cancelled." });
    }

    await conn.query("UPDATE TOTAL_PURCHASE SET status = 'cancelled' WHERE purchase_id = ?", [id]);

    // Release each seat (clears any 'booked' marker the booking flow left).
    for (const t of tickets) {
      await conn.query(
        "UPDATE SEATBOOKING SET status = 'available', held_until = NULL WHERE seat_id = ? AND screening_id = ?",
        [t.seat_id, t.screening_id]
      );
    }

    // Keep SCREENING.booked_seats in sync (it drives seatsAvailable on showtimes).
    const releasedPerShowtime = {};
    for (const t of tickets) {
      releasedPerShowtime[t.screening_id] = (releasedPerShowtime[t.screening_id] || 0) + 1;
    }
    for (const [screeningId, count] of Object.entries(releasedPerShowtime)) {
      await conn.query(
        "UPDATE SCREENING SET booked_seats = GREATEST(booked_seats - ?, 0) WHERE screening_id = ?",
        [count, screeningId]
      );
    }

    await conn.commit();

    const [rows] = await pool.query(
      `${BOOKING_SELECT} WHERE p.purchase_id = ? ${BOOKING_GROUP_BY}`,
      [id]
    );
    return res.status(200).json({
      success: true,
      message: "Booking cancelled and seats released.",
      seatsReleased: tickets.length,
      booking: rows.length ? formatBooking(rows[0]) : null,
    });
  } catch (error) {
    await conn.rollback();
    console.error("cancelBooking error:", error);
    return res.status(500).json({ success: false, message: "Failed to cancel booking." });
  } finally {
    conn.release();
  }
};

module.exports = { getAdminBookings, cancelBooking };

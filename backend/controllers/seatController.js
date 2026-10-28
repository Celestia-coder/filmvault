// controllers/seatController.js
// Admin seat map + Seat Inspector actions for a single showtime.
//
// A seat's status for a showtime is derived, in priority order:
//   sold      — has a TICKET on a purchase that isn't cancelled
//   blocked   — SEAT.seat_status isn't 'active' (physically out of service),
//               or SEATBOOKING.status = 'blocked' (admin blocked it)
//   held      — SEATBOOKING.status = 'held' and held_until is still in the future
//   available — everything else (no SEATBOOKING row also means available)

const pool = require("../config/database");
const { parseBranchId } = require("../utils/branchScope");

const SEAT_ACTIONS = { block: "blocked", release: "available" };

// All seats of a cinema with their state for one showtime.
// Pass seatId to fetch a single seat. Works with the pool or a transaction conn.
const fetchSeats = async (db, cinemaId, screeningId, seatId = null) => {
  const [rows] = await db.query(
    `SELECT
       se.seat_id,
       se.row_num,
       se.seat_num,
       se.seat_status,
       sb.status AS booking_status,
       (sb.held_until IS NOT NULL AND sb.held_until > NOW()) AS hold_active,
       sb.held_until,
       t.ticket_id,
       t.ticket_price,
       t.purchase_id
     FROM SEAT se
     LEFT JOIN SEATBOOKING sb
       ON sb.seat_id = se.seat_id AND sb.screening_id = ?
     LEFT JOIN (
       TICKET t JOIN TOTAL_PURCHASE p
         ON p.purchase_id = t.purchase_id AND p.status <> 'cancelled'
     ) ON t.seat_id = se.seat_id AND t.screening_id = ?
     WHERE se.cinema_id = ? ${seatId !== null ? "AND se.seat_id = ?" : ""}
     ORDER BY se.row_num, se.seat_num`,
    seatId !== null ? [screeningId, screeningId, cinemaId, seatId] : [screeningId, screeningId, cinemaId]
  );
  return rows.map(formatSeat);
};

const formatSeat = (row) => {
  let status = "available";
  if (row.ticket_id) status = "sold";
  else if (row.seat_status !== "active" || row.booking_status === "blocked") status = "blocked";
  else if (row.booking_status === "held" && row.hold_active) status = "held";

  return {
    seat_id: row.seat_id,
    label: `${String.fromCharCode(64 + row.row_num)}${row.seat_num}`,
    row_num: row.row_num,
    seat_num: row.seat_num,
    status,
    held_until: status === "held" ? row.held_until : null,
    booking_id: row.purchase_id || null,
    ticket_price: row.ticket_price !== null ? Number(row.ticket_price) : null,
  };
};

const computeStats = (seats) => {
  const count = (status) => seats.filter((s) => s.status === status).length;
  const revenue = seats.reduce((sum, s) => sum + (s.status === "sold" ? s.ticket_price : 0), 0);
  return {
    total: seats.length,
    available: count("available"),
    sold: count("sold"),
    held: count("held"),
    blocked: count("blocked"),
    revenue: Math.round(revenue * 100) / 100,
  };
};

// Group a flat seat list into rows for rendering the map.
const groupByRow = (seats) => {
  const rows = [];
  for (const seat of seats) {
    let row = rows[rows.length - 1];
    if (!row || row.row_num !== seat.row_num) {
      row = { row_num: seat.row_num, label: seat.label.replace(/\d+$/, ""), seats: [] };
      rows.push(row);
    }
    row.seats.push(seat);
  }
  return rows;
};

// Showtime + its cinema/branch, or null.
const fetchShowtime = async (db, screeningId) => {
  const [rows] = await db.query(
    `SELECT
       s.screening_id AS showtime_id,
       s.movie_id,
       m.title AS movie_title,
       s.show_date,
       s.show_time,
       s.status,
       s.cinema_id,
       c.cinema_num,
       c.branch_id,
       b.branch_name
     FROM SCREENING s
     JOIN MOVIE m ON m.movie_id = s.movie_id
     JOIN CINEMA c ON c.cinema_id = s.cinema_id
     JOIN BRANCH b ON b.branch_id = c.branch_id
     WHERE s.screening_id = ?`,
    [screeningId]
  );
  return rows[0] || null;
};

// GET /api/admin/cinemas/:id/seat-map?showtimeId=&branchId=
const getSeatMap = async (req, res) => {
  const cinemaId = Number(req.params.id);
  if (!Number.isInteger(cinemaId) || cinemaId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid cinema ID." });
  }

  const showtimeId = Number(req.query.showtimeId);
  if (!Number.isInteger(showtimeId) || showtimeId <= 0) {
    return res.status(400).json({
      success: false,
      message: "showtimeId is required and must be a positive integer.",
    });
  }

  const scope = parseBranchId(req.query.branchId);
  if (scope.error) {
    return res.status(400).json({ success: false, message: scope.error });
  }

  try {
    const [cinemaRows] = await pool.query(
      "SELECT cinema_id, branch_id FROM CINEMA WHERE cinema_id = ?",
      [cinemaId]
    );
    if (cinemaRows.length === 0 || (scope.branchId !== null && cinemaRows[0].branch_id !== scope.branchId)) {
      return res.status(404).json({ success: false, message: "Cinema not found." });
    }

    const showtime = await fetchShowtime(pool, showtimeId);
    if (!showtime) {
      return res.status(404).json({ success: false, message: "Showtime not found." });
    }
    if (showtime.cinema_id !== cinemaId) {
      return res.status(400).json({ success: false, message: "Showtime does not belong to this cinema." });
    }

    const seats = await fetchSeats(pool, cinemaId, showtimeId);
    return res.status(200).json({
      success: true,
      showtime,
      stats: computeStats(seats),
      rows: groupByRow(seats),
    });
  } catch (error) {
    console.error("getSeatMap error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch seat map." });
  }
};

// PUT /api/admin/showtimes/:id/seats/:seatId?branchId=   body: { "action": "block" | "release" }
// Seat Inspector: block a seat for this showtime, or release it back to available.
// Sold seats can't be touched here — cancel the booking instead.
// "release" also clears a customer hold (e.g. a stuck checkout).
const updateSeatStatus = async (req, res) => {
  const showtimeId = Number(req.params.id);
  const seatId = Number(req.params.seatId);
  if (!Number.isInteger(showtimeId) || showtimeId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid showtime ID." });
  }
  if (!Number.isInteger(seatId) || seatId <= 0) {
    return res.status(400).json({ success: false, message: "Invalid seat ID." });
  }

  const scope = parseBranchId(req.query.branchId);
  if (scope.error) {
    return res.status(400).json({ success: false, message: scope.error });
  }

  const action = req.body?.action;
  const newStatus = SEAT_ACTIONS[action];
  if (!newStatus) {
    return res.status(400).json({
      success: false,
      message: `action is required and must be one of: ${Object.keys(SEAT_ACTIONS).join(", ")}.`,
    });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const showtime = await fetchShowtime(conn, showtimeId);
    if (!showtime || (scope.branchId !== null && showtime.branch_id !== scope.branchId)) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Showtime not found." });
    }

    // Lock this seat's SEATBOOKING row (if any) while we check and update it.
    await conn.query(
      "SELECT status FROM SEATBOOKING WHERE seat_id = ? AND screening_id = ? FOR UPDATE",
      [seatId, showtimeId]
    );

    const [seat] = await fetchSeats(conn, showtime.cinema_id, showtimeId, seatId);
    if (!seat) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Seat not found in this showtime's cinema." });
    }
    if (seat.status === "sold") {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: "Seat is sold. Cancel the booking to release it.",
      });
    }
    if (action === "block" && seat.status === "held") {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: "Seat is currently held by a customer. Release it first.",
      });
    }

    const [physical] = await conn.query("SELECT seat_status FROM SEAT WHERE seat_id = ?", [seatId]);
    if (action === "release" && physical[0].seat_status !== "active") {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: "Seat is out of service and can't be released for this showtime.",
      });
    }

    await conn.query(
      `INSERT INTO SEATBOOKING (seat_id, screening_id, status, held_until)
       VALUES (?, ?, ?, NULL)
       ON DUPLICATE KEY UPDATE status = ?, held_until = NULL`,
      [seatId, showtimeId, newStatus, newStatus]
    );

    const [updated] = await fetchSeats(conn, showtime.cinema_id, showtimeId, seatId);
    await conn.commit();

    return res.status(200).json({
      success: true,
      message: action === "block" ? "Seat blocked." : "Seat released.",
      seat: updated,
    });
  } catch (error) {
    await conn.rollback();
    console.error("updateSeatStatus error:", error);
    return res.status(500).json({ success: false, message: "Failed to update seat." });
  } finally {
    conn.release();
  }
};

module.exports = { getSeatMap, updateSeatStatus };

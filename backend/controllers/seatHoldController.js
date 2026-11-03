// controllers/seatHoldController.js
// Customer-facing seat endpoints: the seat map for a showtime and temporary
// seat holds. (The admin seat map and Seat Inspector live in seatController.js.)
//
// Status rules are the SAME as the admin seatController.js so both sides agree:
//   booked    - has a TICKET on a purchase that isn't cancelled
//               (the admin side calls this "sold")
//   blocked   - SEAT.seat_status isn't 'active' (out of service), or
//               SEATBOOKING.status = 'blocked' (an admin blocked it)
//   held      - SEATBOOKING.status = 'held' and held_until is still in the future
//   available - everything else (no SEATBOOKING row also means available)
//
// Expired holds are released lazily: nothing runs on a timer. A hold whose
// held_until has passed simply counts as available the next time the map is
// read or a hold is attempted.
//
// "showtime" in the API = SCREENING in the database.

const pool = require("../config/database");

const HOLD_MINUTES = 10; // SRS 2.5: seats are locked for a maximum of 10 minutes
const MAX_SEATS_PER_HOLD = 8; // SRS: 1 to 8 tickets per transaction

const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

// 1 -> "A", 2 -> "B", ...
const rowLabel = (rowNum) => String.fromCharCode(64 + rowNum);

const resolveStatus = (row) => {
  if (row.ticket_id) return "booked";
  if (row.seat_status !== "active" || row.booking_status === "blocked") return "blocked";
  if (row.booking_status === "held" && row.hold_active) return "held";
  return "available";
};

// GET /api/showtimes/:id/seats?userId=
// userId is optional. When given, seats the user already holds come back with
// heldByYou: true, so the page can let them pick those seats again.
const getSeatMap = async (req, res) => {
  const showtimeId = Number(req.params.id);
  if (!isPositiveInt(showtimeId)) {
    return res.status(400).json({ success: false, message: "Invalid showtime ID." });
  }

  let userId = null;
  if (req.query.userId !== undefined) {
    userId = Number(req.query.userId);
    if (!isPositiveInt(userId)) {
      return res.status(400).json({ success: false, message: "userId must be a positive integer." });
    }
  }

  try {
    const [screenings] = await pool.query(
      `SELECT s.screening_id, s.cinema_id, c.cinema_num, c.branch_id
       FROM SCREENING s
       JOIN CINEMA c ON c.cinema_id = s.cinema_id
       WHERE s.screening_id = ?`,
      [showtimeId]
    );
    if (screenings.length === 0) {
      return res.status(404).json({ success: false, message: "Showtime not found." });
    }
    const screening = screenings[0];

    const [rows] = await pool.query(
      `SELECT
         se.seat_id, se.row_num, se.seat_num, se.seat_status,
         sb.status AS booking_status,
         sb.held_by,
         (sb.held_until IS NOT NULL AND sb.held_until > NOW()) AS hold_active,
         t.ticket_id
       FROM SEAT se
       LEFT JOIN SEATBOOKING sb
         ON sb.seat_id = se.seat_id AND sb.screening_id = ?
       LEFT JOIN (
         TICKET t JOIN TOTAL_PURCHASE p
           ON p.purchase_id = t.purchase_id AND p.status <> 'cancelled'
       ) ON t.seat_id = se.seat_id AND t.screening_id = ?
       WHERE se.cinema_id = ?
       ORDER BY se.row_num, se.seat_num`,
      [showtimeId, showtimeId, screening.cinema_id]
    );

    const seats = rows.map((r) => {
      const status = resolveStatus(r);
      return {
        id: r.seat_id,
        label: `${rowLabel(r.row_num)}${r.seat_num}`,
        row: rowLabel(r.row_num),
        rowNum: r.row_num,
        number: r.seat_num,
        status,
        heldByYou: status === "held" && userId !== null && r.held_by === userId,
      };
    });

    return res.status(200).json({
      success: true,
      showtimeId,
      cinema: {
        cinemaId: screening.cinema_id,
        cinemaNum: screening.cinema_num,
        branchId: screening.branch_id,
        rows: rows.reduce((max, r) => Math.max(max, r.row_num), 0),
        seatsPerRow: rows.reduce((max, r) => Math.max(max, r.seat_num), 0),
        // TODO: the schema has no aisle info yet. null = the frontend picks the
        // aisle position itself until Database adds a column for it.
        aisleAfter: null,
      },
      seats,
    });
  } catch (error) {
    console.error("getSeatMap error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch seat map." });
  }
};

// POST /api/showtimes/:id/seats/hold
// Body: { userId, seatIds: [12, 13] }
//
// TODO (must fix before real deployment): userId comes from the request body
// because there is no real auth yet. Anyone can claim to be any user.
const holdSeats = async (req, res) => {
  const showtimeId = Number(req.params.id);
  const userId = Number(req.body?.userId);
  const seatIds = req.body?.seatIds;

  if (!isPositiveInt(showtimeId)) {
    return res.status(400).json({ success: false, message: "Invalid showtime ID." });
  }
  if (!isPositiveInt(userId)) {
    return res.status(400).json({ success: false, message: "userId is required." });
  }
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    return res.status(400).json({ success: false, message: "seatIds must be a non-empty array." });
  }
  // Sorted so concurrent requests lock rows in the same order (avoids deadlocks).
  const ids = seatIds.map(Number).sort((a, b) => a - b);
  if (!ids.every(isPositiveInt) || new Set(ids).size !== ids.length) {
    return res.status(400).json({ success: false, message: "seatIds must be unique positive integers." });
  }
  if (ids.length > MAX_SEATS_PER_HOLD) {
    return res.status(400).json({
      success: false,
      message: `You can hold at most ${MAX_SEATS_PER_HOLD} seats per transaction.`,
    });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const [users] = await conn.query("SELECT user_id FROM `USER` WHERE user_id = ?", [userId]);
    if (users.length === 0) {
      return res.status(400).json({ success: false, message: "User does not exist." });
    }

    const [screenings] = await conn.query(
      "SELECT screening_id, cinema_id, status FROM SCREENING WHERE screening_id = ?",
      [showtimeId]
    );
    if (screenings.length === 0) {
      return res.status(404).json({ success: false, message: "Showtime not found." });
    }
    const screening = screenings[0];
    if (screening.status !== "scheduled") {
      return res.status(409).json({ success: false, message: "This showtime is not open for booking." });
    }

    // Every requested seat must physically belong to this showtime's cinema.
    const [seatRows] = await conn.query(
      "SELECT seat_id, seat_status FROM SEAT WHERE cinema_id = ? AND seat_id IN (?)",
      [screening.cinema_id, ids]
    );
    const seatById = new Map(seatRows.map((s) => [s.seat_id, s]));
    const unknown = ids.filter((id) => !seatById.has(id));
    if (unknown.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some seats do not belong to this showtime's cinema.",
        invalidSeatIds: unknown,
      });
    }

    await conn.beginTransaction();

    // Make sure a SEATBOOKING row exists for each seat so there is a row to lock.
    await conn.query(
      "INSERT IGNORE INTO SEATBOOKING (seat_id, screening_id, status) VALUES ?",
      [ids.map((id) => [id, showtimeId, "available"])]
    );

    // Lock the rows: a second user holding the same seat waits here, then
    // sees it as held and is rejected below.
    const [locked] = await conn.query(
      `SELECT seat_id, status, held_by,
              (held_until IS NOT NULL AND held_until > NOW()) AS hold_active
       FROM SEATBOOKING
       WHERE screening_id = ? AND seat_id IN (?)
       ORDER BY seat_id
       FOR UPDATE`,
      [showtimeId, ids]
    );

    // Seats already sold (a ticket on a purchase that isn't cancelled).
    const [bookedRows] = await conn.query(
      `SELECT t.seat_id
       FROM TICKET t
       JOIN TOTAL_PURCHASE p ON p.purchase_id = t.purchase_id AND p.status <> 'cancelled'
       WHERE t.screening_id = ? AND t.seat_id IN (?)`,
      [showtimeId, ids]
    );
    const bookedIds = new Set(bookedRows.map((r) => r.seat_id));

    const failedSeats = [];
    for (const row of locked) {
      const seat = seatById.get(row.seat_id);
      if (bookedIds.has(row.seat_id)) {
        failedSeats.push({ seatId: row.seat_id, reason: "booked" });
      } else if (seat.seat_status !== "active" || row.status === "blocked") {
        failedSeats.push({ seatId: row.seat_id, reason: "blocked" });
      } else if (row.status === "held" && row.hold_active && row.held_by !== userId) {
        failedSeats.push({ seatId: row.seat_id, reason: "held" });
      }
      // Otherwise it's free: available, an expired hold, or already held by
      // this same user (re-holding simply refreshes their timer).
    }

    if (failedSeats.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: "Some seats are no longer available.",
        failedSeats,
      });
    }

    await conn.query(
      `UPDATE SEATBOOKING
       SET status = 'held', held_by = ?, held_until = DATE_ADD(NOW(), INTERVAL ? MINUTE)
       WHERE screening_id = ? AND seat_id IN (?)`,
      [userId, HOLD_MINUTES, showtimeId, ids]
    );

    const [[hold]] = await conn.query(
      "SELECT held_until FROM SEATBOOKING WHERE screening_id = ? AND seat_id = ?",
      [showtimeId, ids[0]]
    );

    await conn.commit();

    // If this user picked different seats earlier for the same showtime, free
    // those now instead of leaving them locked for the rest of the 10 minutes.
    // Best effort: a failure here must not fail a hold that already succeeded.
    try {
      await conn.query(
        `UPDATE SEATBOOKING
         SET status = 'available', held_until = NULL, held_by = NULL
         WHERE screening_id = ? AND held_by = ? AND status = 'held' AND seat_id NOT IN (?)`,
        [showtimeId, userId, ids]
      );
    } catch (releaseError) {
      console.error("holdSeats: releasing earlier holds failed:", releaseError);
    }

    return res.status(200).json({
      success: true,
      message: "Seats held.",
      showtimeId,
      seatIds: ids,
      holdMinutes: HOLD_MINUTES,
      // The Checkout countdown should use expiresInSeconds (not affected by
      // server/browser clock or timezone differences).
      expiresInSeconds: HOLD_MINUTES * 60,
      heldUntil: hold.held_until,
    });
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        // no open transaction to roll back
      }
    }
    console.error("holdSeats error:", error);
    return res.status(500).json({ success: false, message: "Failed to hold seats." });
  } finally {
    if (conn) conn.release();
  }
};

module.exports = { getSeatMap, holdSeats };
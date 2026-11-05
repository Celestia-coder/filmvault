// controllers/customerBookingController.js
// Customer-facing bookings. (Admin booking management is bookingController.js.)
//
//   POST /api/bookings        finalize a booking from the user's held seats
//   GET  /api/bookings?userId=  the user's bookings, newest first
//   GET  /api/bookings/:id?userId=  one booking, with everything the e-ticket needs
//
// A "booking" is one TOTAL_PURCHASE row; each seat is a TICKET row.
// "showtime" in the API = SCREENING in the database.
//
// Error responses always look like { success: false, code, message, ... }.
// The Checkout page branches on `code`:
//   VALIDATION_ERROR (400)   bad/missing input
//   ID_IMAGE_REQUIRED (400)  a senior/PWD ticket needs an ID photo
//   INVALID_FILE_TYPE (415) / FILE_TOO_LARGE (413)   (from the upload middleware)
//   HOLD_EXPIRED (409)       the hold ran out (or was never made) - pick seats again
//   SEAT_TAKEN (409)         someone else got a seat; failedSeats lists them
//   SHOWTIME_UNAVAILABLE (409)
//   PAYMENT_FAILED (402)     payment didn't go through; the seats were released
//
// TODO (must fix before real deployment): userId comes from the request
// because there is no real auth yet - same stand-in as the seat hold endpoints.
// Once login sessions exist, take it from the session instead.

const fs = require("fs");
const crypto = require("crypto");
const pool = require("../config/database");
const paymentService = require("../services/paymentService");
const { calculatePrice, toCents } = require("../utils/pricing");

const MAX_SEATS_PER_BOOKING = 8; // SRS: 1 to 8 tickets per transaction
const MAX_SNACK_QUANTITY = 10; // per snack, matches the Checkout page
const TICKET_TYPE_NAMES = { regular: "Regular", senior: "Senior", pwd: "PWD" };
const PURCHASE_TYPES = Object.keys(TICKET_TYPE_NAMES);
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I - easy to read out loud
const MAX_REFERENCE_ATTEMPTS = 5;

const isPositiveInt = (value) => Number.isInteger(value) && value > 0;
const rowLabel = (rowNum) => String.fromCharCode(64 + rowNum); // 1 -> "A"

// Multipart forms only send strings, so accept either spelling of a field.
const pick = (body, ...keys) => {
  for (const key of keys) {
    if (body?.[key] !== undefined && body[key] !== "") return body[key];
  }
  return undefined;
};

// "[1,2]" | "1,2" | [1,2]  ->  [1, 2]   (undefined stays undefined)
const parseList = (raw) => {
  if (raw === undefined) return undefined;
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return String(raw).split(",").map((s) => s.trim()).filter(Boolean);
  }
};

// '{"41":"senior"}' | { 41: "senior" }  ->  object (undefined stays undefined)
const parseObject = (raw) => {
  if (raw === undefined) return undefined;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const generateReferenceCode = () => {
  let code = "FV-";
  for (let i = 0; i < 8; i += 1) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
};

// Thrown inside the booking transaction to stop it and send a specific error.
class BookingError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

/* ------------------------------ reading ------------------------------ */

// One row per ticket. Assembled into bookings in JS (see buildBookings).
const BOOKING_ROWS_SELECT = `
  SELECT
    p.purchase_id AS booking_id,
    p.reference_code,
    p.status,
    p.payment_status,
    p.payment_method,
    p.discount_type,
    p.total_price,
    DATE_FORMAT(p.purchase_datetime, '%Y-%m-%d %H:%i:%s') AS purchase_datetime,
    p.user_id,
    t.ticket_id,
    t.ticket_price,
    tt.type AS ticket_type,
    se.row_num,
    se.seat_num,
    s.screening_id AS showtime_id,
    s.show_date,
    s.show_time,
    m.movie_id,
    m.title AS movie_title,
    m.poster,
    m.duration,
    m.age_rating,
    m.language,
    c.cinema_id,
    c.cinema_num,
    b.branch_id,
    b.branch_name
  FROM TOTAL_PURCHASE p
  JOIN TICKET t ON t.purchase_id = p.purchase_id
  JOIN TICKET_TYPE tt ON tt.type_id = t.type_id
  JOIN SEAT se ON se.seat_id = t.seat_id
  JOIN SCREENING s ON s.screening_id = t.screening_id
  JOIN MOVIE m ON m.movie_id = s.movie_id
  JOIN CINEMA c ON c.cinema_id = s.cinema_id
  JOIN BRANCH b ON b.branch_id = c.branch_id
`;
const BOOKING_ROWS_ORDER = "ORDER BY p.purchase_datetime DESC, p.purchase_id DESC, se.row_num, se.seat_num";

// Rows (one per ticket, already in the order we want) -> bookings (one each).
// The id image path is deliberately NOT returned: it's a private server path.
const buildBookings = (rows) => {
  const byId = new Map();
  for (const r of rows) {
    if (!byId.has(r.booking_id)) {
      byId.set(r.booking_id, {
        booking_id: r.booking_id,
        reference_code: r.reference_code,
        status: r.status,
        payment_status: r.payment_status,
        payment_method: r.payment_method,
        discount_type: r.discount_type,
        total_price: Number(r.total_price),
        tickets_total: 0,
        snacks_total: 0,
        booking_fee: 0,
        purchase_datetime: r.purchase_datetime,
        user_id: r.user_id,
        showtime_id: r.showtime_id,
        show_date: r.show_date,
        show_time: r.show_time,
        movie_id: r.movie_id,
        movie_title: r.movie_title,
        poster: r.poster,
        duration: r.duration,
        age_rating: r.age_rating,
        language: r.language,
        cinema_id: r.cinema_id,
        cinema_num: r.cinema_num,
        branch_id: r.branch_id,
        branch_name: r.branch_name,
        ticket_count: 0,
        seats: [],
        tickets: [],
        snacks: [],
      });
    }
    const booking = byId.get(r.booking_id);
    const label = `${rowLabel(r.row_num)}${r.seat_num}`;
    booking.seats.push(label);
    booking.tickets.push({
      ticket_id: r.ticket_id,
      seat: label,
      ticket_type: r.ticket_type,
      ticket_price: Number(r.ticket_price),
    });
    booking.ticket_count += 1;
    booking.tickets_total = Number((booking.tickets_total + Number(r.ticket_price)).toFixed(2));
  }
  return [...byId.values()];
};

// Adds each booking's snacks (SNACK_PURCHASE) and works out the booking fee. The fee
// isn't stored on its own: it's what's left of the total after tickets and snacks,
// so it can always be worked out from saved data.
const withSnacks = async (bookings, db) => {
  const snacksByBooking = new Map();
  if (bookings.length > 0) {
    const [rows] = await db.query(
      `SELECT sp.purchase_id, sp.snack_id, sn.snack_name, sp.quantity, sp.subtotal
       FROM SNACK_PURCHASE sp JOIN SNACK sn ON sn.snack_id = sp.snack_id
       WHERE sp.purchase_id IN (?) ORDER BY sp.snack_id`,
      [bookings.map((b) => b.booking_id)]
    );
    for (const r of rows) {
      const list = snacksByBooking.get(r.purchase_id) ?? [];
      list.push({
        snack_id: r.snack_id,
        name: r.snack_name,
        quantity: r.quantity,
        unit_price: Number((Number(r.subtotal) / r.quantity).toFixed(2)),
        subtotal: Number(r.subtotal),
      });
      snacksByBooking.set(r.purchase_id, list);
    }
  }
  for (const booking of bookings) {
    booking.snacks = snacksByBooking.get(booking.booking_id) ?? [];
    booking.snacks_total = Number(booking.snacks.reduce((sum, s) => sum + s.subtotal, 0).toFixed(2));
    booking.booking_fee = Math.max(
      0,
      Number((booking.total_price - booking.tickets_total - booking.snacks_total).toFixed(2))
    );
  }
  return bookings;
};

// GET /api/bookings?userId=
const getUserBookings = async (req, res) => {
  const userId = Number(req.query.userId);
  if (!isPositiveInt(userId)) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "userId is required and must be a positive integer.",
    });
  }

  try {
    const [rows] = await pool.query(`${BOOKING_ROWS_SELECT} WHERE p.user_id = ? ${BOOKING_ROWS_ORDER}`, [userId]);
    const bookings = await withSnacks(buildBookings(rows), pool);
    return res.status(200).json({ success: true, bookings });
  } catch (error) {
    console.error("getUserBookings error:", error);
    return res.status(500).json({ success: false, code: "SERVER_ERROR", message: "Failed to fetch bookings." });
  }
};

const loadBooking = async (bookingId, db = pool) => {
  const [rows] = await db.query(`${BOOKING_ROWS_SELECT} WHERE p.purchase_id = ? ${BOOKING_ROWS_ORDER}`, [bookingId]);
  const [booking] = await withSnacks(buildBookings(rows), db);
  return booking ?? null;
};

// GET /api/bookings/:id?userId=
// userId is required and must own the booking; otherwise it's a 404, so nobody
// can read other people's bookings by guessing IDs. (Stand-in until real auth.)
const getBookingById = async (req, res) => {
  const bookingId = Number(req.params.id);
  const userId = Number(req.query.userId);
  if (!isPositiveInt(bookingId)) {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Invalid booking ID." });
  }
  if (!isPositiveInt(userId)) {
    return res.status(400).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "userId is required and must be a positive integer.",
    });
  }

  try {
    const booking = await loadBooking(bookingId);
    if (!booking || booking.user_id !== userId) {
      return res.status(404).json({ success: false, code: "NOT_FOUND", message: "Booking not found." });
    }
    return res.status(200).json({ success: true, booking });
  } catch (error) {
    console.error("getBookingById error:", error);
    return res.status(500).json({ success: false, code: "SERVER_ERROR", message: "Failed to fetch booking." });
  }
};

/* ------------------------------ creating ------------------------------ */

// Frees this user's holds. Runs AFTER the transaction is rolled back (it has to
// stick even though the booking didn't), and is best effort: if it fails, the
// holds still expire on their own, since expired holds already count as free.
const releaseHolds = async (conn, { showtimeId, userId, seatIds, onlyExpired }) => {
  try {
    const conditions = ["screening_id = ?", "held_by = ?", "status = 'held'"];
    const params = [showtimeId, userId];
    if (seatIds?.length) {
      conditions.push("seat_id IN (?)");
      params.push(seatIds);
    }
    if (onlyExpired) conditions.push("(held_until IS NULL OR held_until <= NOW())");
    await conn.query(
      `UPDATE SEATBOOKING SET status = 'available', held_until = NULL, held_by = NULL WHERE ${conditions.join(" AND ")}`,
      params
    );
  } catch (error) {
    console.error("releaseHolds failed:", error);
  }
};

// POST /api/bookings   (multipart/form-data, or JSON when there is no ID image)
//
// Fields:
//   userId, showtimeId            required
//   seatIds                       optional JSON array, e.g. [41,42]. Omit it to book
//                                 every seat the user currently holds for the showtime.
//   paymentMethod                 e.g. "gcash" (default "simulated")
//   discount_type                 "none" | "senior" | "pwd" - applies to every seat
//   ticketTypes                   optional JSON { "41": "senior", "42": "regular" }.
//                                 Per-seat types for Checkout's mixed bookings; when
//                                 given, it wins over discount_type.
//   idImage                       the ID photo (file). Required when any seat is discounted.
//   snacks                        optional JSON [{ "snackId": 1, "quantity": 2 }]. Priced from
//                                 the SNACK table and added to the total (never discounted).
const createBooking = async (req, res) => {
  const file = req.file;
  let fileKept = false; // true only once a booking that references the ID photo is saved
  const fail = (status, code, message, extra = {}) =>
    res.status(status).json({ success: false, code, message, ...extra });

  try {
    const body = req.body || {};

    const userId = Number(pick(body, "userId", "user_id"));
    const showtimeId = Number(pick(body, "showtimeId", "showtime_id"));
    const paymentMethod = String(pick(body, "paymentMethod", "payment_method") ?? "simulated").trim().slice(0, 50);
    const discountTypeInput = String(pick(body, "discountType", "discount_type") ?? "none").toLowerCase();

    if (!isPositiveInt(userId)) return fail(400, "VALIDATION_ERROR", "userId is required.");
    if (!isPositiveInt(showtimeId)) return fail(400, "VALIDATION_ERROR", "showtimeId is required.");
    if (!paymentMethod) return fail(400, "VALIDATION_ERROR", "paymentMethod can't be empty.");
    if (discountTypeInput !== "none" && !PURCHASE_TYPES.includes(discountTypeInput)) {
      return fail(400, "VALIDATION_ERROR", "discount_type must be one of: none, senior, pwd.");
    }

    // Seats: explicit list, or (undefined) every seat this user holds.
    let requestedSeatIds;
    const rawSeatIds = parseList(pick(body, "seatIds", "seat_ids"));
    if (rawSeatIds !== undefined) {
      requestedSeatIds = rawSeatIds.map(Number).sort((a, b) => a - b);
      if (
        requestedSeatIds.length === 0 ||
        !requestedSeatIds.every(isPositiveInt) ||
        new Set(requestedSeatIds).size !== requestedSeatIds.length
      ) {
        return fail(400, "VALIDATION_ERROR", "seatIds must be a non-empty list of unique seat IDs.");
      }
      if (requestedSeatIds.length > MAX_SEATS_PER_BOOKING) {
        return fail(400, "VALIDATION_ERROR", `You can book at most ${MAX_SEATS_PER_BOOKING} seats per transaction.`);
      }
    }

    const rawTypes = pick(body, "ticketTypes", "ticket_types");
    const typeOverrides = parseObject(rawTypes);
    if (rawTypes !== undefined) {
      if (typeOverrides === null || !Object.values(typeOverrides).every((t) => PURCHASE_TYPES.includes(t))) {
        return fail(400, "VALIDATION_ERROR", "ticketTypes must map seat IDs to regular, senior or pwd.");
      }
      if (requestedSeatIds && !Object.keys(typeOverrides).every((id) => requestedSeatIds.includes(Number(id)))) {
        return fail(400, "VALIDATION_ERROR", "ticketTypes lists a seat that isn't in seatIds.");
      }
    }

    // Snacks: [{ snackId, quantity }], each snack listed once.
    const snackRequests = [];
    const rawSnacks = parseList(pick(body, "snacks"));
    if (rawSnacks !== undefined) {
      const seenSnacks = new Set();
      for (const item of rawSnacks) {
        const snackId = Number(item?.snackId ?? item?.snack_id);
        const quantity = Number(item?.quantity);
        if (!isPositiveInt(snackId) || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_SNACK_QUANTITY) {
          return fail(400, "VALIDATION_ERROR", `Each snack needs a snackId and a quantity from 1 to ${MAX_SNACK_QUANTITY}.`);
        }
        if (seenSnacks.has(snackId)) return fail(400, "VALIDATION_ERROR", "Each snack can only be listed once.");
        seenSnacks.add(snackId);
        snackRequests.push({ snackId, quantity });
      }
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [screenings] = await conn.query(
        `SELECT s.screening_id, s.cinema_id, s.status, m.base_price
         FROM SCREENING s JOIN MOVIE m ON m.movie_id = s.movie_id
         WHERE s.screening_id = ?`,
        [showtimeId]
      );
      if (screenings.length === 0) throw new BookingError(404, "NOT_FOUND", "Showtime not found.");
      const screening = screenings[0];
      if (screening.status !== "scheduled") {
        throw new BookingError(409, "SHOWTIME_UNAVAILABLE", "This showtime is not open for booking.");
      }

      const [users] = await conn.query("SELECT user_id FROM `USER` WHERE user_id = ?", [userId]);
      if (users.length === 0) throw new BookingError(400, "VALIDATION_ERROR", "User does not exist.");

      // Lock the seats' rows so two checkouts can't finish the same seat. Same
      // lock order as the hold endpoint (seat id ascending) to avoid deadlocks.
      const lockSql = requestedSeatIds
        ? `SELECT seat_id, status, held_by, (held_until IS NOT NULL AND held_until > NOW()) AS hold_active
           FROM SEATBOOKING WHERE screening_id = ? AND seat_id IN (?) ORDER BY seat_id FOR UPDATE`
        : `SELECT seat_id, status, held_by, (held_until IS NOT NULL AND held_until > NOW()) AS hold_active
           FROM SEATBOOKING WHERE screening_id = ? AND held_by = ? AND status = 'held' ORDER BY seat_id FOR UPDATE`;
      const [locked] = await conn.query(lockSql, [showtimeId, requestedSeatIds ?? userId]);

      if (!requestedSeatIds && locked.length === 0) {
        throw new BookingError(409, "HOLD_EXPIRED", "You have no seats held for this showtime. Please select your seats again.", {
          releaseExpired: true,
        });
      }
      const seatIds = requestedSeatIds ?? locked.map((r) => r.seat_id);
      if (seatIds.length > MAX_SEATS_PER_BOOKING) {
        throw new BookingError(400, "VALIDATION_ERROR", `You can book at most ${MAX_SEATS_PER_BOOKING} seats per transaction.`);
      }

      const [seatRows] = await conn.query("SELECT seat_id, seat_status FROM SEAT WHERE cinema_id = ? AND seat_id IN (?)", [
        screening.cinema_id,
        seatIds,
      ]);
      const seatStatusById = new Map(seatRows.map((s) => [s.seat_id, s.seat_status]));
      const [soldRows] = await conn.query(
        `SELECT t.seat_id FROM TICKET t
         JOIN TOTAL_PURCHASE p ON p.purchase_id = t.purchase_id AND p.status <> 'cancelled'
         WHERE t.screening_id = ? AND t.seat_id IN (?)`,
        [showtimeId, seatIds]
      );
      const soldIds = new Set(soldRows.map((r) => r.seat_id));
      const lockedById = new Map(locked.map((r) => [r.seat_id, r]));

      // Is every seat still ours? "Taken" beats "expired" when both happen.
      const taken = [];
      const expired = [];
      for (const seatId of seatIds) {
        const row = lockedById.get(seatId);
        if (!seatStatusById.has(seatId)) {
          taken.push({ seatId, reason: "invalid" });
        } else if (soldIds.has(seatId) || row?.status === "booked") {
          taken.push({ seatId, reason: "booked" });
        } else if (seatStatusById.get(seatId) !== "active" || row?.status === "blocked") {
          taken.push({ seatId, reason: "blocked" });
        } else if (row?.status === "held" && row.hold_active && row.held_by !== userId) {
          taken.push({ seatId, reason: "held" });
        } else if (!row || row.status !== "held" || row.held_by !== userId || !row.hold_active) {
          expired.push(seatId); // never held, released, expired, or lost to someone's expired-then-rebooked hold
        }
      }
      if (taken.length > 0) {
        throw new BookingError(409, "SEAT_TAKEN", "Some of your seats are no longer available.", {
          failedSeats: taken,
          releaseExpired: true,
        });
      }
      if (expired.length > 0) {
        throw new BookingError(409, "HOLD_EXPIRED", "Your seat hold has expired. Please select your seats again.", {
          expiredSeatIds: expired,
          releaseExpired: true,
        });
      }

      // Ticket type per seat. ticketTypes (per seat) wins; otherwise discount_type applies to every seat.
      const seatTypes = seatIds.map((seatId) => ({
        seatId,
        type: typeOverrides ? typeOverrides[seatId] ?? "regular" : discountTypeInput === "none" ? "regular" : discountTypeInput,
      }));
      const discountedKinds = new Set(seatTypes.map((s) => s.type).filter((t) => t !== "regular"));
      const discountType = discountedKinds.size === 0 ? "none" : discountedKinds.size === 1 ? [...discountedKinds][0] : "mixed";
      if (discountedKinds.size > 0 && !file) {
        throw new BookingError(400, "ID_IMAGE_REQUIRED", "Upload a photo of the Senior Citizen/PWD ID to get the discount.");
      }

      // Prices come from the database, never from the browser.
      const [typeRows] = await conn.query(
        "SELECT type_id, type, ticket_discount FROM TICKET_TYPE WHERE LOWER(type) IN (?)",
        [PURCHASE_TYPES.map((t) => TICKET_TYPE_NAMES[t].toLowerCase())]
      );
      const typeRowByKey = {};
      for (const key of PURCHASE_TYPES) {
        typeRowByKey[key] = typeRows.find((r) => r.type.toLowerCase() === TICKET_TYPE_NAMES[key].toLowerCase());
      }
      const neededKeys = new Set(seatTypes.map((s) => s.type));
      for (const key of neededKeys) {
        if (!typeRowByKey[key]) {
          console.error(`createBooking: TICKET_TYPE row "${TICKET_TYPE_NAMES[key]}" is missing. Run database/migrations/002_booking_checkout.sql.`);
          throw new BookingError(500, "SERVER_ERROR", "Ticket pricing isn't set up yet. Please contact support.");
        }
      }
      const discountPercentByType = Object.fromEntries(
        [...neededKeys].map((key) => [key, Number(typeRowByKey[key].ticket_discount)])
      );

      // Snack prices also come from the database.
      let snacks = [];
      if (snackRequests.length > 0) {
        const [snackRows] = await conn.query("SELECT snack_id, snack_price FROM SNACK WHERE snack_id IN (?)", [
          snackRequests.map((s) => s.snackId),
        ]);
        if (snackRows.length !== snackRequests.length) {
          throw new BookingError(400, "VALIDATION_ERROR", "One of the snacks you picked doesn't exist.");
        }
        const priceBySnack = new Map(snackRows.map((r) => [r.snack_id, toCents(r.snack_price)]));
        snacks = snackRequests.map(({ snackId, quantity }) => ({
          snackId,
          quantity,
          unitPriceCents: priceBySnack.get(snackId),
        }));
      }
      const price = calculatePrice({ basePrice: screening.base_price, seats: seatTypes, discountPercentByType, snacks });

      // Payment: the single hook. Anything but { ok: true } stops the booking.
      let payment;
      try {
        payment = await paymentService.verifyPayment({ userId, amount: price.total, paymentMethod });
      } catch (paymentError) {
        console.error("verifyPayment threw:", paymentError);
        payment = { ok: false, reason: "Payment could not be processed." };
      }
      if (!payment?.ok) {
        throw new BookingError(402, "PAYMENT_FAILED", payment?.reason || "Payment failed. Your seats have been released.", {
          releaseSeats: seatIds,
        });
      }

      // Create the booking. reference_code is UNIQUE, so on the (very rare)
      // collision just try another code.
      const idImageUrl = discountedKinds.size > 0 ? `private/id-uploads/${file.filename}` : null;
      let referenceCode;
      let purchaseId;
      for (let attempt = 1; attempt <= MAX_REFERENCE_ATTEMPTS; attempt += 1) {
        referenceCode = generateReferenceCode();
        try {
          const [result] = await conn.query(
            `INSERT INTO TOTAL_PURCHASE
               (user_id, payment_method, total_price, purchase_datetime, status, reference_code,
                payment_status, discount_type, id_image_url)
             VALUES (?, ?, ?, NOW(), 'confirmed', ?, 'paid', ?, ?)`,
            [userId, paymentMethod, price.total, referenceCode, discountType, idImageUrl]
          );
          purchaseId = result.insertId;
          break;
        } catch (insertError) {
          if (insertError.code !== "ER_DUP_ENTRY" || attempt === MAX_REFERENCE_ATTEMPTS) throw insertError;
        }
      }

      // TICKET has UNIQUE (screening_id, seat_id), but a cancelled booking keeps
      // its tickets as a record. Without this, a seat freed by a cancellation
      // could never be booked again (duplicate key). The cancelled PURCHASE row
      // stays; only its ticket for this exact seat is dropped.
      await conn.query(
        `DELETE t FROM TICKET t
         JOIN TOTAL_PURCHASE p ON p.purchase_id = t.purchase_id
         WHERE t.screening_id = ? AND t.seat_id IN (?) AND p.status = 'cancelled'`,
        [showtimeId, seatIds]
      );

      const priceBySeat = new Map(price.tickets.map((t) => [t.seatId, t]));
      await conn.query("INSERT INTO TICKET (purchase_id, screening_id, seat_id, type_id, ticket_price, booking_ref) VALUES ?", [
        seatTypes.map(({ seatId, type }) => [
          purchaseId,
          showtimeId,
          seatId,
          typeRowByKey[type].type_id,
          (priceBySeat.get(seatId).priceCents / 100).toFixed(2),
          referenceCode,
        ]),
      ]);

      if (price.snacks.length > 0) {
        await conn.query("INSERT INTO SNACK_PURCHASE (purchase_id, snack_id, quantity, subtotal) VALUES ?", [
          price.snacks.map((s) => [purchaseId, s.snackId, s.quantity, s.subtotal.toFixed(2)]),
        ]);
      }

      await conn.query(
        "UPDATE SEATBOOKING SET status = 'booked', held_until = NULL, held_by = NULL WHERE screening_id = ? AND seat_id IN (?)",
        [showtimeId, seatIds]
      );

      // Keep SCREENING.booked_seats in step (it drives seatsAvailable), and never
      // let it pass total_seats.
      const [capacity] = await conn.query(
        "UPDATE SCREENING SET booked_seats = booked_seats + ? WHERE screening_id = ? AND booked_seats + ? <= total_seats",
        [seatIds.length, showtimeId, seatIds.length]
      );
      if (capacity.affectedRows === 0) {
        throw new BookingError(409, "SEAT_TAKEN", "This showtime is sold out.", { failedSeats: [] });
      }

      await conn.commit();
      fileKept = idImageUrl !== null;

      const booking = await loadBooking(purchaseId, conn);
      return res.status(201).json({ success: true, message: "Booking confirmed.", booking });
    } catch (error) {
      try {
        await conn.rollback();
      } catch {
        // nothing to roll back
      }

      if (error instanceof BookingError) {
        // The booking didn't happen, but the seats must not stay locked.
        if (error.extra.releaseSeats) {
          await releaseHolds(conn, { showtimeId, userId, seatIds: error.extra.releaseSeats });
        } else if (error.extra.releaseExpired) {
          await releaseHolds(conn, { showtimeId, userId, onlyExpired: true });
        }
        const { releaseSeats, releaseExpired, ...extra } = error.extra; // eslint-disable-line no-unused-vars
        return fail(error.status, error.code, error.message, extra);
      }
      console.error("createBooking error:", error);
      return fail(500, "SERVER_ERROR", "Failed to create booking.");
    } finally {
      conn.release();
    }
  } finally {
    // Every other outcome (validation error, taken seat, failed payment, or a
    // photo sent with no discount) must not leave an ID photo lying around.
    if (file && !fileKept) fs.unlink(file.path, () => {});
  }
};

module.exports = { createBooking, getUserBookings, getBookingById };

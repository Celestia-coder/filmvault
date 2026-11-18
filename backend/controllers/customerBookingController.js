// controllers/customerBookingController.js
// Customer bookings: create (checkout), list, and view one.
// Admin booking management lives in bookingController.js.
//
//   POST /api/bookings                finalize a booking from the user's held seats
//   GET  /api/bookings?userId=        the user's bookings, newest first
//   GET  /api/bookings/:id?userId=    one booking, with everything the e-ticket needs
//   GET  /api/tickets/verify/:token   public: what the e-ticket QR code opens (no login)
//
// Terms: booking = TOTAL_PURCHASE row, ticket = TICKET row, showtime = SCREENING.
//
// Errors look like { success: false, code, message, ... }. Checkout branches on `code`:
//   VALIDATION_ERROR (400)    bad or missing input
//   ID_IMAGE_REQUIRED (400)   senior/PWD ticket needs an ID photo
//   INVALID_FILE_TYPE (415)   from the upload middleware
//   FILE_TOO_LARGE (413)      from the upload middleware
//   HOLD_EXPIRED (409)        hold ran out or was never made
//   SEAT_TAKEN (409)          seat no longer available; failedSeats lists them
//   SHOWTIME_UNAVAILABLE (409)
//   PAYMENT_FAILED (402)      payment failed; seats were released
//
// Customer identity comes from the verified backend token on protected routes.

const fs = require("fs");
const crypto = require("crypto");
const pool = require("../config/database");
const cloudinary = require("../config/cloudinary");
const paymentService = require("../services/paymentService");
const { createBookingNotifier } = require("../services/bookingNotificationService");
const { notificationCustomer } = require("../utils/notificationAuth");
const { isValidRecipient } = require("../utils/mailer");
const { calculatePrice, toCents } = require("../utils/pricing");

const bookingNotifier = createBookingNotifier();

const MAX_SEATS_PER_BOOKING = 8; // 1 to 8 tickets per transaction
const MAX_SNACK_QUANTITY = 10; // per snack, same as the Checkout page
const TICKET_TYPE_NAMES = { regular: "Regular", senior: "Senior", pwd: "PWD" };
const PURCHASE_TYPES = Object.keys(TICKET_TYPE_NAMES);
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I, easy to read aloud
const MAX_REFERENCE_ATTEMPTS = 5;

const isPositiveInt = (value) => Number.isInteger(value) && value > 0;
const rowLabel = (rowNum) => String.fromCharCode(64 + rowNum); // 1 -> "A"

// Multipart forms send strings only, so accept either spelling of a field.
const pick = (body, ...keys) => {
	for (const key of keys) {
		if (body?.[key] !== undefined && body[key] !== "") return body[key];
	}
	return undefined;
};

// "[1,2]" | "1,2" | [1,2] -> [1, 2]. Undefined stays undefined.
const parseList = (raw) => {
	if (raw === undefined) return undefined;
	if (Array.isArray(raw)) return raw;
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [parsed];
	} catch {
		return String(raw)
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean);
	}
};

// '{"41":"senior"}' | { 41: "senior" } -> object. Undefined stays undefined, invalid gives null.
const parseObject = (raw) => {
	if (raw === undefined) return undefined;
	if (typeof raw === "object" && !Array.isArray(raw)) return raw;
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? parsed
			: null;
	} catch {
		return null;
	}
};

const generateReferenceCode = () => {
	let code = "FV-";
	for (let i = 0; i < 8; i += 1)
		code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
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

// One row per ticket. buildBookings() groups them into bookings.
const BOOKING_ROWS_SELECT = `
  SELECT
    p.purchase_id AS booking_id,
    p.reference_code,
    p.status,
    p.payment_status,
    p.payment_method,
    p.discount_type,
    p.total_price,
    p.verification_token,
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
const BOOKING_ROWS_ORDER =
	"ORDER BY p.purchase_datetime DESC, p.purchase_id DESC, se.row_num, se.seat_num";

// Groups ticket rows into one booking each. The ID image reference is never
// returned, because it points to private storage.
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
				verification_token: r.verification_token,
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
		booking.tickets_total = Number(
			(booking.tickets_total + Number(r.ticket_price)).toFixed(2),
		);
	}
	return [...byId.values()];
};

// Adds snacks to each booking and works out the booking fee.
// The fee is not stored: it is what remains of the total after tickets and snacks.
const withSnacks = async (bookings, db) => {
	const snacksByBooking = new Map();
	if (bookings.length > 0) {
		const [rows] = await db.query(
			`SELECT sp.purchase_id, sp.snack_id, sn.snack_name, sp.quantity, sp.subtotal
       FROM SNACK_PURCHASE sp JOIN SNACK sn ON sn.snack_id = sp.snack_id
       WHERE sp.purchase_id IN (?) ORDER BY sp.snack_id`,
			[bookings.map((b) => b.booking_id)],
		);
		for (const r of rows) {
			const list = snacksByBooking.get(r.purchase_id) ?? [];
			list.push({
				snack_id: r.snack_id,
				name: r.snack_name,
				quantity: r.quantity,
				unit_price: Number(
					(Number(r.subtotal) / r.quantity).toFixed(2),
				),
				subtotal: Number(r.subtotal),
			});
			snacksByBooking.set(r.purchase_id, list);
		}
	}
	for (const booking of bookings) {
		booking.snacks = snacksByBooking.get(booking.booking_id) ?? [];
		booking.snacks_total = Number(
			booking.snacks.reduce((sum, s) => sum + s.subtotal, 0).toFixed(2),
		);
		booking.booking_fee = Math.max(
			0,
			Number(
				(
					booking.total_price -
					booking.tickets_total -
					booking.snacks_total
				).toFixed(2),
			),
		);
	}
	return bookings;
};

// GET /api/bookings?userId=
const getUserBookings = async (req, res) => {
	const customer = notificationCustomer(req);
	if (!customer) return res.status(403).json({ success: false, message: "Access denied." });
	const userId = customer.userId;
	if (!isPositiveInt(userId)) {
		return res.status(400).json({
			success: false,
			code: "VALIDATION_ERROR",
			message: "userId is required and must be a positive integer.",
		});
	}

	try {
		const [rows] = await pool.query(
			`${BOOKING_ROWS_SELECT} WHERE p.user_id = ? ${BOOKING_ROWS_ORDER}`,
			[userId],
		);
		const bookings = await withSnacks(buildBookings(rows), pool);
		return res.status(200).json({ success: true, bookings });
	} catch (error) {
		console.error("getUserBookings error:", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to fetch bookings.",
		});
	}
};

const loadBooking = async (bookingId, db = pool) => {
	const [rows] = await db.query(
		`${BOOKING_ROWS_SELECT} WHERE p.purchase_id = ? ${BOOKING_ROWS_ORDER}`,
		[bookingId],
	);
	const [booking] = await withSnacks(buildBookings(rows), db);
	return booking ?? null;
};

// GET /api/bookings/:id?userId=
// The booking must belong to the verified customer, otherwise it is a 404.
const getBookingById = async (req, res) => {
	const customer = notificationCustomer(req);
	if (!customer) return res.status(403).json({ success: false, message: "Access denied." });
	const bookingId = Number(req.params.id);
	const userId = customer.userId;
	if (!isPositiveInt(bookingId)) {
		return res.status(400).json({
			success: false,
			code: "VALIDATION_ERROR",
			message: "Invalid booking ID.",
		});
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
			return res.status(404).json({
				success: false,
				code: "NOT_FOUND",
				message: "Booking not found.",
			});
		}
		return res.status(200).json({ success: true, booking });
	} catch (error) {
		console.error("getBookingById error:", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to fetch booking.",
		});
	}
};

// GET /api/tickets/verify/:token
// Public (the QR code is scanned without logging in), so it returns only what a
// ticket check needs: no user id, email, phone, ID photo or purchase id.
// valid is true only for a confirmed AND paid booking; the status is read live,
// so a booking cancelled after the QR was issued shows as invalid.
const VERIFY_TOKEN_PATTERN = /^[0-9a-f]{32}$/;
const verifyTicket = async (req, res) => {
	const token = String(req.params.token ?? "").toLowerCase();
	const notFound = () =>
		res.status(404).json({
			success: false,
			code: "INVALID_TICKET",
			message: "This QR code doesn't match any FilmVault ticket.",
		});
	if (!VERIFY_TOKEN_PATTERN.test(token)) return notFound();

	try {
		const [purchases] = await pool.query(
			`SELECT p.purchase_id, p.reference_code, p.status, p.payment_status, p.payment_method, p.total_price, u.name
       FROM TOTAL_PURCHASE p JOIN \`USER\` u ON u.user_id = p.user_id
       WHERE p.verification_token = ?`,
			[token],
		);
		if (purchases.length === 0) return notFound();
		const p = purchases[0];

		// A cancelled booking can lose its TICKET rows once the seats are resold,
		// so the movie/seat details may be gone; the status still answers the scan.
		const [rows] = await pool.query(
			`${BOOKING_ROWS_SELECT} WHERE p.purchase_id = ? ${BOOKING_ROWS_ORDER}`,
			[p.purchase_id],
		);
		const [b] = buildBookings(rows);

		return res.status(200).json({
			success: true,
			valid:
				p.status === "confirmed" &&
				p.payment_status === "paid" &&
				Boolean(b),
			ticket: {
				owner_name: p.name,
				reference_code: p.reference_code,
				status: p.status,
				payment_status: p.payment_status,
				payment_method: p.payment_method,
				total_price: Number(p.total_price),
				...(b && {
					movie_title: b.movie_title,
					poster: b.poster,
					show_date: b.show_date,
					show_time: b.show_time,
					branch_name: b.branch_name,
					cinema_num: b.cinema_num,
					seats: b.seats,
					tickets: b.tickets.map(({ seat, ticket_type }) => ({
						seat,
						ticket_type,
					})),
				}),
			},
		});
	} catch (error) {
		console.error("verifyTicket error:", error);
		return res.status(500).json({
			success: false,
			code: "SERVER_ERROR",
			message: "Failed to verify ticket.",
		});
	}
};

/* ------------------------------ creating ------------------------------ */

// Frees the user's holds after a failed booking. Runs after the rollback so it
// sticks. Best effort: unreleased holds expire on their own.
const releaseHolds = async (
	conn,
	{ showtimeId, userId, seatIds, onlyExpired },
) => {
	try {
		const conditions = [
			"screening_id = ?",
			"held_by = ?",
			"status = 'held'",
		];
		const params = [showtimeId, userId];
		if (seatIds?.length) {
			conditions.push("seat_id IN (?)");
			params.push(seatIds);
		}
		if (onlyExpired)
			conditions.push("(held_until IS NULL OR held_until <= NOW())");
		await conn.query(
			`UPDATE SEATBOOKING SET status = 'available', held_until = NULL, held_by = NULL WHERE ${conditions.join(" AND ")}`,
			params,
		);
	} catch (error) {
		console.error("releaseHolds failed:", error);
	}
};

// Deletes an uploaded ID photo that no booking ended up using.
// Cloud uploads have no file.path, so the two storage types are handled apart.
const discardIdFile = (file) => {
	if (file.cloudinary) {
		cloudinary.uploader
			.destroy(file.filename, {
				type: "authenticated",
				resource_type: "image",
			})
			.catch((e) =>
				console.error("Could not delete unused ID image:", e.message),
			);
	} else if (file.path) {
		fs.unlink(file.path, () => {});
	}
};

// POST /api/bookings (multipart/form-data, or JSON when there is no ID image)
//
// Fields:
//   userId, showtimeId   required
//   email                optional for older clients; when supplied, must match USER.email
//   seatIds              optional JSON array, e.g. [41,42]. Omit to book every seat
//                        the user currently holds for the showtime.
//   paymentMethod        e.g. "gcash" (default "simulated")
//   discount_type        "none" | "senior" | "pwd", applies to every seat
//   ticketTypes          optional JSON { "41": "senior", "42": "regular" } for mixed
//                        bookings. Wins over discount_type.
//   idImage              ID photo file. Required when any seat is discounted.
//   snacks               optional JSON [{ "snackId": 1, "quantity": 2 }]. Priced from
//                        the SNACK table, never discounted.
const createCreateBooking =
	({
		db = pool,
		paymentVerifier = paymentService,
		notifier = bookingNotifier,
	} = {}) =>
	async (req, res) => {
		const file = req.file;
		let fileKept = false; // true once a saved booking references the ID photo
		const fail = (status, code, message, extra = {}) =>
			res.status(status).json({ success: false, code, message, ...extra });

		try {
			const body = req.body || {};

			const trustedCustomer = notificationCustomer(req);
			const userId = trustedCustomer?.userId;
			const requestedUserId = pick(body, "userId", "user_id");
			if (!trustedCustomer)
				return fail(401, "UNAUTHENTICATED", "Please sign in.");
			if (requestedUserId !== undefined && Number(requestedUserId) !== userId)
				return fail(403, "FORBIDDEN", "Booking account does not match the signed-in customer.");
			const showtimeId = Number(pick(body, "showtimeId", "showtime_id"));
			const paymentMethod = String(
				pick(body, "paymentMethod", "payment_method") ?? "simulated",
			)
				.trim()
				.slice(0, 50);
			const discountTypeInput = String(
				pick(body, "discountType", "discount_type") ?? "none",
			).toLowerCase();

			if (!isPositiveInt(showtimeId))
				return fail(400, "VALIDATION_ERROR", "showtimeId is required.");
			if (!paymentMethod)
				return fail(
					400,
					"VALIDATION_ERROR",
					"paymentMethod can't be empty.",
				);
			if (
				discountTypeInput !== "none" &&
				!PURCHASE_TYPES.includes(discountTypeInput)
			) {
				return fail(
					400,
					"VALIDATION_ERROR",
					"discount_type must be one of: none, senior, pwd.",
				);
			}

			// Seats: an explicit list, or undefined to use every seat the user holds.
			let requestedSeatIds;
			const rawSeatIds = parseList(pick(body, "seatIds", "seat_ids"));
			if (rawSeatIds !== undefined) {
				requestedSeatIds = rawSeatIds.map(Number).sort((a, b) => a - b);
				if (
					requestedSeatIds.length === 0 ||
					!requestedSeatIds.every(isPositiveInt) ||
					new Set(requestedSeatIds).size !== requestedSeatIds.length
				) {
					return fail(
						400,
						"VALIDATION_ERROR",
						"seatIds must be a non-empty list of unique seat IDs.",
					);
				}
				if (requestedSeatIds.length > MAX_SEATS_PER_BOOKING) {
					return fail(
						400,
						"VALIDATION_ERROR",
						`You can book at most ${MAX_SEATS_PER_BOOKING} seats per transaction.`,
					);
				}
			}

			// Per-seat ticket types (optional).
			const rawTypes = pick(body, "ticketTypes", "ticket_types");
			const typeOverrides = parseObject(rawTypes);
			if (rawTypes !== undefined) {
				if (
					typeOverrides === null ||
					!Object.values(typeOverrides).every((t) =>
						PURCHASE_TYPES.includes(t),
					)
				) {
					return fail(
						400,
						"VALIDATION_ERROR",
						"ticketTypes must map seat IDs to regular, senior or pwd.",
					);
				}
				if (
					requestedSeatIds &&
					!Object.keys(typeOverrides).every((id) =>
						requestedSeatIds.includes(Number(id)),
					)
				) {
					return fail(
						400,
						"VALIDATION_ERROR",
						"ticketTypes lists a seat that isn't in seatIds.",
					);
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
					if (
						!isPositiveInt(snackId) ||
						!Number.isInteger(quantity) ||
						quantity < 1 ||
						quantity > MAX_SNACK_QUANTITY
					) {
						return fail(
							400,
							"VALIDATION_ERROR",
							`Each snack needs a snackId and a quantity from 1 to ${MAX_SNACK_QUANTITY}.`,
						);
					}
					if (seenSnacks.has(snackId))
						return fail(
							400,
							"VALIDATION_ERROR",
							"Each snack can only be listed once.",
						);
					seenSnacks.add(snackId);
					snackRequests.push({ snackId, quantity });
				}
			}

			const conn = await db.getConnection();
			let connectionReleased = false;
			let committed = false;
			try {
				await conn.beginTransaction();

				// Share the screening lock with rescheduling so its recipient snapshot
				// cannot miss a checkout that commits against the previous schedule.
				const [screenings] = await conn.query(
					`SELECT s.screening_id, s.cinema_id, s.status, m.base_price
         FROM SCREENING s JOIN MOVIE m ON m.movie_id = s.movie_id
         WHERE s.screening_id = ? FOR UPDATE`,
					[showtimeId],
				);
				if (screenings.length === 0)
					throw new BookingError(
						404,
						"NOT_FOUND",
						"Showtime not found.",
					);
				const screening = screenings[0];
				if (screening.status !== "scheduled") {
					throw new BookingError(
						409,
						"SHOWTIME_UNAVAILABLE",
						"This showtime is not open for booking.",
					);
				}

				const [users] = await conn.query(
					"SELECT user_id, email FROM `USER` WHERE user_id = ?",
					[userId],
				);
				if (users.length === 0)
					throw new BookingError(
						400,
						"VALIDATION_ERROR",
						"User does not exist.",
					);
				if (body.email !== undefined) {
					const submittedEmail = typeof body.email === "string" ? body.email.trim() : "";
					if (!isValidRecipient(submittedEmail)) {
						throw new BookingError(400, "VALIDATION_ERROR", "Enter a valid email address.");
					}
					if (submittedEmail.toLowerCase() !== users[0].email?.toLowerCase()) {
						throw new BookingError(400, "EMAIL_MISMATCH", "Use the email address on your account for checkout.");
					}
				}

				// Lock the seat rows so two checkouts can't take the same seat.
				// Seat IDs are locked in ascending order, same as the hold endpoint, to avoid deadlocks.
				const lockSql = requestedSeatIds
					? `SELECT seat_id, status, held_by, (held_until IS NOT NULL AND held_until > NOW()) AS hold_active
           FROM SEATBOOKING WHERE screening_id = ? AND seat_id IN (?) ORDER BY seat_id FOR UPDATE`
					: `SELECT seat_id, status, held_by, (held_until IS NOT NULL AND held_until > NOW()) AS hold_active
           FROM SEATBOOKING WHERE screening_id = ? AND held_by = ? AND status = 'held' ORDER BY seat_id FOR UPDATE`;
				const [locked] = await conn.query(lockSql, [
					showtimeId,
					requestedSeatIds ?? userId,
				]);

				if (!requestedSeatIds && locked.length === 0) {
					throw new BookingError(
						409,
						"HOLD_EXPIRED",
						"You have no seats held for this showtime. Please select your seats again.",
						{ releaseExpired: true },
					);
				}
				const seatIds = requestedSeatIds ?? locked.map((r) => r.seat_id);
				if (seatIds.length > MAX_SEATS_PER_BOOKING) {
					throw new BookingError(
						400,
						"VALIDATION_ERROR",
						`You can book at most ${MAX_SEATS_PER_BOOKING} seats per transaction.`,
					);
				}

				const [seatRows] = await conn.query(
					"SELECT seat_id, seat_status FROM SEAT WHERE cinema_id = ? AND seat_id IN (?)",
					[screening.cinema_id, seatIds],
				);
				const seatStatusById = new Map(
					seatRows.map((s) => [s.seat_id, s.seat_status]),
				);
				const [soldRows] = await conn.query(
					`SELECT t.seat_id FROM TICKET t
         JOIN TOTAL_PURCHASE p ON p.purchase_id = t.purchase_id AND p.status <> 'cancelled'
         WHERE t.screening_id = ? AND t.seat_id IN (?)`,
					[showtimeId, seatIds],
				);
				const soldIds = new Set(soldRows.map((r) => r.seat_id));
				const lockedById = new Map(locked.map((r) => [r.seat_id, r]));

				// Check every seat is still the user's. "Taken" wins over "expired".
				const taken = [];
				const expired = [];
				for (const seatId of seatIds) {
					const row = lockedById.get(seatId);
					if (!seatStatusById.has(seatId)) {
						taken.push({ seatId, reason: "invalid" });
					} else if (soldIds.has(seatId) || row?.status === "booked") {
						taken.push({ seatId, reason: "booked" });
					} else if (
						seatStatusById.get(seatId) !== "active" ||
						row?.status === "blocked"
					) {
						taken.push({ seatId, reason: "blocked" });
					} else if (
						row?.status === "held" &&
						row.hold_active &&
						row.held_by !== userId
					) {
						taken.push({ seatId, reason: "held" });
					} else if (
						!row ||
						row.status !== "held" ||
						row.held_by !== userId ||
						!row.hold_active
					) {
						expired.push(seatId); // never held, released, or expired
					}
				}
				if (taken.length > 0) {
					throw new BookingError(
						409,
						"SEAT_TAKEN",
						"Some of your seats are no longer available.",
						{ failedSeats: taken, releaseExpired: true },
					);
				}
				if (expired.length > 0) {
					throw new BookingError(
						409,
						"HOLD_EXPIRED",
						"Your seat hold has expired. Please select your seats again.",
						{ expiredSeatIds: expired, releaseExpired: true },
					);
				}

				// Ticket type per seat: ticketTypes wins, otherwise discount_type applies to all.
				const seatTypes = seatIds.map((seatId) => ({
					seatId,
					type: typeOverrides
						? (typeOverrides[seatId] ?? "regular")
						: discountTypeInput === "none"
							? "regular"
							: discountTypeInput,
				}));
				const discountedKinds = new Set(
					seatTypes.map((s) => s.type).filter((t) => t !== "regular"),
				);
				const discountType =
					discountedKinds.size === 0
						? "none"
						: discountedKinds.size === 1
							? [...discountedKinds][0]
							: "mixed";
				if (discountedKinds.size > 0 && !file) {
					throw new BookingError(
						400,
						"ID_IMAGE_REQUIRED",
						"Upload a photo of the Senior Citizen/PWD ID to get the discount.",
					);
				}

				// Prices always come from the database, never from the browser.
				const [typeRows] = await conn.query(
					"SELECT type_id, type, ticket_discount FROM TICKET_TYPE WHERE LOWER(type) IN (?)",
					[PURCHASE_TYPES.map((t) => TICKET_TYPE_NAMES[t].toLowerCase())],
				);
				const typeRowByKey = {};
				for (const key of PURCHASE_TYPES) {
					typeRowByKey[key] = typeRows.find(
						(r) =>
							r.type.toLowerCase() ===
							TICKET_TYPE_NAMES[key].toLowerCase(),
					);
				}
				const neededKeys = new Set(seatTypes.map((s) => s.type));
				for (const key of neededKeys) {
					if (!typeRowByKey[key]) {
						console.error(
							`createBooking: TICKET_TYPE row "${TICKET_TYPE_NAMES[key]}" is missing. Check the active database's ticket type seed.`,
						);
						throw new BookingError(
							500,
							"SERVER_ERROR",
							"Ticket pricing isn't set up yet. Please contact support.",
						);
					}
				}
				const discountPercentByType = Object.fromEntries(
					[...neededKeys].map((key) => [
						key,
						Number(typeRowByKey[key].ticket_discount),
					]),
				);

				// Snack prices also come from the database.
				let snacks = [];
				if (snackRequests.length > 0) {
					const [snackRows] = await conn.query(
						"SELECT snack_id, snack_price FROM SNACK WHERE snack_id IN (?)",
						[snackRequests.map((s) => s.snackId)],
					);
					if (snackRows.length !== snackRequests.length) {
						throw new BookingError(
							400,
							"VALIDATION_ERROR",
							"One of the snacks you picked doesn't exist.",
						);
					}
					const priceBySnack = new Map(
						snackRows.map((r) => [r.snack_id, toCents(r.snack_price)]),
					);
					snacks = snackRequests.map(({ snackId, quantity }) => ({
						snackId,
						quantity,
						unitPriceCents: priceBySnack.get(snackId),
					}));
				}
				const price = calculatePrice({
					basePrice: screening.base_price,
					seats: seatTypes,
					discountPercentByType,
					snacks,
				});

				// Payment hook: anything other than { ok: true } stops the booking.
				let payment;
				try {
					payment = await paymentVerifier.verifyPayment({
						userId,
						amount: price.total,
						paymentMethod,
					});
				} catch (paymentError) {
					console.error("verifyPayment threw:", paymentError);
					payment = {
						ok: false,
						reason: "Payment could not be processed.",
					};
				}
				if (!payment?.ok) {
					throw new BookingError(
						402,
						"PAYMENT_FAILED",
						payment?.reason ||
							"Payment failed. Your seats have been released.",
						{ releaseSeats: seatIds },
					);
				}

				// Where the ID photo lives: "cloudinary:<public_id>" or a local private path.
				const idImageUrl =
					discountedKinds.size > 0
						? file.cloudinary
							? `cloudinary:${file.filename}`
							: `private/id-uploads/${file.filename}`
						: null;

				// Save the purchase. reference_code is UNIQUE, so retry with a new code on a clash.
				// verification_token is the secret behind the e-ticket QR code.
				let referenceCode;
				let purchaseId;
				for (
					let attempt = 1;
					attempt <= MAX_REFERENCE_ATTEMPTS;
					attempt += 1
				) {
					referenceCode = generateReferenceCode();
					try {
						const [result] = await conn.query(
							`INSERT INTO TOTAL_PURCHASE
               (user_id, payment_method, total_price, purchase_datetime, status, reference_code,
                payment_status, discount_type, id_image_url, verification_token)
             VALUES (?, ?, ?, NOW(), 'confirmed', ?, 'paid', ?, ?, ?)`,
							[
								userId,
								paymentMethod,
								price.total,
								referenceCode,
								discountType,
								idImageUrl,
								crypto.randomBytes(16).toString("hex"),
							],
						);
						purchaseId = result.insertId;
						break;
					} catch (insertError) {
						if (
							insertError.code !== "ER_DUP_ENTRY" ||
							attempt === MAX_REFERENCE_ATTEMPTS
						)
							throw insertError;
					}
				}

				// TICKET is UNIQUE (screening_id, seat_id) and cancelled bookings keep their
				// tickets. Drop the old ticket for these seats so a freed seat can be rebooked.
				await conn.query(
					`DELETE t FROM TICKET t
         JOIN TOTAL_PURCHASE p ON p.purchase_id = t.purchase_id
         WHERE t.screening_id = ? AND t.seat_id IN (?) AND p.status = 'cancelled'`,
					[showtimeId, seatIds],
				);

				const priceBySeat = new Map(
					price.tickets.map((t) => [t.seatId, t]),
				);
				await conn.query(
					"INSERT INTO TICKET (purchase_id, screening_id, seat_id, type_id, ticket_price, booking_ref) VALUES ?",
					[
						seatTypes.map(({ seatId, type }) => [
							purchaseId,
							showtimeId,
							seatId,
							typeRowByKey[type].type_id,
							(priceBySeat.get(seatId).priceCents / 100).toFixed(2),
							referenceCode,
						]),
					],
				);

				if (price.snacks.length > 0) {
					await conn.query(
						"INSERT INTO SNACK_PURCHASE (purchase_id, snack_id, quantity, subtotal) VALUES ?",
						[
							price.snacks.map((s) => [
								purchaseId,
								s.snackId,
								s.quantity,
								s.subtotal.toFixed(2),
							]),
						],
					);
				}

				// Mark the seats as booked.
				await conn.query(
					"UPDATE SEATBOOKING SET status = 'booked', held_until = NULL, held_by = NULL WHERE screening_id = ? AND seat_id IN (?)",
					[showtimeId, seatIds],
				);

				// Keep booked_seats in sync (drives seatsAvailable) and never exceed total_seats.
				const [capacity] = await conn.query(
					"UPDATE SCREENING SET booked_seats = booked_seats + ? WHERE screening_id = ? AND booked_seats + ? <= total_seats",
					[seatIds.length, showtimeId, seatIds.length],
				);
				if (capacity.affectedRows === 0) {
					throw new BookingError(
						409,
						"SEAT_TAKEN",
						"This showtime is sold out.",
						{ failedSeats: [] },
					);
				}

				await conn.commit();
				committed = true;
				fileKept = idImageUrl !== null;

				connectionReleased = true;
				try {
					conn.release();
				} catch {
					console.error(
						"Booking connection release failed after commit.",
					);
				}

				const customer = trustedCustomer;
				if (customer?.userId === userId) {
					try {
						await notifier.notifyCommitted({
							type: "confirmation",
							purchaseId,
							committed: true,
							paymentVerified: payment.ok === true,
							customer,
						});
					} catch {
						// Purchase already committed; delivery must not change its result.
						console.error(
							"Booking confirmation notification failed after commit.",
						);
					}
				}
				const booking = await loadBooking(purchaseId, db);
				return res.status(201).json({
					success: true,
					message: "Booking confirmed.",
					booking,
				});
			} catch (error) {
				if (!committed) {
					try {
						await conn.rollback();
					} catch {
						// nothing to roll back
					}
				}

				if (error instanceof BookingError) {
					// Booking failed, so release the user's seats.
					if (error.extra.releaseSeats) {
						await releaseHolds(conn, {
							showtimeId,
							userId,
							seatIds: error.extra.releaseSeats,
						});
					} else if (error.extra.releaseExpired) {
						await releaseHolds(conn, {
							showtimeId,
							userId,
							onlyExpired: true,
						});
					}
					const { releaseSeats, releaseExpired, ...extra } = error.extra; // eslint-disable-line no-unused-vars
					return fail(error.status, error.code, error.message, extra);
				}
				console.error("createBooking error:", error);
				return fail(500, "SERVER_ERROR", "Failed to create booking.");
			} finally {
				if (!connectionReleased) conn.release();
			}
		} finally {
			// Any outcome without a saved booking must not leave the ID photo behind
			// (local file or Cloudinary upload).
			if (file && !fileKept) discardIdFile(file);
		}
	};

const createBooking = createCreateBooking();

module.exports = {
	createBooking,
	createCreateBooking,
	getUserBookings,
	getBookingById,
	verifyTicket,
};

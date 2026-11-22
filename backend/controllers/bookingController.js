// controllers/bookingController.js
// Admin booking management.
//
//   GET   /api/admin/bookings                        list bookings for the admin's branch
//   PATCH /api/admin/bookings/:id                    cancel a booking and release its seats
//   GET   /api/admin/bookings/:id/id-images          URLs to view all of a booking's ID photos
//   GET   /api/admin/bookings/:id/id-image           same as id-images (older name)
//   GET   /api/admin/bookings/:id/id-image/file      serves a locally stored ID photo
//
// A "booking" is one TOTAL_PURCHASE row. Its movie, showtime and branch are not
// stored on the purchase: they come from its TICKETs, so queries join
// TICKET -> SCREENING -> CINEMA. purchase_id is returned as booking_id.
//
// ID photos: each discounted (senior/PWD) seat has its own photo, stored in
// BOOKING_ID_IMAGE (one row per purchase + seat).
//
// TODO: no auth yet. Branch scoping relies on ?branchId= from the client.

const path = require("path");
const pool = require("../config/database");
const cloudinary = require("../config/cloudinary");
const {
	createBookingNotifier,
} = require("../services/bookingNotificationService");
const { parseBranchId } = require("../utils/branchScope");
const { notificationAdmin } = require("../utils/notificationAuth");

const bookingNotifier = createBookingNotifier();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_STATUSES = ["pending", "confirmed", "cancelled"];

// How customerBookingController saves each ID photo reference in id_image_url.
const CLOUD_ID_PREFIX = "cloudinary:"; // cloudinary:<public_id>
const LOCAL_ID_PREFIX = "private/id-uploads/"; // private/id-uploads/<uuid>.<ext>
const LOCAL_ID_DIR = path.join(__dirname, "..", "private", "id-uploads");
// Only names made by the server (UUID + image extension) are ever served.
const LOCAL_ID_FILE_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

// One row per (purchase, showtime). Seat labels like "A1" are row_num (1 = A) + seat_num.
const BOOKING_SELECT = `
  SELECT
    p.purchase_id AS booking_id,
    p.status,
    p.payment_method,
    p.total_price,
    p.purchase_datetime,
    EXISTS (
      SELECT 1 FROM BOOKING_ID_IMAGE bi WHERE bi.purchase_id = p.purchase_id
    ) AS has_id_image,
    (
      SELECT COUNT(*) FROM BOOKING_ID_IMAGE bi WHERE bi.purchase_id = p.purchase_id
    ) AS id_image_count,
    MIN(t.booking_ref) AS booking_ref,
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
    ) AS seats,
    GROUP_CONCAT(
      tt.type
      ORDER BY se.row_num, se.seat_num SEPARATOR ','
    ) AS ticket_types
  FROM TOTAL_PURCHASE p
  JOIN \`USER\` u ON u.user_id = p.user_id
  JOIN TICKET t ON t.purchase_id = p.purchase_id
  JOIN TICKET_TYPE tt ON tt.type_id = t.type_id
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
	has_id_image: Boolean(row.has_id_image),
	id_image_count: Number(row.id_image_count ?? 0),
	seats: row.seats ? row.seats.split(",") : [],
	// One entry per seat, same order as `seats` (e.g. ["Regular", "Senior"]).
	ticket_types: row.ticket_types ? row.ticket_types.split(",") : [],
});

const isPositiveInt = (value) =>
	Number.isInteger(Number(value)) && Number(value) > 0;

// GET /api/admin/bookings?branchId=&status=&date=&movieId=
// branchId is required: admins only see their own branch.
// date filters on the showtime date (show_date), not the purchase date.
// Results are newest booking first.
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
			return res.status(400).json({
				success: false,
				message: "date must be in YYYY-MM-DD format.",
			});
		}
		conditions.push("s.show_date = ?");
		params.push(date);
	}

	if (movieId !== undefined) {
		if (!isPositiveInt(movieId)) {
			return res.status(400).json({
				success: false,
				message: "movieId must be a positive integer.",
			});
		}
		conditions.push("s.movie_id = ?");
		params.push(Number(movieId));
	}

	try {
		const [rows] = await pool.query(
			`${BOOKING_SELECT} WHERE ${conditions.join(" AND ")} ${BOOKING_GROUP_BY}
       ORDER BY p.purchase_datetime DESC, p.purchase_id DESC, s.show_date DESC, s.show_time DESC`,
			params,
		);
		return res
			.status(200)
			.json({ success: true, bookings: rows.map(formatBooking) });
	} catch (error) {
		console.error("getAdminBookings error:", error);
		return res
			.status(500)
			.json({ success: false, message: "Failed to fetch bookings." });
	}
};

// PATCH /api/admin/bookings/:id?branchId=   body (optional): { "status": "cancelled" }
// Cancels the booking and releases its seats. The purchase and its tickets
// are kept (status = 'cancelled') as a record; seat availability ignores
// tickets on cancelled purchases, so the seats become sellable again.
// After the cancellation is committed, the customer is notified (best effort).
const createCancelBooking =
	({ db = pool, notifier = bookingNotifier } = {}) =>
	async (req, res) => {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) {
			return res
				.status(400)
				.json({ success: false, message: "Invalid booking ID." });
		}

		const scope = parseBranchId(req.query.branchId);
		if (scope.error) {
			return res
				.status(400)
				.json({ success: false, message: scope.error });
		}

		const requestedStatus = req.body?.status;
		if (requestedStatus !== undefined && requestedStatus !== "cancelled") {
			return res.status(400).json({
				success: false,
				message:
					'Only cancellation is supported: status must be "cancelled".',
			});
		}

		const conn = await db.getConnection();
		let committed = false;
		let connectionReleased = false;
		try {
			await conn.beginTransaction();

			// Lock the purchase so two admins can't cancel it at the same time.
			const [purchases] = await conn.query(
				"SELECT purchase_id, status FROM TOTAL_PURCHASE WHERE purchase_id = ? FOR UPDATE",
				[id],
			);
			const [tickets] = await conn.query(
				`SELECT t.seat_id, t.screening_id, c.branch_id
       FROM TICKET t
       JOIN SCREENING s ON s.screening_id = t.screening_id
       JOIN CINEMA c ON c.cinema_id = s.cinema_id
       WHERE t.purchase_id = ?`,
				[id],
			);

			// Another branch's booking is reported as "not found" so admins can't probe for it.
			const outOfScope =
				scope.branchId !== null &&
				(tickets.length === 0 ||
					tickets.some((t) => t.branch_id !== scope.branchId));
			if (purchases.length === 0 || outOfScope) {
				await conn.rollback();
				return res
					.status(404)
					.json({ success: false, message: "Booking not found." });
			}
			if (purchases[0].status === "cancelled") {
				await conn.rollback();
				return res.status(409).json({
					success: false,
					message: "Booking is already cancelled.",
				});
			}

			await conn.query(
				"UPDATE TOTAL_PURCHASE SET status = 'cancelled' WHERE purchase_id = ?",
				[id],
			);

			// Release each seat (clears the 'booked' marker from checkout).
			for (const t of tickets) {
				await conn.query(
					"UPDATE SEATBOOKING SET status = 'available', held_until = NULL WHERE seat_id = ? AND screening_id = ?",
					[t.seat_id, t.screening_id],
				);
			}

			// Keep SCREENING.booked_seats in sync (it drives seatsAvailable).
			const releasedPerShowtime = {};
			for (const t of tickets) {
				releasedPerShowtime[t.screening_id] =
					(releasedPerShowtime[t.screening_id] || 0) + 1;
			}
			for (const [screeningId, count] of Object.entries(
				releasedPerShowtime,
			)) {
				await conn.query(
					"UPDATE SCREENING SET booked_seats = GREATEST(booked_seats - ?, 0) WHERE screening_id = ?",
					[count, screeningId],
				);
			}

			await conn.commit();
			committed = true;

			// Free the connection before notifying, so a slow email can't hold it.
			connectionReleased = true;
			try {
				conn.release();
			} catch {
				console.error(
					"Cancellation connection release failed after commit.",
				);
			}

			// Notify only when every ticket belongs to the admin's own branch.
			const admin = notificationAdmin(req);
			if (
				admin &&
				tickets.length > 0 &&
				tickets.every(
					(ticket) => Number(ticket.branch_id) === admin.branchId,
				)
			) {
				try {
					await notifier.notifyCommitted({
						type: "cancellation",
						purchaseId: id,
						committed: true,
						admin,
					});
				} catch {
					// The cancellation is already saved; a failed email must not change its result.
					console.error(
						"Booking cancellation notification failed after commit.",
					);
				}
			}

			const [rows] = await db.query(
				`${BOOKING_SELECT} WHERE p.purchase_id = ? ${BOOKING_GROUP_BY}`,
				[id],
			);
			return res.status(200).json({
				success: true,
				message: "Booking cancelled and seats released.",
				seatsReleased: tickets.length,
				booking: rows.length ? formatBooking(rows[0]) : null,
			});
		} catch (error) {
			if (!committed) {
				try {
					await conn.rollback();
				} catch {
					// connection already lost, nothing to roll back
				}
			}
			console.error("cancelBooking error:", error);
			return res
				.status(500)
				.json({ success: false, message: "Failed to cancel booking." });
		} finally {
			if (!connectionReleased) conn.release();
		}
	};

const cancelBooking = createCancelBooking();

/* ------------------------------ ID photos ------------------------------ */

const seatLabel = (rowNum, seatNum) =>
	`${String.fromCharCode(64 + rowNum)}${seatNum}`; // 1 -> "A"

// The ID photo references saved for a booking, one per discounted seat, in seat order.
// The branch is checked through the seat's cinema (not the tickets), so this still
// works for a cancelled booking whose tickets were removed when its seats were resold.
// Another branch's booking returns no rows, so it looks like "no ID photo".
// Pass seatId to get just that seat's photo.
const findIdReferences = async (bookingId, branchId, seatId = null) => {
	const params = [bookingId, branchId];
	let seatFilter = "";
	if (seatId !== null) {
		seatFilter = "AND bi.seat_id = ?";
		params.push(seatId);
	}
	const [rows] = await pool.query(
		`SELECT bi.seat_id, bi.id_image_url, se.row_num, se.seat_num, tt.type AS ticket_type
     FROM BOOKING_ID_IMAGE bi
     JOIN SEAT se ON se.seat_id = bi.seat_id
     JOIN CINEMA c ON c.cinema_id = se.cinema_id
     LEFT JOIN TICKET t ON t.purchase_id = bi.purchase_id AND t.seat_id = bi.seat_id
     LEFT JOIN TICKET_TYPE tt ON tt.type_id = t.type_id
     WHERE bi.purchase_id = ? AND c.branch_id = ? ${seatFilter}
     ORDER BY se.row_num, se.seat_num`,
		params,
	);
	return rows;
};

// A URL the admin page can show in an <img>:
//   cloud photo -> signed Cloudinary URL
//   local photo -> the /id-image/file route below
// Returns null when the stored reference is in an unknown format.
const buildIdImageUrl = (req, bookingId, branchId, row) => {
	const stored = row.id_image_url;

	if (stored?.startsWith(CLOUD_ID_PREFIX)) {
		return cloudinary.url(stored.slice(CLOUD_ID_PREFIX.length), {
			type: "authenticated",
			sign_url: true,
			secure: true,
			resource_type: "image",
		});
	}

	if (stored?.startsWith(LOCAL_ID_PREFIX)) {
		// Absolute URL: the admin page runs on a different port than this server.
		return `${req.protocol}://${req.get("host")}/api/admin/bookings/${bookingId}/id-image/file?branchId=${branchId}&seatId=${row.seat_id}`;
	}

	return null;
};

// GET /api/admin/bookings/:id/id-images?branchId=
// Returns every ID photo of the booking, one per discounted seat:
//   { success, images: [{ seat_id, seat, ticket_type, url }], url }
// `url` is the first photo's URL, kept so an admin page written for one photo keeps working.
const getBookingIdImages = async (req, res) => {
	const id = Number(req.params.id);
	if (!Number.isInteger(id) || id <= 0) {
		return res
			.status(400)
			.json({ success: false, message: "Invalid booking ID." });
	}

	const scope = parseBranchId(req.query.branchId, { required: true });
	if (scope.error) {
		return res.status(400).json({ success: false, message: scope.error });
	}

	try {
		const rows = await findIdReferences(id, scope.branchId);
		const images = rows
			.map((row) => ({
				seat_id: row.seat_id,
				seat: seatLabel(row.row_num, row.seat_num),
				ticket_type: row.ticket_type ?? null,
				url: buildIdImageUrl(req, id, scope.branchId, row),
			}))
			.filter((image) => image.url !== null);

		if (images.length === 0) {
			return res.status(404).json({
				success: false,
				message: "This booking has no ID photo.",
			});
		}
		return res
			.status(200)
			.json({ success: true, url: images[0].url, images });
	} catch (error) {
		console.error("getBookingIdImages error:", error);
		return res
			.status(500)
			.json({ success: false, message: "Failed to load the ID images." });
	}
};

// GET /api/admin/bookings/:id/id-image/file?branchId=&seatId=
// Sends a locally stored ID photo (the fallback storage). seatId picks which seat's
// photo; without it, the first local photo is sent. The file name comes from the
// database and must match the server-generated pattern, so no other path on the
// server can be requested.
const getBookingIdImageFile = async (req, res) => {
	const id = Number(req.params.id);
	if (!Number.isInteger(id) || id <= 0) {
		return res
			.status(400)
			.json({ success: false, message: "Invalid booking ID." });
	}

	const scope = parseBranchId(req.query.branchId, { required: true });
	if (scope.error) {
		return res.status(400).json({ success: false, message: scope.error });
	}

	let seatId = null;
	if (req.query.seatId !== undefined) {
		if (!isPositiveInt(req.query.seatId)) {
			return res.status(400).json({
				success: false,
				message: "seatId must be a positive integer.",
			});
		}
		seatId = Number(req.query.seatId);
	}

	try {
		const rows = await findIdReferences(id, scope.branchId, seatId);
		const stored = rows
			.map((row) => row.id_image_url)
			.find((ref) => ref?.startsWith(LOCAL_ID_PREFIX));
		const fileName = stored ? stored.slice(LOCAL_ID_PREFIX.length) : null;
		if (!fileName || !LOCAL_ID_FILE_RE.test(fileName)) {
			return res.status(404).json({
				success: false,
				message: "This booking has no ID photo.",
			});
		}

		// Never cache: this is a private document.
		res.set({
			"Cache-Control": "private, no-store",
			"X-Content-Type-Options": "nosniff",
		});
		return res.sendFile(path.join(LOCAL_ID_DIR, fileName), (err) => {
			if (err && !res.headersSent) {
				res.status(404).json({
					success: false,
					message: "The ID photo file is missing on the server.",
				});
			}
		});
	} catch (error) {
		console.error("getBookingIdImageFile error:", error);
		return res
			.status(500)
			.json({ success: false, message: "Failed to load the ID image." });
	}
};

module.exports = {
	getAdminBookings,
	cancelBooking,
	createCancelBooking,
	getBookingIdImages,
	getBookingIdImage: getBookingIdImages, // older name
	getBookingIdImageFile,
};

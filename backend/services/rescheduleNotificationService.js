const { isValidRecipient } = require("../utils/mailer");
const { sendRescheduleNotice } = require("./emailService");

// One row per ticket, restricted to the changed screening and its branch.
// The recipient is always read from USER, never from the admin request.
const AFFECTED_BOOKINGS_SQL = `
    SELECT p.purchase_id, p.reference_code,
         COALESCE(NULLIF(TRIM(p.contact_email), ''), u.email) AS customer_email,
         u.name AS customer_name, m.title AS movie_title,
         se.row_num, se.seat_num
  FROM TICKET t
  JOIN TOTAL_PURCHASE p ON p.purchase_id = t.purchase_id
  JOIN \`USER\` u ON u.user_id = p.user_id
  JOIN SCREENING s ON s.screening_id = t.screening_id
  JOIN CINEMA c ON c.cinema_id = s.cinema_id
  JOIN MOVIE m ON m.movie_id = s.movie_id
  JOIN SEAT se ON se.seat_id = t.seat_id
  WHERE t.screening_id = ? AND c.branch_id = ?
    AND p.status = 'confirmed' AND p.payment_status = 'paid'
  ORDER BY p.purchase_id, se.row_num, se.seat_num
`;

const normalTime = (value) =>
	String(value).length === 5 ? `${value}:00` : String(value);
const sameSchedule = (a, b) =>
	Number(a.cinema_id) === Number(b.cinema_id) &&
	String(a.show_date) === String(b.show_date) &&
	normalTime(a.show_time) === normalTime(b.show_time);

function bookingsFromRows(rows) {
	// Multiple ticket rows belong to one purchase, but separate purchases by
	// the same customer must remain separate notification attempts.
	const bookings = new Map();
	for (const row of rows) {
		if (!bookings.has(row.purchase_id)) {
			bookings.set(row.purchase_id, { ...row, seats: [] });
		}
		bookings
			.get(row.purchase_id)
			.seats.push(
				`${String.fromCharCode(64 + Number(row.row_num))}${row.seat_num}`,
			);
	}
	return [...bookings.values()];
}

function createRescheduleNotifier({
	env = process.env,
	send = sendRescheduleNotice,
	log = console.error,
	ticketQr,
} = {}) {
	const events = new Map();

	// Reschedule emails carry the same verification QR as the confirmation, so the
	// ticket still scans after the change. Created lazily; pass ticketQr: null to disable.
	let qrService = ticketQr;
	const getQrService = () => {
		if (qrService === undefined) {
			try {
				const { createTicketQrService } = require("./ticketQrService");
				qrService = createTicketQrService({ env, log });
			} catch {
				qrService = null;
			}
		}
		return qrService;
	};

	// Called on the showtime transaction's connection before the UPDATE. This
	// snapshot excludes purchases made after the change. It does not serialize
	// an in-flight checkout that read the old screening without locking it.
	async function prepare({
		connection,
		eventId,
		screeningId,
		previous,
		updated,
		admin,
	}) {
		if (sameSchedule(previous, updated))
			return { status: "unchanged", sent: 0 };
		if (previous.status !== "scheduled" || updated.status !== "scheduled") {
			return { status: "ineligible_screening", sent: 0 };
		}
		if (
			env.EMAIL_DELIVERY_ENABLED !== "true" ||
			env.RESCHEDULE_NOTIFICATIONS_ENABLED !== "true"
		) {
			return { status: "disabled", sent: 0 };
		}
		const branchId = Number(admin?.branchId);
		if (
			admin?.verified !== true ||
			admin.role !== "admin" ||
			!Number.isInteger(branchId) ||
			branchId !== Number(previous.branch_id) ||
			branchId !== Number(updated.branch_id)
		) {
			return { status: "unauthorized", sent: 0 };
		}
		// Existing seat assignments belong to the original cinema. The current
		// schedule endpoint does not revalidate or reassign them after a move.
		if (Number(previous.cinema_id) !== Number(updated.cinema_id)) {
			return { status: "seat_revalidation_required", sent: 0 };
		}
		if (
			!Number.isInteger(screeningId) ||
			screeningId <= 0 ||
			typeof eventId !== "string" ||
			!eventId
		) {
			return { status: "invalid_event", sent: 0 };
		}
		if (!connection?.query)
			throw new TypeError("A transaction connection is required.");

		const [rows] = await connection.query(AFFECTED_BOOKINGS_SQL, [
			screeningId,
			branchId,
		]);
		const bookings = bookingsFromRows(rows);
		if (bookings.length === 0) return { status: "no_recipients", sent: 0 };
		return { status: "ready", eventId, previous, updated, bookings };
	}

	// Only the controller calls this after a successful commit. Mark the event
	// before the first send so overlapping calls cannot both deliver it. Keep
	// the mark after an uncertain SMTP failure: retrying could double-send.
	async function notify({ prepared, committed }) {
		if (!committed) return { status: "not_committed", sent: 0 };
		if (!prepared || prepared.status !== "ready") {
			return prepared?.status && prepared.status !== "ready"
				? { status: prepared.status, sent: 0 }
				: { status: "invalid_event", sent: 0 };
		}
		const { eventId, previous, updated, bookings } = prepared;
		if (events.has(eventId)) return { status: "duplicate", sent: 0 };
		const attempts = new Map();
		events.set(eventId, attempts); // Claim before awaiting any transport.

		const results = await Promise.all(
			bookings.map(async (booking) => {
				const purchaseId = Number(booking.purchase_id);
				if (
					!Number.isSafeInteger(purchaseId) ||
					purchaseId < 1 ||
					attempts.has(purchaseId)
				) {
					return { status: "invalid_data" };
				}
				if (!isValidRecipient(booking.customer_email))
					return { status: "invalid_recipient" };
				attempts.set(purchaseId, {
					status: "in_flight",
					to: booking.customer_email,
					count: 1,
				});
				let qr = null;
				try {
					qr =
						(await getQrService()?.prepareForPurchase(
							purchaseId,
						)) ?? null;
				} catch {
					log(
						"Ticket QR preparation unavailable; reschedule email will omit the QR.",
					);
				}
				try {
					const result = await send({
						to: booking.customer_email,
						...(qr ? { attachments: [qr.attachment] } : {}),
						data: {
							...(qr
								? {
										ticketUrl: qr.ticketUrl,
										qrImageCid: qr.qrImageCid,
										...(qr.allowLocalLink
											? { allowLocalLinks: true }
											: {}),
									}
								: {}),
							customerName: booking.customer_name,
							referenceCode: booking.reference_code,
							movieTitle: booking.movie_title,
							seats: booking.seats,
							previous: {
								date: String(previous.show_date),
								time: String(previous.show_time),
								branchName: previous.branch_name,
								cinemaNumber: previous.cinema_num,
							},
							updated: {
								date: String(updated.show_date),
								time: String(updated.show_time),
								branchName: updated.branch_name,
								cinemaNumber: updated.cinema_num,
							},
						},
					});
					if (result?.status === "sent") {
						attempts.set(purchaseId, {
							status: "sent",
							to: booking.customer_email,
							count: 1,
						});
						return result;
					}
					if (
						[
							"invalid_data",
							"invalid_recipient",
							"disabled",
							"template_unavailable",
						].includes(result?.status)
					) {
						attempts.delete(purchaseId); // No transport attempt occurred.
						return result;
					}
					const status =
						result?.outcome === "definite"
							? "definite_failure"
							: "uncertain";
					attempts.set(purchaseId, {
						status,
						to: booking.customer_email,
						count: 1,
					});
					return {
						status: "failed",
						outcome:
							status === "definite_failure"
								? "definite"
								: "uncertain",
					};
				} catch {
					attempts.set(purchaseId, {
						status: "uncertain",
						to: booking.customer_email,
						count: 1,
					});
					return { status: "failed", outcome: "uncertain" };
				}
			}),
		);
		const sent = results.filter(
			(result) => result.status === "sent",
		).length;
		const summary = {
			status: sent === results.length ? "sent" : "partial_failure",
			sent,
			failed: results.filter((result) => result.status === "failed")
				.length,
			skipped: results.filter((result) =>
				[
					"invalid_recipient",
					"invalid_data",
					"disabled",
					"template_unavailable",
				].includes(result.status),
			).length,
		};
		if (summary.failed > 0) {
			const definite = results.filter(
				(result) => result.outcome === "definite",
			).length;
			log(
				`Reschedule email failure in event ${eventId}: ${definite} definite, ${summary.failed - definite} uncertain.`,
			);
		}
		return summary;
	}

	// Inspection-only retry handoff. A durable outbox and fresh eligibility
	// check are still required before any reschedule resend can be safe.
	function retryCandidates(eventId) {
		const attempts = events.get(eventId);
		if (!attempts) return [];
		return [...attempts]
			.filter(([, attempt]) => attempt.status === "definite_failure")
			.map(([purchaseId]) => purchaseId);
	}

	return { prepare, notify, retryCandidates };
}

module.exports = {
	createRescheduleNotifier,
	sameSchedule,
	AFFECTED_BOOKINGS_SQL,
};

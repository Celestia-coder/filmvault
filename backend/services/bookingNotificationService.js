const pool = require("../config/database");
const { isValidRecipient } = require("../utils/mailer");
const { sendBookingConfirmation, sendCancellationNotice } = require("./emailService");
const { createTicketQrService } = require("./ticketQrService");

// One row per ticket. Read the recipient and booking facts from committed
// server records, never from the request that initiated the operation.
const BOOKING_NOTIFICATION_SQL = `
  SELECT p.purchase_id, p.reference_code, p.status, p.payment_status,
         p.total_price, p.payment_method, p.discount_type,
         DATE_FORMAT(p.purchase_datetime, '%Y-%m-%d %H:%i:%s') AS purchased_at,
         p.user_id, u.name AS customer_name,
         u.email AS customer_email, t.screening_id,
         t.ticket_price,
         DATE_FORMAT(s.show_date, '%Y-%m-%d') AS show_date,
         TIME_FORMAT(s.show_time, '%H:%i:%s') AS show_time,
         m.title AS movie_title, m.poster, m.age_rating, m.duration,
         c.cinema_id, c.cinema_num,
         b.branch_id, b.branch_name, se.row_num, se.seat_num,
         tt.type AS ticket_type
  FROM TOTAL_PURCHASE p
  JOIN \`USER\` u ON u.user_id = p.user_id
  JOIN TICKET t ON t.purchase_id = p.purchase_id
  JOIN TICKET_TYPE tt ON tt.type_id = t.type_id
  JOIN SEAT se ON se.seat_id = t.seat_id
  JOIN SCREENING s ON s.screening_id = t.screening_id
  JOIN CINEMA c ON c.cinema_id = s.cinema_id
  JOIN BRANCH b ON b.branch_id = c.branch_id
  JOIN MOVIE m ON m.movie_id = s.movie_id
  WHERE p.purchase_id = ?
  ORDER BY se.row_num, se.seat_num
`;

const BOOKING_SNACKS_SQL = `
  SELECT sn.snack_name AS name, sp.quantity, sp.subtotal
  FROM SNACK_PURCHASE sp JOIN SNACK sn ON sn.snack_id = sp.snack_id
  WHERE sp.purchase_id = ? ORDER BY sp.snack_id
`;

const PAYMENT_METHODS = { gcash: "GCash", maya: "Maya", card: "Credit / Debit Card", bpi: "BPI Online" };
const DISCOUNT_NOTES = {
  senior: "Senior Citizen discount (ID checked at the cinema)",
  pwd: "PWD discount (ID checked at the cinema)",
  mixed: "Senior/PWD discount (ID checked at the cinema)",
};

const positiveId = (value) => Number.isInteger(value) && value > 0;

// Seeded movie posters use TMDB's public image CDN. Local/bundled filenames
// have no verified HTTPS asset origin for email, so omit them rather than
// guessing a deployment URL or embedding an unsafe third-party image.
function emailPosterUrl(value, cloudName) {
  if (typeof value !== "string" || value !== value.trim()) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password ||
        url.port || url.search || url.hash) return undefined;
    const tmdb = url.hostname === "image.tmdb.org" &&
      /^\/t\/p\/[^/]+\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i.test(url.pathname);
    const ownCloud = /^[A-Za-z0-9_-]+$/.test(cloudName || "") &&
      url.hostname === "res.cloudinary.com" &&
      url.pathname.startsWith(`/${cloudName}/image/upload/`) &&
      /\.(?:jpe?g|png|webp)$/i.test(url.pathname);
    if (!tmdb && !ownCloud) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

function createBookingNotifier({ db = pool, sendConfirmation = sendBookingConfirmation,
  sendCancellation = sendCancellationNotice, ticketQr, log = console.error,
  posterCloudName = process.env.CLOUDINARY_CLOUD_NAME } = {}) {
  // Process-local safety only. A durable outbox is required across restarts
  // and instances. At most one explicit retry follows a definite rejection.
  const attempts = new Map();
  const qr = ticketQr ?? createTicketQrService({ db, log });

  async function prepare({ type, purchaseId, committed, paymentVerified, customer, admin }) {
    if (!committed) return { status: "not_committed" };
    if (!positiveId(purchaseId)) return { status: "invalid_purchase" };
    if (type === "confirmation") {
      if (paymentVerified !== true || customer?.verified !== true ||
          !positiveId(customer.userId)) return { status: "unverified_event" };
    } else if (type === "cancellation") {
      if (admin?.verified !== true || admin.role !== "admin" ||
          !positiveId(admin.branchId)) return { status: "unauthorized" };
    } else {
      return { status: "invalid_event" };
    }

    const [rows] = await db.query(BOOKING_NOTIFICATION_SQL, [purchaseId]);
    if (rows.length === 0) return { status: "not_found" };
    const first = rows[0];
    if (rows.some((row) => Number(row.purchase_id) !== purchaseId ||
        Number(row.screening_id) !== Number(first.screening_id) ||
        Number(row.cinema_id) !== Number(first.cinema_id) ||
        Number(row.branch_id) !== Number(first.branch_id))) {
      return { status: "mixed_screenings" };
    }
    if (type === "confirmation") {
      if (Number(first.user_id) !== customer.userId) return { status: "unauthorized" };
      if (first.status !== "confirmed" || first.payment_status !== "paid") {
        return { status: "ineligible_booking" };
      }
    } else {
      if (Number(first.branch_id) !== admin.branchId) return { status: "unauthorized" };
      if (first.status !== "cancelled") return { status: "ineligible_booking" };
    }
    if (!isValidRecipient(first.customer_email)) return { status: "invalid_recipient" };

    const common = {
      customerName: first.customer_name,
      referenceCode: first.reference_code,
      movieTitle: first.movie_title,
      branchName: first.branch_name,
      showDate: String(first.show_date),
      showTime: String(first.show_time),
      seats: rows.map((row) => `${String.fromCharCode(64 + Number(row.row_num))}${row.seat_num}`),
    };
    let data = common;
    let qrAttachment;
    if (type === "confirmation") {
      const [snacks] = await db.query(BOOKING_SNACKS_SQL, [purchaseId]);
      const ticketItems = rows.map((row) => ({
        seat: `${String.fromCharCode(64 + Number(row.row_num))}${row.seat_num}`,
        type: row.ticket_type,
        price: Number(row.ticket_price),
      }));
      const snackItems = snacks.map((row) => ({
        name: row.name, quantity: Number(row.quantity), subtotal: Number(row.subtotal),
      }));
      const total = Number(first.total_price);
      const itemTotal = ticketItems.reduce((sum, item) => sum + item.price, 0) +
        snackItems.reduce((sum, item) => sum + item.subtotal, 0);
      // Match the e-ticket's derived booking fee, but never display a
      // fabricated negative fee if committed totals are inconsistent.
      const feeCents = Math.round((total - itemTotal) * 100);
      if (!Number.isFinite(total) || feeCents < 0 ||
          ticketItems.some((item) => !Number.isFinite(item.price)) ||
          snackItems.some((item) => !Number.isFinite(item.subtotal))) {
        return { status: "inconsistent_total" };
      }
      data = {
        ...common,
        cinemaNumber: first.cinema_num,
        ticketTypes: rows.map((row) => row.ticket_type),
        ticketItems,
        snackItems,
        bookingFee: feeCents / 100,
        amountPaid: total,
        movieRating: first.age_rating || undefined,
        posterUrl: emailPosterUrl(first.poster, posterCloudName),
        runtimeMinutes: Number(first.duration) || undefined,
        paymentMethod: PAYMENT_METHODS[first.payment_method] ?? first.payment_method,
        discountNote: DISCOUNT_NOTES[first.discount_type] ?? undefined,
        bookedAt: first.purchased_at || undefined,
      };
      // Optional, separately gated read: the main query remains compatible
      // with databases that do not yet have verification_token.
      try {
        const ticketQr = await qr.prepareForPurchase(purchaseId);
        if (ticketQr) {
          data.ticketUrl = ticketQr.ticketUrl;
          data.qrImageCid = ticketQr.qrImageCid;
          qrAttachment = ticketQr.attachment;
        }
      } catch {
        log("Ticket QR preparation unavailable; confirmation will omit the QR.");
      }
    }
    return { status: "ready", type, purchaseId, to: first.customer_email, data, qrAttachment };
  }

  async function deliver(prepared, retry = false) {
    if (prepared?.status !== "ready") return { status: prepared?.status ?? "invalid_event" };
    const key = `${prepared.type}:${prepared.purchaseId}`;
    const prior = attempts.get(key);
    if (prior && (!retry || prior.status !== "definite_failure" ||
        prior.count >= 2 || prior.to !== prepared.to)) return { status: "duplicate" };
    if (retry && !prior) return { status: "not_retryable" };
    attempts.set(key, { status: "in_flight", count: (prior?.count ?? 0) + 1, to: prepared.to });
    try {
      const send = prepared.type === "confirmation" ? sendConfirmation : sendCancellation;
      const result = await send({ to: prepared.to, data: prepared.data,
        ...(prepared.type === "confirmation" && prepared.qrAttachment ? { attachments: [prepared.qrAttachment] } : {}) });
      if (result?.status === "sent") {
        attempts.set(key, { status: "sent", count: (prior?.count ?? 0) + 1, to: prepared.to });
        return result;
      }
      if (["disabled", "invalid_data", "invalid_recipient", "template_unavailable"].includes(result?.status)) {
        // No transport attempt was made; a later authorized event may prepare again.
        if (prior) attempts.set(key, prior);
        else attempts.delete(key);
        return result;
      }
      if (result?.status === "failed" && result.outcome === "definite") {
        attempts.set(key, { status: "definite_failure", count: (prior?.count ?? 0) + 1, to: prepared.to });
        log(`Booking ${prepared.type} email definitely rejected for purchase ${prepared.purchaseId}.`);
        return result;
      }
    } catch {
      // The database operation already committed. Keep its outcome successful.
    }
    attempts.set(key, { status: "uncertain", count: (prior?.count ?? 0) + 1, to: prepared.to });
    log(`Booking ${prepared.type} email outcome uncertain for purchase ${prepared.purchaseId}.`);
    return { status: "failed", outcome: "uncertain" };
  }

  const notify = (prepared) => deliver(prepared);

  // Guarded controller hooks call this only after their transaction commits.
  // Preparation reads the committed purchase, not request data.
  async function notifyCommitted(event) {
    let prepared;
    try {
      prepared = await prepare(event);
    } catch {
      log(`Booking ${event?.type === "cancellation" ? "cancellation" : "confirmation"} email preparation failed.`);
      return { status: "preparation_failed" };
    }
    return notify(prepared);
  }

  // Internal, manual-only retry interface. Reprepare from committed records
  // and recheck verified actor, payment/status, branch and current recipient.
  // Never call for an SMTP timeout or from a public route.
  async function retryDefiniteFailure(event) {
    let prepared;
    try { prepared = await prepare(event); }
    catch {
      log(`Booking ${event?.type === "cancellation" ? "cancellation" : "confirmation"} retry preparation failed.`);
      return { status: "preparation_failed" };
    }
    return deliver(prepared, true);
  }

  return { prepare, notify, notifyCommitted, retryDefiniteFailure };
}

module.exports = { createBookingNotifier, BOOKING_NOTIFICATION_SQL, BOOKING_SNACKS_SQL };

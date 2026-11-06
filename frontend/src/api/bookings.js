// api/bookings.js
// Booking requests (customer side): checkout, the My Bookings list, and one
// e-ticket. Uses the shared request() from movies.js, so errors look the same
// everywhere (ApiError with .status and .data; .data.code says what went wrong).
//
//   API (DB column)             ->  Page field
//   booking_id                  ->  id
//   reference_code              ->  referenceNo
//   movie_title / poster        ->  title / poster (resolved image URL)
//   duration (minutes)          ->  runtimeMins
//   show_date + show_time       ->  showDateTime ("2026-11-04T10:00:00")
//   branch_name, cinema_num     ->  branchName, cinemaNum
//   seats (["A1","A2"])         ->  seats
//   tickets[].ticket_type/price ->  tickets[].type / price
//   total_price, tickets_total, snacks_total, booking_fee -> totalPrice, ticketsTotal, snacksTotal, bookingFee
//   snacks[].name/quantity/unit_price/subtotal -> snacks[].name/quantity/unitPrice/subtotal
//   status: confirmed | pending | cancelled      payment_status: pending | paid | failed

import { request, resolvePoster } from "./movies.js";

// Error codes POST /api/bookings can answer with (error.data.code).
export const BOOKING_ERRORS = {
  HOLD_EXPIRED: "HOLD_EXPIRED", // the hold ran out: pick seats again
  SEAT_TAKEN: "SEAT_TAKEN", // someone else got a seat: pick seats again
  PAYMENT_FAILED: "PAYMENT_FAILED", // seats were released: pick seats again
  ID_IMAGE_REQUIRED: "ID_IMAGE_REQUIRED",
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
};

// Errors after which the seats are gone and the only way forward is the seat map.
export const NEEDS_NEW_SEATS = [
  BOOKING_ERRORS.HOLD_EXPIRED,
  BOOKING_ERRORS.SEAT_TAKEN,
  BOOKING_ERRORS.PAYMENT_FAILED,
];

function mapBooking(raw) {
  return {
    id: raw.booking_id,
    referenceNo: raw.reference_code,
    status: raw.status,
    paymentStatus: raw.payment_status,
    paymentMethod: raw.payment_method,
    discountType: raw.discount_type,
    totalPrice: raw.total_price,
    ticketsTotal: raw.tickets_total,
    snacksTotal: raw.snacks_total,
    bookingFee: raw.booking_fee,
    purchasedAt: raw.purchase_datetime,
    title: raw.movie_title,
    poster: resolvePoster(raw.poster),
    rating: raw.age_rating,
    runtimeMins: Number(raw.duration) || 0,
    showDateTime: `${raw.show_date}T${raw.show_time}`,
    branchName: raw.branch_name,
    cinemaNum: raw.cinema_num,
    ticketCount: raw.ticket_count,
    seats: raw.seats,
    tickets: raw.tickets.map((t) => ({ id: t.ticket_id, seat: t.seat, type: t.ticket_type, price: t.ticket_price })),
    snacks: raw.snacks.map((x) => ({
      id: x.snack_id,
      name: x.name,
      quantity: x.quantity,
      unitPrice: x.unit_price,
      subtotal: x.subtotal,
    })),
  };
}

// POST /api/bookings (multipart: the ID photo is a file upload).
//   seatIds      the held seat ids, e.g. [41, 42]
//   ticketTypes  { [seatId]: "regular" | "senior" | "pwd" }
//   snacks       [{ snackId, quantity }]  (the server prices them from the SNACK table)
//   idImage      File, required when any seat is senior/pwd. The API stores ONE
//                ID photo per booking, so Checkout sends the first discounted seat's.
// Resolves to the confirmed booking. Rejects with an ApiError (see BOOKING_ERRORS).
export async function createBooking(
  { userId, showtimeId, seatIds, ticketTypes, paymentMethod, snacks = [], idImage },
  signal
) {
  const form = new FormData();
  form.append("userId", userId);
  form.append("showtimeId", showtimeId);
  form.append("seatIds", JSON.stringify(seatIds));
  form.append("ticketTypes", JSON.stringify(ticketTypes));
  form.append("paymentMethod", paymentMethod);
  if (snacks.length > 0) form.append("snacks", JSON.stringify(snacks));

  // discount_type is only sent when every discounted seat has the same type.
  const kinds = new Set(Object.values(ticketTypes).filter((t) => t !== "regular"));
  if (kinds.size <= 1) form.append("discount_type", kinds.size === 0 ? "none" : [...kinds][0]);
  if (idImage) form.append("idImage", idImage);

  const body = await request("/api/bookings", { method: "POST", body: form, signal });
  return mapBooking(body.booking);
}

// GET /api/bookings?userId=   newest first
export async function fetchBookings(userId, { signal } = {}) {
  const body = await request("/api/bookings", { signal, params: { userId } });
  return body.bookings.map(mapBooking);
}

// GET /api/bookings/:id?userId=
export async function fetchBooking(bookingId, userId, { signal } = {}) {
  const body = await request(`/api/bookings/${bookingId}`, { signal, params: { userId } });
  return mapBooking(body.booking);
}

// GET /api/snacks - the food & drinks menu. Prices shown here are for display only;
// the booking endpoint prices the order again on the server.
export async function fetchSnacks({ signal } = {}) {
  const body = await request("/api/snacks", { signal });
  return body.snacks.map((x) => ({ id: x.snack_id, name: x.snack_name, price: x.snack_price }));
}

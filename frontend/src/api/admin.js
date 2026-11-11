// api/admin.js
// Admin-side requests (seat map, seat block/release, bookings, branch showtimes).
// Built on the shared request() from movies.js, so errors are the same ApiError
// (.status, .data, .message) the client pages already handle.
//
// Every admin endpoint is scoped with ?branchId=. It comes from the logged-in
// admin (POST /api/auth/login returns it as user.branchId).
//
// TODO (before real deployment): the backend trusts ?branchId= from the URL.
// Swap it for the branch on a verified session/token.

import { request } from "./movies.js";
import { getUser } from "./session.js";

/* --------------------------------- session --------------------------------- */

// The logged-in admin, or null (not logged in / not an admin / no branch).
// Pages use this to redirect to /admin/login.
export function getAdminSession() {
  const user = getUser();
  const branchId = Number(user?.branchId);
  if (!user || user.role !== "admin" || !Number.isInteger(branchId) || branchId <= 0) {
    return null;
  }
  return { ...user, branchId };
}

/* -------------------------------- showtimes -------------------------------- */

// Showtimes of ONE branch, with movie titles joined in.
//   API: GET /api/showtimes + GET /api/movies  (filtered to the branch here,
//   because /api/showtimes has no branchId filter)
export async function fetchBranchShowtimes(branchId, signal) {
  const [showtimeBody, movieBody] = await Promise.all([
    request("/api/showtimes", { signal }),
    request("/api/movies", { signal }),
  ]);

  const titles = new Map(movieBody.movies.map((movie) => [movie.movie_id, movie.title]));
  const posters = new Map(
    movieBody.movies.map((movie) => [
      movie.movie_id,
      /^https?:\/\//i.test(movie.poster ?? "") ? movie.poster : null,
    ])
  );

  const showtimes = showtimeBody.showtimes
    .filter((showtime) => showtime.branch_id === branchId)
    .map((showtime) => ({
      id: showtime.showtime_id,
      movieId: showtime.movie_id,
      movieTitle: titles.get(showtime.movie_id) ?? `Movie #${showtime.movie_id}`,
      poster: posters.get(showtime.movie_id) ?? null,
      cinemaId: showtime.cinema_id,
      cinemaNum: showtime.cinema_num,
      date: showtime.show_date, // "YYYY-MM-DD"
      time: showtime.show_time, // "HH:MM:SS"
      status: showtime.status,
    }));

  return { showtimes };
}

/* ------------------------------- seat management ---------------------------- */

// Admin API says "sold"; the customer API and the pages say "booked".
function mapAdminSeat(raw) {
  return {
    id: raw.seat_id,
    label: raw.label,
    rowNum: raw.row_num,
    number: raw.seat_num,
    status: raw.status === "sold" ? "booked" : raw.status, // available | booked | held | blocked
    bookingId: raw.booking_id,
    price: raw.ticket_price ?? 0,
  };
}

// GET /api/admin/cinemas/:id/seat-map?showtimeId=&branchId=
// -> stats { total, available, sold, held, blocked, revenue } + rows of seats
export async function fetchAdminSeatMap({ cinemaId, showtimeId, branchId }, signal) {
  const body = await request(`/api/admin/cinemas/${cinemaId}/seat-map`, {
    signal,
    params: { showtimeId, branchId },
  });
  return {
    stats: body.stats,
    rows: body.rows.map((row) => ({
      label: row.label,
      rowNum: row.row_num,
      seats: row.seats.map(mapAdminSeat),
    })),
  };
}

// PUT /api/admin/showtimes/:id/seats/:seatId?branchId=   action: "block" | "release"
// Rejects with ApiError (409 if the seat is sold, or held when blocking).
export function setSeatStatus({ showtimeId, seatId, branchId, action }, signal) {
  return request(`/api/admin/showtimes/${showtimeId}/seats/${seatId}`, {
    method: "PUT",
    params: { branchId },
    body: { action },
    signal,
  });
}

/* --------------------------------- bookings -------------------------------- */

function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

// ["Senior", "Regular", "Senior"] -> "Senior ×2, Regular ×1"
export function summarizeTicketTypes(types) {
  const counts = new Map();
  types.forEach((type) => counts.set(type, (counts.get(type) ?? 0) + 1));
  return [...counts].map(([type, count]) => `${type} ×${count}`).join(", ");
}

function mapBooking(raw) {
  const ticketTypes = Array.isArray(raw.ticket_types) ? raw.ticket_types : [];
  return {
    id: raw.booking_id,
    reference: raw.booking_ref || `FV-${String(raw.booking_id).padStart(5, "0")}`,
    customer: { name: raw.customer_name, email: raw.customer_email },
    movieId: raw.movie_id,
    movieTitle: raw.movie_title,
    showtimeId: raw.showtime_id,
    datetime: `${raw.show_date}T${String(raw.show_time).slice(0, 5)}`,
    cinema: `Cinema ${raw.cinema_num}`,
    branch: raw.branch_name,
    seats: raw.seats,
    ticketTypes, // one per seat, same order as seats
    discountLabel: summarizeTicketTypes(ticketTypes),
    // No ID-status column exists in the database yet. When the backend starts
    // returning `id_status`, it shows up here (and in the pages) automatically.
    idStatus: raw.id_status ?? null,
    amount: raw.total_price,
    status: capitalize(raw.status), // Confirmed | Pending | Cancelled
    paymentMethod: raw.payment_method,
    bookedAt: raw.purchase_datetime,
  };
}

// GET /api/admin/bookings?branchId=&status=&date=&movieId=
export async function fetchAdminBookings({ branchId, status, date, movieId }, signal) {
  const body = await request("/api/admin/bookings", {
    signal,
    params: { branchId, status, date, movieId },
  });
  return body.bookings.map(mapBooking);
}

// PATCH /api/admin/bookings/:id?branchId=   body { status: "cancelled" }
// Releases the seats. Resolves { seatsReleased }.
// TODO (touchpoint): the backend should send the cancellation email here once
// the email service exists.
export async function cancelBooking({ bookingId, branchId }, signal) {
  const body = await request(`/api/admin/bookings/${bookingId}`, {
    method: "PATCH",
    params: { branchId },
    body: { status: "cancelled" },
    signal,
  });
  return { seatsReleased: body.seatsReleased };
}

// api/seats.js
// Seat map + seat hold requests (customer side). Uses the shared request()
// from movies.js so errors look the same everywhere (ApiError with .status
// and .data).
//
//   API                          ->  Page field
//   id                           ->  id (number, used for holds)
//   label ("A1")                 ->  label (shown to the user, passed to Checkout)
//   status                       ->  status: available | held | booked | blocked
//   heldByYou                    ->  heldByYou (the current user's own hold)

import { request } from "./movies.js";

function mapSeat(raw) {
  return {
    id: raw.id,
    label: raw.label ?? `${raw.row}${raw.number}`,
    row: raw.row,
    rowNum: raw.rowNum,
    number: raw.number,
    status: raw.status,
    heldByYou: Boolean(raw.heldByYou),
  };
}

// GET /api/showtimes/:id/seats   (userId is optional: marks the user's own holds)
export async function fetchSeatMap(showtimeId, { userId, signal } = {}) {
  const body = await request(`/api/showtimes/${showtimeId}/seats`, {
    signal,
    params: { userId },
  });
  return { cinema: body.cinema, seats: body.seats.map(mapSeat) };
}

// POST /api/showtimes/:id/seats/hold
// Rejects with an ApiError. On a 409, error.data.failedSeats is
// [{ seatId, reason: "held" | "booked" | "blocked" }].
export async function holdSeats(showtimeId, { userId, seatIds }, signal) {
  const body = await request(`/api/showtimes/${showtimeId}/seats/hold`, {
    method: "POST",
    body: { userId, seatIds },
    signal,
  });
  return {
    seatIds: body.seatIds,
    holdMinutes: body.holdMinutes,
    expiresInSeconds: body.expiresInSeconds,
  };
}
// api/auth.js
// Signup + profile requests. Built on the shared request() from movies.js, so
// errors are the same ApiError (.status, .data, .message) the other pages handle.
// For validation errors the API also sends data.field (e.g. "email", "username").
//
// TODO (before real deployment): the profile endpoints trust the userId we send
// (like the booking endpoints). Swap for a verified session/token later.

import { request } from "./movies.js";

// POST /api/auth/register
export function registerUser({ firstName, lastName, email, password, username, phone }, signal) {
  return request("/api/auth/register", {
    method: "POST",
    signal,
    body: { firstName, lastName, email, password, username, phoneNum: phone || null },
  });
}

// GET /api/auth/profile?userId=  ->  profile object
export async function fetchProfile(userId, signal) {
  const body = await request("/api/auth/profile", { signal, params: { userId } });
  return body.profile;
}

// PUT /api/auth/profile  ->  the saved profile object
// Send currentPassword + newPassword only when the user is changing it.
export async function saveProfile(userId, fields, signal) {
  const body = await request("/api/auth/profile", {
    method: "PUT",
    signal,
    body: { userId, ...fields },
  });
  return body.profile;
}

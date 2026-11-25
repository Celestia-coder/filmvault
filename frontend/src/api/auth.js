// api/auth.js
// Signup + profile requests. Built on the shared request() from movies.js, so
// errors are the same ApiError (.status, .data, .message) the other pages handle.
// For validation errors the API also sends data.field (e.g. "email", "username").
//
// TODO (before real deployment): the profile endpoints trust the userId we send
// (like the booking endpoints). Swap for a verified session/token later.

import { request } from "./movies.js";

// POST /api/auth/register/send-otp
// Emails a 6-digit code to `email`. Rejects with 409 (field email/username) if
// either is taken, and 429 if a code was sent less than 60s ago.
export function sendRegisterOtp({ email, username }, signal) {
	return request("/api/auth/register/send-otp", {
		method: "POST",
		signal,
		body: { email, username },
	});
}

// POST /api/auth/register
// `otp` is the code from sendRegisterOtp; the account is only created if it matches.
export function registerUser(
	{ firstName, lastName, email, password, username, phone, otp },
	signal,
) {
	return request("/api/auth/register", {
		method: "POST",
		signal,
		body: {
			firstName,
			lastName,
			email,
			password,
			username,
			phoneNum: phone || null,
			otp,
		},
	});
}

// POST /api/auth/google
// `credential` is the ID token from <GoogleButton />. Logs in or creates the
// customer and resolves to the same { token, user } body as login, plus isNewUser.
export function googleLogin(credential, signal) {
	return request("/api/auth/google", {
		method: "POST",
		signal,
		body: { credential },
	});
}

// GET /api/auth/profile?userId=  ->  profile object
export async function fetchProfile(userId, signal) {
	const body = await request("/api/auth/profile", {
		signal,
		params: { userId },
	});
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

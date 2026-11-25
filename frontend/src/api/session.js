// api/session.js
// Remembers the logged-in user in the browser so any page can read who they are.
// The user object is what POST /api/auth/login returns:
//   { userId, username, name, email, role, branchId }
// The signed login token is stored separately by api/authToken.js and sent as
// "Authorization: Bearer <token>" by request() in api/movies.js.

import { clearToken } from "./authToken.js";

const KEY = "filmvault_user";

export function saveUser(user) {
	try {
		localStorage.setItem(KEY, JSON.stringify(user));
	} catch {
		// storage unavailable (private mode, quota): the user just has to log in again
	}
}

export function getUser() {
	try {
		return JSON.parse(localStorage.getItem(KEY));
	} catch {
		return null;
	}
}

export function clearUser() {
	try {
		localStorage.removeItem(KEY);
	} catch {
		// nothing to clear
	}
	clearToken();
}

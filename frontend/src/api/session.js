// api/session.js
// Remembers the logged-in user in the browser so any page can read who they are.
// The user object is exactly what POST /api/auth/login returns:
//   { userId, username, name, email, role }
//
// TODO (before real deployment): this is NOT real authentication. Anyone can
// edit localStorage. A real login needs a session cookie or token issued and
// checked by the backend.

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
}
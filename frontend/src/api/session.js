// api/session.js
// Remembers the logged-in user in the browser so any page can read who they are.
// The user object is exactly what POST /api/auth/login returns:
//   { userId, username, name, email, role }
//
// The localStorage user is UI state only. The backend checks a signed token
// stored separately in sessionStorage and resolves role/branch from USER.

const KEY = "filmvault_user";
const TOKEN_KEY = "filmvault_auth_token";

export function saveUser(user, token) {
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
    if (token !== undefined) sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // storage unavailable (private mode, quota): the user just has to log in again
  }
}

export function getUser() {
  try {
    if (!getToken()) return null;
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

export function clearUser() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // nothing to clear
  }
}

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Protected requests fail closed if browser storage is unavailable.
  }
}

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

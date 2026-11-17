// utils/phone.js
// Philippine mobile numbers are stored in the local 11-digit form 09XXXXXXXXX
// (the same form as database/seed.sql and the Profile page validation).
//
// Accepts the common ways people type it: 09171234567, 9171234567,
// 639171234567, +639171234567 (spaces, dashes and brackets are ignored).
//
// Returns { phone } (null when nothing was given) or { error }.

const normalizePhone = (raw) => {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return { phone: null };
  }

  let digits = String(raw).replace(/[\s\-()]/g, "");
  if (digits.startsWith("+63")) digits = `0${digits.slice(3)}`;
  else if (/^63\d{10}$/.test(digits)) digits = `0${digits.slice(2)}`;
  else if (/^9\d{9}$/.test(digits)) digits = `0${digits}`;

  if (!/^09\d{9}$/.test(digits)) {
    return { error: "Enter a valid mobile number, e.g. 0917 123 4567." };
  }
  return { phone: digits };
};

module.exports = { normalizePhone };

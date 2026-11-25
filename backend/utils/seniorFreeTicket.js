// utils/seniorFreeTicket.js
// Senior Citizen free-ticket promo (all branches).
//
//   Every Monday and Tuesday, first screening only:
//     Cinema 1 - 1:00 PM
//     Cinema 2 - 1:00 PM
//
//   Senior from Taguig City  -> ticket is free and the booking fee is waived
//   Senior from elsewhere    -> the normal 20% senior discount only
//
// This file only answers "is this screening part of the promo?". The price
// itself is worked out in utils/pricing.js. Residency can't be checked online:
// the customer ticks "I live in Taguig" and the ID is checked at the cinema counter.

const FREE_TICKET_WEEKDAYS = [1, 2]; // Date#getDay(): 1 = Monday, 2 = Tuesday
const FREE_TICKET_CINEMA_NUMS = [1, 2];
const FREE_TICKET_TIME = "13:00:00"; // the first screening
const SENIOR_TAGUIG_FREE = "SENIOR_TAGUIG_FREE"; // saved in TICKET.promo_code

// "2026-11-24" (or a Date) -> 0..6. Uses the calendar date as written, so the
// server's time zone can't move a Tuesday screening to Monday or Wednesday.
const weekdayOf = (showDate) => {
  let ymd;
  if (showDate instanceof Date) {
    ymd = [showDate.getFullYear(), showDate.getMonth() + 1, showDate.getDate()];
  } else {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(showDate ?? ""));
    if (!match) return null;
    ymd = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  return new Date(Date.UTC(ymd[0], ymd[1] - 1, ymd[2])).getUTCDay();
};

// "13:00" | "13:00:00" -> "13:00:00"
const normalizeTime = (showTime) => {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(showTime ?? ""));
  if (!match) return null;
  const [, h, m, s = "00"] = match;
  return `${h.padStart(2, "0")}:${m}:${s}`;
};

const isSeniorFreeScreening = ({ showDate, showTime, cinemaNum }) => {
  const weekday = weekdayOf(showDate);
  return (
    weekday !== null &&
    FREE_TICKET_WEEKDAYS.includes(weekday) &&
    FREE_TICKET_CINEMA_NUMS.includes(Number(cinemaNum)) &&
    normalizeTime(showTime) === FREE_TICKET_TIME
  );
};

module.exports = {
  isSeniorFreeScreening,
  SENIOR_TAGUIG_FREE,
  FREE_TICKET_WEEKDAYS,
  FREE_TICKET_CINEMA_NUMS,
  FREE_TICKET_TIME,
};

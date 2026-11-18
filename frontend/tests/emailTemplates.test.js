import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBookingConfirmationEmail,
  buildBookingCancellationEmail,
  buildShowtimeRescheduleEmail,
} from "../src/email/emailTemplates.js";

const base = {
  referenceCode: "FV-ABCD2345",
  movieTitle: "A Fictional Film",
  branchName: "Example Branch",
  showDate: "2026-12-05",
  showTime: "18:30:00",
  seats: ["A1", "A2"],
};

test("confirmation includes booking facts, optional details, Philippine formatting, and text", () => {
  const email = buildBookingConfirmationEmail({
    ...base,
    customerName: "Sam Example",
    cinemaNumber: 3,
    ticketTypes: ["Regular", "Senior"],
    amountPaid: 480.5,
    ticketUrl: "https://example.com/tickets/FV-ABCD2345",
  });
  assert.match(email.subject, /booking confirmed.*FV-ABCD2345/);
  for (const value of ["FilmVault", "Sam Example", "FV-ABCD2345", "A Fictional Film", "Example Branch", "Cinema 3", "A1, A2", "Regular, Senior", "₱480.50", "December 5, 2026", "6:30 PM", "PHT"]) {
    assert.ok(email.html.includes(value), `HTML missing ${value}`);
    assert.ok(email.text.includes(value), `text missing ${value}`);
  }
  assert.match(email.html, /href="https:\/\/example\.com\/tickets\/FV-ABCD2345"/);
});

test("confirmation omits optional fields and never claims a ticket link is present", () => {
  const email = buildBookingConfirmationEmail({ ...base, cinemaNumber: 1 });
  assert.doesNotMatch(email.html, /Amount paid|Ticket types|View your ticket|undefined|null/);
  assert.doesNotMatch(email.text, /Amount paid|Ticket types|View your ticket|undefined|null/);
  assert.doesNotMatch(email.html, /example\.com/);
});

test("confirmation presents optional e-ticket purchase lines without changing its layout", () => {
  const email = buildBookingConfirmationEmail({
    ...base,
    cinemaNumber: 2,
    movieRating: "PG",
    runtimeMinutes: 125,
    ticketTypes: ["Regular", "Senior"],
    ticketItems: [
      { seat: "A1", type: "Regular", price: 350 },
      { seat: "A2", type: "Senior", price: 300 },
    ],
    snackItems: [{ name: "Popcorn", quantity: 2, subtotal: 100 }],
    bookingFee: 90,
    amountPaid: 840,
    paymentMethod: "GCash",
    discountNote: "Senior Citizen discount (ID checked at the cinema)",
    bookedAt: "2026-11-15 14:20:00",
  });
  for (const value of ["PG · 125 min", "Seat A1 · Regular", "Seat A2 · Senior", "Popcorn × 2",
    "₱350.00", "₱300.00", "₱100.00", "₱90.00", "₱840.00", "Paid via GCash",
    "Senior Citizen discount", "November 15, 2026", "2:20 PM"]) {
    assert.ok(email.html.includes(value), `HTML missing ${value}`);
    assert.ok(email.text.includes(value), `text missing ${value}`);
  }
  assert.match(email.html, /border:1px dashed #c8c8c8/);
  assert.match(email.html, /border:1px solid #c8c8c8;border-radius:12px;border-collapse:separate;background:#ffffff/);
  assert.match(email.html, /border-top:1px solid #d0d0d0/);
  assert.match(email.html, />Total<\/td>/);
  assert.match(email.html, /Branch<\/p>/);
  assert.match(email.html, /Paid via GCash<br>Senior Citizen discount.*<br>Booked on Sunday, November 15, 2026/s);
  assert.doesNotMatch(email.html, />Ticket types</);
  assert.match(email.html, /border-radius:999px;background:#e2f5ec;color:#178654/);
  assert.equal((email.html.match(/PG · 125 min/g) ?? []).length, 1);
  assert.match(email.text, /Movie rating & runtime: PG · 125 min/);
  assert.doesNotMatch(email.html, /View your ticket|\/verify\//);
});

test("purchase line values are escaped and invalid line amounts are rejected", () => {
  const attack = '<img src=x onerror="alert(1)">';
  const email = buildBookingConfirmationEmail({ ...base, cinemaNumber: 2,
    ticketItems: [{ seat: "A1", type: attack, price: 100 }],
    snackItems: [{ name: attack, quantity: 1, subtotal: 50 }],
  });
  assert.match(email.html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.doesNotMatch(email.html, /<img src=x/);
  assert.throws(() => buildBookingConfirmationEmail({ ...base, cinemaNumber: 2,
    ticketItems: [{ seat: "A1", type: "Regular" }] }), /price/);
  assert.throws(() => buildBookingConfirmationEmail({ ...base, cinemaNumber: 2,
    snackItems: [{ name: "Popcorn", quantity: 0, subtotal: 10 }] }), /quantity/);
});

test("ticket links require an explicit public HTTPS URL", () => {
  const noDeploymentUrl = buildBookingConfirmationEmail({ ...base, cinemaNumber: 2, ticketUrl: undefined });
  assert.doesNotMatch(noDeploymentUrl.html, /View your ticket|\/verify\//);
  const linked = buildBookingConfirmationEmail({ ...base, cinemaNumber: 2,
    ticketUrl: "https://tickets.example.org/verify/0123456789abcdef0123456789abcdef" });
  assert.match(linked.html, /href="https:\/\/tickets\.example\.org\/verify\/0123456789abcdef0123456789abcdef"/);
  assert.throws(() => buildBookingConfirmationEmail({ ...base, cinemaNumber: 2,
    ticketUrl: "https://localhost/verify/0123456789abcdef0123456789abcdef" }), /ticketUrl/);
});

test("long titles, many seats, and the booking reference remain readable content", () => {
  const movieTitle = "A Very Long Fictional Movie Title About Exploring Every Island Beyond the Horizon";
  const seatList = ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"];
  const email = buildBookingConfirmationEmail({ ...base, movieTitle, seats: seatList, cinemaNumber: 2 });
  for (const content of [movieTitle, seatList.join(", "), base.referenceCode]) {
    assert.ok(email.html.includes(content));
    assert.ok(email.text.includes(content));
  }
  assert.match(email.html, /Reference code<\/p>\s*<p[^>]*>FV-ABCD2345<\/p>/);
});

test("confirmation uses the white e-ticket while other notices retain their styling", () => {
  const emails = [
    buildBookingConfirmationEmail({ ...base, cinemaNumber: 2 }),
    buildBookingCancellationEmail(base),
    buildShowtimeRescheduleEmail({
      referenceCode: base.referenceCode,
      movieTitle: base.movieTitle,
      previous: { date: "2026-12-05", time: "18:30" },
      updated: { date: "2026-12-06", time: "19:00" },
    }),
  ];
  for (const [index, email] of emails.entries()) {
    assert.match(email.html, /FILMVAULT/);
    assert.match(email.html, index === 0 ? /Reference code/ : /Booking reference/);
    assert.match(email.html, index === 0 ? /border:1px dashed #c8c8c8/ : /border:1px dashed #2c2c2c/);
    assert.doesNotMatch(email.html, /<img\b/);
  }
  assert.match(emails[0].html, /<body style="[^"]*background:#ffffff;color:#191919/);
  assert.match(emails[1].html, /<body style="[^"]*background:#191919;color:#ffffff/);
  assert.match(emails[2].html, /<body style="[^"]*background:#191919;color:#ffffff/);
});

test("optional poster URLs are escaped and unsafe poster URLs are rejected", () => {
  const posterUrl = "https://example.com/poster.jpg?size=90&format=webp";
  const email = buildBookingConfirmationEmail({ ...base, cinemaNumber: 2, posterUrl });
  assert.match(email.html, /src="https:\/\/example\.com\/poster\.jpg\?size=90&amp;format=webp"/);
  assert.match(email.html, /alt="A Fictional Film poster"/);
  assert.throws(() => buildBookingCancellationEmail({ ...base, posterUrl: "http://example.com/poster.jpg" }), /posterUrl/);
  assert.throws(() => buildBookingConfirmationEmail({ ...base, cinemaNumber: 2, posterUrl: "javascript:alert(1)" }), /posterUrl/);
});

test("confirmation can show an inline ticket QR while plain text retains the verification URL", () => {
  const ticketUrl = "https://tickets.example.com/verify/0123456789abcdef0123456789abcdef";
  const email = buildBookingConfirmationEmail({ ...base, cinemaNumber: 2,
    ticketUrl, qrImageCid: "filmvault-ticket-qr@filmvault.invalid" });
  assert.match(email.html, /src="cid:filmvault-ticket-qr@filmvault\.invalid"/);
  assert.match(email.html, /alt="QR code to verify booking FV-ABCD2345"/);
  assert.match(email.html, /<td width="132"[^>]*><table[^>]*>.*src="cid:filmvault-ticket-qr@filmvault\.invalid"/s);
  assert.match(email.html, /Scan to verify ticket<\/td>/);
  assert.match(email.html, /Verify your ticket/);
  assert.match(email.text, new RegExp(ticketUrl));
  assert.doesNotMatch(email.text, /cid:|image\/png/);
  assert.throws(() => buildBookingConfirmationEmail({ ...base, cinemaNumber: 2,
    qrImageCid: "filmvault-ticket-qr@filmvault.invalid" }), /qrImageCid/);
  assert.throws(() => buildBookingConfirmationEmail({ ...base, cinemaNumber: 2,
    ticketUrl, qrImageCid: 'bad" onerror="alert(1)' }), /qrImageCid/);
});

test("the tracked FilmVault logo can be supplied over HTTPS with text fallback", () => {
  const logoUrl = "https://example.com/filmvault-logo.png?edition=1&size=330";
  const emails = [
    buildBookingConfirmationEmail({ ...base, cinemaNumber: 2, logoUrl }),
    buildBookingCancellationEmail({ ...base, logoUrl }),
    buildShowtimeRescheduleEmail({
      referenceCode: base.referenceCode,
      movieTitle: base.movieTitle,
      logoUrl,
      previous: { date: "2026-12-05", time: "18:30" },
      updated: { date: "2026-12-06", time: "19:00" },
    }),
  ];
  for (const email of emails) {
    assert.match(email.html, /src="https:\/\/example\.com\/filmvault-logo\.png\?edition=1&amp;size=330"/);
    assert.match(email.html, /alt="FILMVAULT"/);
    assert.match(email.text, /^FilmVault\n/);
  }
  assert.throws(() => buildBookingConfirmationEmail({ ...base, cinemaNumber: 2, logoUrl: "/src/assets/images/logo.png" }), /logoUrl/);
  assert.throws(() => buildBookingCancellationEmail({ ...base, logoUrl: "http://example.com/logo.png" }), /logoUrl/);
});

test("confirmation accepts an inline logo CID and keeps the text fallback", () => {
  const fallback = buildBookingConfirmationEmail({ ...base, cinemaNumber: 1 });
  assert.match(fallback.html, /<span[^>]*>FILMVAULT<\/span>/);
  const inline = buildBookingConfirmationEmail({ ...base, cinemaNumber: 1,
    logoImageCid: "filmvault-logo@filmvault.invalid" });
  assert.match(inline.html, /src="cid:filmvault-logo@filmvault\.invalid"/);
  assert.doesNotMatch(inline.text, /cid:/);
  assert.throws(() => buildBookingConfirmationEmail({ ...base, cinemaNumber: 1,
    logoImageCid: 'bad" onerror="alert(1)' }), /logoImageCid/);
});

test("cancellation confirms cancellation without suggesting a refund", () => {
  const email = buildBookingCancellationEmail(base);
  assert.match(email.subject, /booking cancelled.*FV-ABCD2345/);
  for (const value of ["Original showtime", "Cancelled seats", "A1, A2", "FV-ABCD2345", "cancelled"]) {
    assert.ok(email.html.includes(value));
    assert.ok(email.text.includes(value));
  }
  assert.doesNotMatch(email.html, /refund/i);
  assert.doesNotMatch(email.text, /refund/i);
});

test("cancellation includes only an explicitly supplied refund note", () => {
  const email = buildBookingCancellationEmail({ ...base, refundNote: "Refund confirmed by the cinema team." });
  assert.match(email.text, /Refund confirmed by the cinema team/);
});

test("reschedule shows previous and updated times and cinema without seat promises", () => {
  const email = buildShowtimeRescheduleEmail({
    referenceCode: base.referenceCode,
    movieTitle: base.movieTitle,
    previous: { date: "2026-12-05", time: "18:30", branchName: "Example Branch", cinemaNumber: 1 },
    updated: { date: "2026-12-06", time: "20:15", branchName: "Example Branch", cinemaNumber: 2 },
  });
  assert.match(email.subject, /showtime changed.*FV-ABCD2345/);
  for (const value of ["Previous showtime", "Updated showtime", "December 5, 2026", "December 6, 2026", "6:30 PM", "8:15 PM", "Cinema 1", "Cinema 2", "current seat assignment"]) {
    assert.ok(email.html.includes(value));
    assert.ok(email.text.includes(value));
  }
  assert.doesNotMatch(email.text, /seats remain valid/i);
});

test("reschedule handles omitted optional cinema and customer fields", () => {
  const email = buildShowtimeRescheduleEmail({
    referenceCode: base.referenceCode,
    movieTitle: base.movieTitle,
    previous: { date: "2026-12-05", time: "18:30" },
    updated: { date: "2026-12-06", time: "19:00" },
  });
  assert.doesNotMatch(email.html, /Previous cinema|Updated cinema|undefined|null/);
  assert.match(email.text, /Hello,/);
});

test("reschedule can show existing seats without claiming they remain valid", () => {
  const email = buildShowtimeRescheduleEmail({
    referenceCode: base.referenceCode,
    movieTitle: base.movieTitle,
    seats: ["A1", "A2"],
    previous: { date: "2026-12-05", time: "18:30", cinemaNumber: 1 },
    updated: { date: "2026-12-06", time: "19:00", cinemaNumber: 2 },
  });
  assert.match(email.text, /Previously selected seats: A1, A2/);
  assert.match(email.html, /Previously selected seats/);
  assert.match(email.text, /check your booking details for your current seat assignment/i);
  assert.doesNotMatch(email.text, /seats remain valid/i);
});

test("dynamic HTML is escaped in every template", () => {
  const attack = '<img src=x onerror="alert(1)">&';
  const confirmation = buildBookingConfirmationEmail({ ...base, movieTitle: attack, cinemaNumber: 1 });
  const cancellation = buildBookingCancellationEmail({ ...base, movieTitle: attack });
  const reschedule = buildShowtimeRescheduleEmail({
    referenceCode: base.referenceCode,
    movieTitle: attack,
    previous: { date: "2026-12-05", time: "18:30" },
    updated: { date: "2026-12-06", time: "19:00" },
  });
  for (const email of [confirmation, cancellation, reschedule]) {
    assert.match(email.html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;&amp;/);
    assert.doesNotMatch(email.html, /<img src=x/);
    assert.ok(email.text.includes(attack));
  }
});

test("required data and malformed dates, times, amounts, and links are rejected", () => {
  assert.throws(() => buildBookingConfirmationEmail({ ...base, cinemaNumber: 1, movieTitle: "" }), /movieTitle/);
  assert.throws(() => buildBookingConfirmationEmail({ ...base }), /cinemaNumber/);
  assert.throws(() => buildBookingConfirmationEmail({ ...base, cinemaNumber: -1 }), /cinemaNumber/);
  assert.throws(() => buildBookingCancellationEmail({ ...base, seats: [] }), /seats/);
  assert.throws(() => buildBookingConfirmationEmail({ ...base, cinemaNumber: 1, showDate: "2026-02-30" }), /showDate/);
  assert.throws(() => buildBookingConfirmationEmail({ ...base, cinemaNumber: 1, showTime: "25:00" }), /showTime/);
  assert.throws(() => buildBookingConfirmationEmail({ ...base, cinemaNumber: 1, amountPaid: -1 }), /amountPaid/);
  assert.throws(() => buildBookingConfirmationEmail({ ...base, cinemaNumber: 1, ticketUrl: "javascript:alert(1)" }), /ticketUrl/);
  assert.throws(() => buildBookingCancellationEmail({ ...base, referenceCode: "FV-ABCD\r\nBcc: x" }), /referenceCode/);
  assert.throws(() => buildShowtimeRescheduleEmail({ referenceCode: base.referenceCode, movieTitle: base.movieTitle }), /previous and updated/);
});

test("date-only and TIME values retain the intended Philippine wall-clock schedule", () => {
  const email = buildShowtimeRescheduleEmail({
    referenceCode: base.referenceCode,
    movieTitle: base.movieTitle,
    previous: { date: "2026-12-31", time: "23:30:00" },
    updated: { date: "2027-01-01", time: "00:30:00" },
  });
  assert.match(email.text, /December 31, 2026 at 11:30 PM \(PHT\)/);
  assert.match(email.text, /January 1, 2027 at 12:30 AM \(PHT\)/);
  assert.doesNotMatch(email.text, /December 30|January 2/);
});

test("confirmation, cancellation, and reschedule preserve evening Philippine wall-clock times", () => {
  const confirmation = buildBookingConfirmationEmail({ ...base, cinemaNumber: 2 });
  const cancellation = buildBookingCancellationEmail(base);
  const reschedule = buildShowtimeRescheduleEmail({
    referenceCode: base.referenceCode,
    movieTitle: base.movieTitle,
    previous: { date: "2026-12-05", time: "18:30:00" },
    updated: { date: "2026-12-06", time: "19:00:00" },
  });
  for (const email of [confirmation, cancellation, reschedule]) {
    assert.match(email.text, /December 5, 2026/);
    assert.match(email.text, /6:30 PM \(PHT\)/);
    assert.match(email.html, /6:30 PM \(PHT\)/);
    assert.doesNotMatch(email.text, /2:30 AM|3:00 AM/);
  }
  assert.match(reschedule.text, /December 6, 2026 at 7:00 PM \(PHT\)/);
  assert.match(reschedule.html, /December 6, 2026 at 7:00 PM \(PHT\)/);
});

test("midnight wall-clock values keep their original dates in all three notices", () => {
  const midnight = { ...base, showDate: "2027-01-01", showTime: "00:30:00" };
  const confirmation = buildBookingConfirmationEmail({ ...midnight, cinemaNumber: 2 });
  const cancellation = buildBookingCancellationEmail(midnight);
  const reschedule = buildShowtimeRescheduleEmail({
    referenceCode: base.referenceCode,
    movieTitle: base.movieTitle,
    previous: { date: "2026-12-31", time: "23:30:00" },
    updated: { date: "2027-01-01", time: "00:30:00" },
  });
  for (const email of [confirmation, cancellation, reschedule]) {
    assert.match(email.text, /January 1, 2027/);
    assert.match(email.text, /12:30 AM \(PHT\)/);
    assert.doesNotMatch(email.text, /January 2, 2027/);
  }
  assert.match(reschedule.text, /December 31, 2026 at 11:30 PM \(PHT\)/);
});

test("a date and time change within one cinema displays the cinema once", () => {
  const email = buildShowtimeRescheduleEmail({
    referenceCode: base.referenceCode,
    movieTitle: base.movieTitle,
    previous: { date: "2026-12-05", time: "18:30", branchName: "Example Branch", cinemaNumber: 2 },
    updated: { date: "2026-12-06", time: "19:00", branchName: "Example Branch", cinemaNumber: 2 },
  });
  assert.match(email.text, /Cinema: Example Branch · Cinema 2/);
  assert.doesNotMatch(email.text, /Previous cinema|Updated cinema/);
  assert.match(email.text, /6:30 PM \(PHT\)/);
  assert.match(email.text, /7:00 PM \(PHT\)/);
});

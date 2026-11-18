// Pure email content builders. Keep this module free of browser APIs so the
// backend can reuse it once notification delivery is assigned and wired up.
// Dates are YYYY-MM-DD and times are 24-hour HH:mm or HH:mm:ss in Manila time.

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "UTC",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
})[character]);

function hasControlCharacter(value) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function requiredText(value, field) {
  if (typeof value !== "string" || !value.trim() || hasControlCharacter(value)) {
    throw new TypeError(`${field} must be non-empty text without control characters.`);
  }
  return value.trim();
}

function optionalText(value, field) {
  return value == null || value === "" ? null : requiredText(value, field);
}

function referenceCode(value) {
  const code = requiredText(value, "referenceCode");
  if (!/^[A-Za-z0-9-]{4,32}$/.test(code)) {
    throw new TypeError("referenceCode must contain only letters, numbers, and hyphens (4-32 characters).");
  }
  return code;
}

function formatDate(value, field) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(`${field} must be a YYYY-MM-DD date.`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) {
    throw new TypeError(`${field} must be a valid date.`);
  }
  return dateFormatter.format(date);
}

function formatTime(value, field) {
  if (typeof value !== "string" || !/^\d{2}:\d{2}(?::\d{2})?$/.test(value)) {
    throw new TypeError(`${field} must be an HH:mm or HH:mm:ss time.`);
  }
  const [hour, minute, second = 0] = value.split(":").map(Number);
  if (hour > 23 || minute > 59 || second > 59) {
    throw new TypeError(`${field} must be a valid time.`);
  }
  // TIME is a Philippine wall-clock value, not an instant to convert to PHT.
  // UTC here is only a stable formatting frame; timeFormatter also uses UTC.
  return timeFormatter.format(new Date(Date.UTC(2020, 0, 1, hour, minute)));
}

function showtime(date, time, prefix) {
  return `${formatDate(date, `${prefix}Date`)} at ${formatTime(time, `${prefix}Time`)} (PHT)`;
}

function seats(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("seats must be a non-empty array.");
  }
  return value.map((seat, index) => requiredText(seat, `seats[${index}]`)).join(", ");
}

function ticketTypes(value) {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length === 0) {
    throw new TypeError("ticketTypes must be a non-empty array when provided.");
  }
  return value.map((type, index) => requiredText(type, `ticketTypes[${index}]`)).join(", ");
}

function amountPaid(value) {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError("amountPaid must be a non-negative number when provided.");
  }
  return pesoFormatter.format(value);
}

function positiveCount(value, field) {
  if (!Number.isInteger(value) || value < 1) throw new TypeError(`${field} must be a positive integer.`);
  return value;
}

function requiredAmount(value, field) {
  if (value == null) throw new TypeError(`${field} is required.`);
  return amountPaid(value);
}

function bookedAt(value) {
  if (value == null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    throw new TypeError("bookedAt must be a YYYY-MM-DD HH:mm:ss value.");
  }
  const [date, time] = value.split(" ");
  return showtime(date, time, "bookedAt");
}

function ticketLines(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError("ticketItems must be an array.");
  return value.map((item, index) => ({
    label: `Seat ${requiredText(item?.seat, `ticketItems[${index}].seat`)} · ${requiredText(item?.type, `ticketItems[${index}].type`)}`,
    value: requiredAmount(item?.price, `ticketItems[${index}].price`),
  }));
}

function snackLines(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError("snackItems must be an array.");
  return value.map((item, index) => ({
    label: `${requiredText(item?.name, `snackItems[${index}].name`)} × ${positiveCount(item?.quantity, `snackItems[${index}].quantity`)}`,
    value: requiredAmount(item?.subtotal, `snackItems[${index}].subtotal`),
  }));
}

function cinemaNumber(value, field, required = false) {
  if (value == null || value === "") {
    if (required) throw new TypeError(`${field} is required.`);
    return null;
  }
  const number = String(value);
  if (!/^[1-9]\d*$/.test(number)) {
    throw new TypeError(`${field} must be a positive cinema number.`);
  }
  return number;
}

function secureUrl(value, field) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || hasControlCharacter(value)) {
    throw new TypeError(`${field} must be a secure URL.`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${field} must be a secure URL.`);
  }
  if (url.protocol !== "https:" || url.username || url.password ||
      url.hostname === "localhost" || url.hostname.endsWith(".localhost") ||
      /^127\./.test(url.hostname) || url.hostname === "[::1]") {
    throw new TypeError(`${field} must be an HTTPS URL without credentials.`);
  }
  return url.href;
}

function greeting(name) {
  return name ? `Hello ${name},` : "Hello,";
}

const notificationStyles = {
  confirmed: { label: "Confirmed", color: "#7be0b3", background: "#203d32" },
  cancelled: { label: "Cancelled", color: "#f3a0a3", background: "#44282b" },
  rescheduled: { label: "Schedule changed", color: "#ffffff", background: "#2a2a2a" },
};

function detailCell({ label, value }, paired = false, compact = false, light = false) {
  const emphasis = label === "Amount paid" ? "font-size:18px;font-weight:700;" : "font-size:14px;font-weight:600;";
  const changed = label === "Updated showtime" ? "border-left:3px solid #ee112b;padding-left:12px;" : "";
  return `<td ${paired ? 'width="50%"' : 'colspan="2"'} valign="top" style="${paired ? "width:50%;" : ""}padding:${compact ? "7px" : "12px"} 8px ${compact ? "7px" : "12px"} 0;${compact ? "" : "border-bottom:1px solid #2c2c2c;"}vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere;">
    <p style="margin:0 0 3px;${changed}color:${light ? "#666666" : "#b3b3b3"};font-size:11px;letter-spacing:0.05em;line-height:1.5;text-transform:uppercase;">${escapeHtml(label)}</p>
    <p style="margin:0;${changed}color:${light ? "#191919" : "#ffffff"};${emphasis}line-height:1.5;word-wrap:break-word;overflow-wrap:anywhere;">${escapeHtml(value)}</p>
  </td>`;
}

function renderDetails(rows, compact = false, light = false) {
  const lines = [];
  for (let i = 0; i < rows.length; i += 1) {
    const current = rows[i];
    const next = rows[i + 1];
    const paired = ((current.label === "Branch" || current.label === "Cinema branch") && next?.label === "Cinema")
      || (current.label === "Date" && next?.label === "Time");
    if (paired) {
      lines.push(`<tr>${detailCell(current, true, compact, light)}${detailCell(next, true, compact, light)}</tr>`);
      i += 1;
    } else {
      lines.push(`<tr>${detailCell(current, false, compact, light)}</tr>`);
    }
  }
  return lines.join("");
}

function renderConfirmationSections(ticketRows, paymentRows) {
  const ticketHtml = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${renderDetails(ticketRows, true, true)}</table>`;
  if (paymentRows.length === 0) return ticketHtml;
  const paymentHtml = paymentRows.map(({ label, value }) => {
    const total = label === "Amount paid";
    return `<tr><td valign="top" style="padding:${total ? "12px" : "6px"} 8px ${total ? "4px" : "6px"} 0;${total ? "border-top:1px solid #d0d0d0;" : ""}color:${total ? "#191919" : "#444444"};font-size:${total ? "15px" : "13px"};font-weight:${total ? "700" : "400"};line-height:1.5;word-wrap:break-word;">${total ? "Total" : escapeHtml(label)}</td>
      <td align="right" valign="top" style="padding:${total ? "12px" : "6px"} 0 ${total ? "4px" : "6px"} 8px;${total ? "border-top:1px solid #d0d0d0;" : ""}color:#191919;font-size:${total ? "19px" : "13px"};font-weight:${total ? "700" : "600"};line-height:1.5;text-align:right;word-wrap:break-word;overflow-wrap:anywhere;">${escapeHtml(value)}</td></tr>`;
  }).join("");
  return `${ticketHtml}<p style="margin:20px 0 6px;border-top:1px solid #d0d0d0;padding-top:14px;color:#191919;font-size:0;line-height:0;">&nbsp;</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${paymentHtml}</table>`;
}

function renderEmail({ subject, heading, intro, rows, note, link, qrCid, poster, logo, status,
  logoCid, detailHtml, movieMeta, ticketFooterRows = [], ticketCard = false, showStatus = true }) {
  const reference = rows.find(({ label }) => label === "Booking reference")?.value;
  const movie = rows.find(({ label }) => label === "Movie")?.value;
  const detailRows = detailHtml ?? renderDetails(rows.filter(({ label }) => label !== "Booking reference" && label !== "Movie"));
  const notification = notificationStyles[status];
  // The Home page's 330x111 logo can be supplied as a public HTTPS image.
  // Without one, use the Navbar's 24px/800 red wordmark as an email-safe fallback.
  const brandHtml = logoCid
    ? `<img src="cid:${escapeHtml(logoCid)}" alt="FILMVAULT" width="110" height="37" style="display:block;margin:0 auto;width:110px;max-width:100%;height:auto;border:0;color:#ee112b;font-size:24px;font-weight:800;line-height:1.2;">`
    : logo
    ? `<img src="${escapeHtml(logo)}" alt="FILMVAULT" width="${ticketCard ? "110" : "220"}" height="${ticketCard ? "37" : "74"}" style="display:block;${ticketCard ? "margin:0 auto;" : ""}width:${ticketCard ? "110" : "220"}px;max-width:100%;height:auto;border:0;color:#ee112b;font-size:24px;font-weight:800;line-height:1.2;">`
    : `<span style="color:#ee112b;font-size:24px;font-weight:800;line-height:1.2;">FILMVAULT</span>`;
  const posterHtml = poster ? `<td width="90" valign="top" style="width:90px;padding:0 16px 0 0;vertical-align:top;"><img src="${escapeHtml(poster)}" alt="${escapeHtml(movie)} poster" width="90" height="135" style="display:block;width:90px;height:135px;border:0;border-radius:6px;object-fit:cover;background:${ticketCard ? "#eeeeee" : "#2a2a2a"};"></td>` : "";
  const qrHtml = qrCid ? `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr><td style="padding:6px;background:#ffffff;"><img src="cid:${escapeHtml(qrCid)}" alt="QR code to verify booking ${escapeHtml(reference)}" width="120" height="120" style="display:block;width:120px;height:120px;border:0;background:#ffffff;"></td></tr>
    <tr><td align="center" style="padding:6px 0 0;color:${ticketCard ? "#666666" : "#b3b3b3"};font-size:10px;font-weight:600;letter-spacing:0.08em;line-height:1.5;text-align:center;text-transform:uppercase;">Scan to verify ticket</td></tr>
  </table>` : "";
  const ticketFooterHtml = ticketCard && (ticketFooterRows.length || qrHtml)
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0 0;border-collapse:collapse;">
        <tr><td valign="bottom" style="padding:0 12px 0 0;color:#666666;font-size:12px;line-height:1.6;vertical-align:bottom;word-wrap:break-word;overflow-wrap:anywhere;">${ticketFooterRows.map(({ value }) => escapeHtml(value)).join("<br>")}</td>
        ${qrHtml ? `<td width="132" align="right" valign="bottom" style="width:132px;vertical-align:bottom;text-align:right;">${qrHtml}</td>` : ""}</tr>
      </table>` : "";
  const linkHtml = link ? `<p style="margin:18px 0 0;"><a href="${escapeHtml(link)}" style="color:#ee112b;font-size:14px;font-weight:600;line-height:1.5;text-decoration:underline;">${qrCid ? "Verify your ticket" : "View your ticket"}</a></p>` : "";
  const noteHtml = note ? `<p style="margin:20px 0 0;padding:12px 16px;border-left:3px solid #ee112b;background:#2a2a2a;color:#ffffff;font-size:13px;line-height:1.6;">${escapeHtml(note)}</p>` : "";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${ticketCard ? "#ffffff" : "#191919"};color:${ticketCard ? "#191919" : "#ffffff"};font-family:Poppins,Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:${ticketCard ? "#ffffff" : "#191919"};">
    <tr><td align="center" style="padding:20px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;border-collapse:collapse;">
        <tr><td align="${ticketCard ? "center" : "left"}" style="padding:4px 4px 16px;text-align:${ticketCard ? "center" : "left"};">${brandHtml}</td></tr>
        <tr><td style="padding:0 4px 18px;">
          <h1 style="margin:0 0 6px;color:${ticketCard ? "#191919" : "#ffffff"};font-size:24px;font-weight:700;line-height:1.3;">${escapeHtml(heading)}</h1>
          <p style="margin:0;color:${ticketCard ? "#666666" : "#b3b3b3"};font-size:14px;line-height:1.6;">${escapeHtml(intro)}</p>
        </td></tr>
        <tr><td style="padding:0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid ${ticketCard ? "#c8c8c8" : "#2c2c2c"};border-radius:12px;border-collapse:separate;background:${ticketCard ? "#ffffff" : "#0f0f0f"};">
            <tr><td style="padding:${ticketCard ? "24px" : "20px"};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
                <tr>${posterHtml}<td valign="top" style="vertical-align:top;word-wrap:break-word;overflow-wrap:anywhere;">
                  ${showStatus ? `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${ticketCard ? "#e2f5ec" : notification.background};color:${ticketCard ? "#178654" : notification.color};font-size:11px;font-weight:600;letter-spacing:0.03em;line-height:1.5;text-transform:uppercase;">${notification.label}</span>` : ""}
                  <h2 style="margin:${showStatus ? "8px" : "0"} 0 0;color:${ticketCard ? "#191919" : "#ffffff"};font-size:20px;font-weight:700;line-height:1.35;word-wrap:break-word;overflow-wrap:anywhere;">${escapeHtml(movie)}</h2>
                  ${movieMeta ? `<p style="margin:4px 0 0;color:${ticketCard ? "#666666" : "#b3b3b3"};font-size:13px;line-height:1.5;">${escapeHtml(movieMeta)}</p>` : ""}
                </td></tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border:1px dashed ${ticketCard ? "#c8c8c8" : "#2c2c2c"};border-radius:8px;border-collapse:separate;">
                <tr><td align="center" style="padding:10px 14px;text-align:center;word-wrap:break-word;overflow-wrap:anywhere;">
                  <p style="margin:0;color:${ticketCard ? "#666666" : "#b3b3b3"};font-size:12px;letter-spacing:0.06em;line-height:1.5;text-transform:uppercase;">${ticketCard ? "Reference code" : "Booking reference"}</p>
                  <p style="margin:4px 0 0;color:${ticketCard ? "#191919" : "#ffffff"};font-size:23px;font-weight:700;letter-spacing:0.08em;line-height:1.4;word-wrap:break-word;overflow-wrap:anywhere;">${escapeHtml(reference)}</p>
                </td></tr>
              </table>
              ${detailHtml ? detailRows : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">${detailRows}</table>`}
              ${ticketFooterHtml}${noteHtml}${ticketCard ? "" : qrHtml}${linkHtml}
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 4px;color:${ticketCard ? "#666666" : "#b3b3b3"};font-size:12px;line-height:1.6;">FilmVault · Please keep your booking reference for your records.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  const text = [
    "FilmVault",
    heading,
    "",
    intro,
    "",
    ...rows.map(({ label, value }) => `${label}: ${value}`),
    ...(note ? ["", note] : []),
    ...(link ? ["", `View your ticket: ${link}`] : []),
    "",
    "FilmVault · Please keep your booking reference for your records.",
  ].join("\n");
  return { subject, html, text };
}

// Inputs are notification facts, not raw request bodies. A future backend
// caller must derive these facts and the recipient from trusted DB records.
// posterUrl and logoUrl are optional absolute HTTPS image URLs. The backend
// must host the logo publicly or attach it inline before real email delivery.
export function buildBookingConfirmationEmail(data) {
  const code = referenceCode(data?.referenceCode);
  const name = optionalText(data.customerName, "customerName");
  const movie = requiredText(data.movieTitle, "movieTitle");
  const rating = optionalText(data.movieRating, "movieRating");
  const runtime = data.runtimeMinutes == null ? null : positiveCount(data.runtimeMinutes, "runtimeMinutes");
  const ticketRows = [];
  if (rating || runtime) ticketRows.push({ label: "Movie rating & runtime", value: [rating, runtime && `${runtime} min`].filter(Boolean).join(" · ") });
  ticketRows.push(
    { label: "Branch", value: requiredText(data.branchName, "branchName") },
    { label: "Cinema", value: `Cinema ${cinemaNumber(data.cinemaNumber, "cinemaNumber", true)}` },
    { label: "Date", value: formatDate(data.showDate, "showDate") },
    { label: "Time", value: `${formatTime(data.showTime, "showTime")} (PHT)` },
    { label: "Seats", value: seats(data.seats) },
  );
  const types = ticketTypes(data.ticketTypes);
  const pricedTickets = ticketLines(data.ticketItems);
  if (types && pricedTickets.length === 0) ticketRows.push({ label: "Ticket types", value: types });
  const paymentRows = [...pricedTickets, ...snackLines(data.snackItems)];
  const fee = amountPaid(data.bookingFee);
  if (fee) paymentRows.push({ label: "Booking fee", value: fee });
  const ticketFooterRows = [];
  const payment = optionalText(data.paymentMethod, "paymentMethod");
  if (payment) ticketFooterRows.push({ label: "Payment", value: `Paid via ${payment}` });
  const discount = optionalText(data.discountNote, "discountNote");
  if (discount) ticketFooterRows.push({ label: "Discount", value: discount });
  const purchaseTime = bookedAt(data.bookedAt);
  if (purchaseTime) ticketFooterRows.push({ label: "Booked on", value: `Booked on ${purchaseTime}` });
  const paid = amountPaid(data.amountPaid);
  if (paid) paymentRows.push({ label: "Amount paid", value: paid });
  const link = secureUrl(data.ticketUrl, "ticketUrl");
  const qrCid = data.qrImageCid == null ? null : requiredText(data.qrImageCid, "qrImageCid");
  if (qrCid && (!link || !/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(qrCid))) {
    throw new TypeError("qrImageCid requires a valid ticketUrl and CID.");
  }
  const logoCid = data.logoImageCid == null ? null : requiredText(data.logoImageCid, "logoImageCid");
  if (logoCid && !/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(logoCid)) {
    throw new TypeError("logoImageCid must be a valid CID.");
  }
  const rows = [{ label: "Booking reference", value: code }, { label: "Movie", value: movie }, ...ticketRows, ...paymentRows,
    ...ticketFooterRows.map(({ label, value }) => ({ label, value: label === "Booked on" ? purchaseTime : value }))];
  return renderEmail({
    subject: `FilmVault booking confirmed · ${code}`,
    heading: "Your booking is confirmed",
    intro: `${greeting(name)} your booking is confirmed. Your ticket details are below.`,
    rows,
    detailHtml: renderConfirmationSections(ticketRows.filter(({ label }) => label !== "Movie rating & runtime"), paymentRows),
    ticketFooterRows,
    movieMeta: [rating, runtime && `${runtime} min`].filter(Boolean).join(" · "),
    ticketCard: true,
    link,
    qrCid,
    poster: secureUrl(data.posterUrl, "posterUrl"),
    logo: secureUrl(data.logoUrl, "logoUrl"),
    logoCid,
    status: "confirmed",
    showStatus: true,
  });
}

export function buildBookingCancellationEmail(data) {
  const code = referenceCode(data?.referenceCode);
  const name = optionalText(data.customerName, "customerName");
  const rows = [
    { label: "Booking reference", value: code },
    { label: "Movie", value: requiredText(data.movieTitle, "movieTitle") },
    { label: "Cinema branch", value: requiredText(data.branchName, "branchName") },
    { label: "Original showtime", value: showtime(data.showDate, data.showTime, "show") },
    { label: "Cancelled seats", value: seats(data.seats) },
  ];
  const refundNote = optionalText(data.refundNote, "refundNote");
  return renderEmail({
    subject: `FilmVault booking cancelled · ${code}`,
    heading: "Your booking was cancelled",
    intro: `${greeting(name)} your booking cancellation is confirmed. The booking details are below.`,
    rows,
    note: refundNote,
    poster: secureUrl(data.posterUrl, "posterUrl"),
    logo: secureUrl(data.logoUrl, "logoUrl"),
    status: "cancelled",
  });
}

export function buildShowtimeRescheduleEmail(data) {
  const code = referenceCode(data?.referenceCode);
  const name = optionalText(data.customerName, "customerName");
  const previous = data.previous;
  const updated = data.updated;
  if (!previous || !updated) throw new TypeError("previous and updated showtimes are required.");
  const previousBranch = optionalText(previous.branchName, "previous.branchName");
  const updatedBranch = optionalText(updated.branchName, "updated.branchName");
  const previousCinema = cinemaNumber(previous.cinemaNumber, "previous.cinemaNumber");
  const updatedCinema = cinemaNumber(updated.cinemaNumber, "updated.cinemaNumber");
  const rows = [
    { label: "Booking reference", value: code },
    { label: "Movie", value: requiredText(data.movieTitle, "movieTitle") },
    { label: "Previous showtime", value: showtime(previous.date, previous.time, "previous") },
    { label: "Updated showtime", value: showtime(updated.date, updated.time, "updated") },
  ];
  if (data.seats != null) rows.push({ label: "Previously selected seats", value: seats(data.seats) });
  const sameCinema = previousBranch === updatedBranch && previousCinema === updatedCinema &&
    (previousBranch || previousCinema);
  if (sameCinema) {
    rows.push({ label: "Cinema", value: [previousBranch, previousCinema && `Cinema ${previousCinema}`].filter(Boolean).join(" · ") });
  } else {
    if (previousBranch || previousCinema) rows.push({ label: "Previous cinema", value: [previousBranch, previousCinema && `Cinema ${previousCinema}`].filter(Boolean).join(" · ") });
    if (updatedBranch || updatedCinema) rows.push({ label: "Updated cinema", value: [updatedBranch, updatedCinema && `Cinema ${updatedCinema}`].filter(Boolean).join(" · ") });
  }
  const cinemaChanged = (previousBranch && updatedBranch && previousBranch !== updatedBranch)
    || (previousCinema && updatedCinema && previousCinema !== updatedCinema);
  return renderEmail({
    subject: `FilmVault showtime changed · ${code}`,
    heading: "Your showtime has changed",
    intro: `${greeting(name)} the schedule for your booking has changed. Please review the previous and updated details below.`,
    rows,
    note: cinemaChanged ? "The cinema has changed. Please check your booking details for your current seat assignment before your visit." : null,
    poster: secureUrl(data.posterUrl, "posterUrl"),
    logo: secureUrl(data.logoUrl, "logoUrl"),
    status: "rescheduled",
  });
}

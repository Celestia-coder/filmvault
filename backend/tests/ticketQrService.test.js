const test = require("node:test");
const assert = require("node:assert/strict");
const { createTicketQrService, publicAppOrigin, TOKEN_SQL, QR_CID } = require("../services/ticketQrService");
const { createBookingNotifier, BOOKING_NOTIFICATION_SQL, BOOKING_SNACKS_SQL } = require("../services/bookingNotificationService");
const { createEmailService } = require("../services/emailService");

const token = "0123456789abcdef0123456789abcdef";
const origin = "https://tickets.example.com";
const qrEnv = {
  EMAIL_TICKET_QR_ENABLED: "true",
  EMAIL_TICKET_QR_PRIVACY_APPROVED: "true",
  PUBLIC_APP_ORIGIN: origin,
};

test("QR is off by default and both explicit gates are required", async () => {
  let queries = 0;
  const db = { async query() { queries += 1; throw new Error("must not query"); } };
  for (const env of [{}, { ...qrEnv, EMAIL_TICKET_QR_ENABLED: "false" },
    { ...qrEnv, EMAIL_TICKET_QR_PRIVACY_APPROVED: "false" }]) {
    assert.equal(await createTicketQrService({ db, env }).prepareForPurchase(42), null);
  }
  assert.equal(queries, 0);
});

test("only a public HTTPS application origin without a path is accepted", () => {
  assert.equal(publicAppOrigin(`${origin}/`), origin);
  for (const value of [undefined, "", "http://tickets.example.com", "https://localhost",
    "https://localhost.", "https://127.0.0.1", "https://192.168.1.20",
    "https://tickets.example.com/verify", "https://tickets.example.com?x=1",
    "https://user:pass@tickets.example.com", "https://tickets.internal"]) {
    assert.equal(publicAppOrigin(value), null, String(value));
  }
});

test("the encoded payload uses Eli's stored token and /verify/:token format", async () => {
  const renders = [];
  const db = { async query(sql, params) {
    assert.equal(sql, TOKEN_SQL);
    assert.deepEqual(params, [42]);
    assert.match(sql, /status = 'confirmed' AND payment_status = 'paid'/);
    return [[{ verification_token: token }]];
  } };
  const service = createTicketQrService({ db, env: qrEnv,
    renderQr: async (url, options) => { renders.push({ url, options }); return Buffer.from("fake-png"); } });
  const prepared = await service.prepareForPurchase(42);
  assert.equal(prepared.ticketUrl, `${origin}/verify/${token}`);
  assert.equal(prepared.qrImageCid, QR_CID);
  assert.deepEqual(renders, [{ url: `${origin}/verify/${token}`,
    options: { type: "png", width: 512, margin: 1, errorCorrectionLevel: "M" } }]);
  assert.equal(prepared.attachment.cid, QR_CID);
  assert.equal(prepared.attachment.contentType, "image/png");
  assert.equal(prepared.attachment.contentDisposition, "inline");
});

test("the installed backend renderer produces a PNG without a browser", async () => {
  const db = { async query() { return [[{ verification_token: token }]]; } };
  const prepared = await createTicketQrService({ db, env: qrEnv }).prepareForPurchase(42);
  assert.ok(Buffer.isBuffer(prepared.attachment.content));
  assert.equal(prepared.attachment.content.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
});

test("missing migration, token, origin, or paid status omits QR without blocking confirmation", async () => {
  const logs = [];
  const missingColumn = { async query() { throw new Error("unknown private column detail"); } };
  const service = createTicketQrService({ db: missingColumn, env: qrEnv, log: (message) => logs.push(message) });
  assert.equal(await service.prepareForPurchase(42), null);
  assert.doesNotMatch(logs[0], /private|column detail|012345/);
  const db = { async query() { return [[]]; } }; // no confirmed, paid purchase
  assert.equal(await createTicketQrService({ db, env: qrEnv }).prepareForPurchase(42), null);
  for (const value of [null, "invalid", "A".repeat(32)]) {
    const badTokenDb = { async query() { return [[{ verification_token: value }]]; } };
    assert.equal(await createTicketQrService({ db: badTokenDb, env: qrEnv }).prepareForPurchase(42), null);
  }
  assert.equal(await createTicketQrService({ db: missingColumn, env: { ...qrEnv, PUBLIC_APP_ORIGIN: "http://localhost:5173" } }).prepareForPurchase(42), null);
});

test("a committed, paid booking renders one CID QR with matching trusted ticket details in fake SMTP", async () => {
  const reads = [];
  const row = { purchase_id: 42, reference_code: "FV-ABCD2345", status: "confirmed", payment_status: "paid",
    total_price: "400.00", payment_method: "gcash", discount_type: "none",
    purchased_at: "2026-11-15 14:20:00", user_id: 8, customer_name: "Fictional Customer",
    customer_email: "fictional@example.invalid", screening_id: 7, show_date: "2026-12-05",
    show_time: "18:30:00", movie_title: "A Fictional Film", age_rating: "PG", duration: 120,
    cinema_id: 5, cinema_num: 2, branch_id: 3, branch_name: "Example Branch" };
  const db = { async query(sql, params) {
    reads.push(sql);
    assert.deepEqual(params, [42]);
    if (sql === BOOKING_NOTIFICATION_SQL) return [[
      { ...row, row_num: 1, seat_num: 1, ticket_type: "Regular", ticket_price: "180.00" },
      { ...row, row_num: 1, seat_num: 2, ticket_type: "Senior", ticket_price: "160.00" },
    ]];
    if (sql === BOOKING_SNACKS_SQL) return [[{ name: "Popcorn", quantity: 1, subtotal: "50.00" }]];
    assert.equal(sql, TOKEN_SQL);
    return [[{ verification_token: token }]];
  } };
  const captured = [];
  const email = createEmailService({ env: { EMAIL_DELIVERY_ENABLED: "true", MAIL_FROM: "FilmVault <test@example.invalid>" },
    transport: { async sendMail(message) { captured.push(message); return { messageId: "fake" }; } } });
  const notifier = createBookingNotifier({ db, ticketQr: createTicketQrService({ db, env: qrEnv }),
    sendConfirmation: email.sendBookingConfirmation });
  const prepared = await notifier.prepare({ type: "confirmation", purchaseId: 42, committed: true,
    paymentVerified: true, customer: { verified: true, userId: 8 } });
  assert.equal(prepared.status, "ready");
  assert.deepEqual(reads, [BOOKING_NOTIFICATION_SQL, BOOKING_SNACKS_SQL, TOKEN_SQL]);
  assert.equal((await notifier.notify(prepared)).status, "sent");
  assert.equal((await notifier.notify(prepared)).status, "duplicate");
  assert.equal(captured.length, 1);
  const message = captured[0];
  assert.equal(message.to, row.customer_email);
  assert.equal(message.attachments.length, 1);
  assert.equal(message.attachments[0].cid, QR_CID);
  assert.equal(message.attachments[0].contentType, "image/png");
  assert.equal(message.attachments[0].contentDisposition, "inline");
  assert.equal(message.attachments[0].content.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(prepared.data.ticketUrl, `${origin}/verify/${token}`);
  assert.doesNotMatch(prepared.data.ticketUrl, /Fictional|FV-ABCD2345|gcash|400\.00/i);
  assert.match(message.html, new RegExp(`src="cid:${QR_CID.replace(".", "\\.")}"`));
  assert.match(message.html, /FV-ABCD2345|A1, A2|Example Branch|Cinema 2|6:30 PM|Regular|Senior|₱400\.00/);
  assert.match(message.text, new RegExp(`${origin}/verify/${token}`));
  assert.doesNotMatch(message.html, /localhost|<img[^>]+src="data:/);
});

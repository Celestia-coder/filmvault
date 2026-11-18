const test = require("node:test");
const assert = require("node:assert/strict");
const { createCreateBooking } = require("../controllers/customerBookingController");
const { createCancelBooking } = require("../controllers/bookingController");
const { createBookingNotifier, BOOKING_NOTIFICATION_SQL, BOOKING_SNACKS_SQL } = require("../services/bookingNotificationService");
const { createEmailService } = require("../services/emailService");

const customerAuth = { userId: 8, role: "customer", branchId: null };
const adminAuth = { userId: 9, role: "admin", branchId: 3 };

function response() {
  return { code: null, body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function purchaseRow({ status = "confirmed", email = "customer@example.invalid" } = {}) {
  return {
    purchase_id: 42, booking_id: 42, reference_code: "FV-TEST1234",
    booking_ref: "FV-TEST1234", status, payment_status: "paid", total_price: "380.00",
    payment_method: "gcash", discount_type: "none", purchased_at: "2026-11-15 14:20:00",
    purchase_datetime: "2026-11-15 14:20:00", user_id: 8, customer_name: "Sample Customer",
    customer_email: email, ticket_id: 51, ticket_price: "350.00", ticket_type: "Regular",
    screening_id: 7, showtime_id: 7, show_date: "2026-12-05", show_time: "18:30:00",
    movie_id: 2, movie_title: "A Fictional Film", title: "A Fictional Film",
    age_rating: "PG", duration: 125, cinema_id: 5, cinema_num: 2,
    branch_id: 3, branch_name: "Example Branch", row_num: 1, seat_num: 1, seats: "A1",
    ticket_types: "Regular", ticket_count: 1,
  };
}

function fakeDelivery(db, events, { failSend = false } = {}) {
  const messages = [];
  const email = createEmailService({ mailer: { enabled: true,
    async send(message) {
      events.push("fake_send");
      messages.push(message);
      return failSend ? { status: "failed", reason: "transport_error" } : { status: "sent" };
    },
  } });
  const notifier = createBookingNotifier({ db, log: () => {},
    sendConfirmation: email.sendBookingConfirmation, sendCancellation: email.sendCancellationNotice });
  return { notifier, messages };
}

function checkoutFixture({ paid = true, failCommit = false, failSend = false, email,
  accountEmail = "customer@example.invalid", ownerId = 8 } = {}) {
  const events = [];
  let committed = false;
  let referenceCode;
  const conn = {
    async beginTransaction() { events.push("begin"); },
    async commit() {
      if (failCommit) throw new Error("mock commit failed");
      committed = true; events.push("commit");
    },
    async rollback() { events.push("rollback"); },
    release() { events.push("release"); },
    async query(sql, params) {
      if (sql.includes("FROM SCREENING s JOIN MOVIE")) {
        assert.match(sql, /WHERE s\.screening_id = \? FOR UPDATE/);
        events.push("screening_lock");
        return [[{ screening_id: 7, cinema_id: 5, status: "scheduled", base_price: "350.00" }]];
      }
      if (sql.includes("SELECT user_id, email FROM `USER`")) return [[{ user_id: 8, email: accountEmail }]];
      if (sql.includes("FROM SEATBOOKING") && sql.includes("FOR UPDATE")) {
        return [[{ seat_id: 41, status: "held", held_by: 8, hold_active: 1 }]];
      }
      if (sql.includes("FROM SEAT WHERE")) return [[{ seat_id: 41, seat_status: "active" }]];
      if (sql.includes("SELECT t.seat_id FROM TICKET")) return [[]];
      if (sql.includes("FROM TICKET_TYPE")) return [[{ type_id: 1, type: "Regular", ticket_discount: 0 }]];
      if (sql.includes("INSERT INTO TOTAL_PURCHASE")) {
        referenceCode = params[3]; return [{ insertId: 42 }];
      }
      if (sql.includes("UPDATE SCREENING SET booked_seats")) return [{ affectedRows: 1 }];
      if (/^(DELETE|INSERT|UPDATE)/.test(sql.trim())) return [{ affectedRows: 1 }];
      throw new Error("Unexpected checkout query");
    },
  };
  const db = {
    async getConnection() { return conn; },
    async query(sql) {
      assert.equal(committed, true, "purchase data must be read after commit");
      events.push("read_committed_purchase");
      if (sql === BOOKING_NOTIFICATION_SQL) return [[{ ...purchaseRow({ email }), user_id: ownerId }]];
      if (sql === BOOKING_SNACKS_SQL || sql.includes("FROM SNACK_PURCHASE sp JOIN SNACK")) return [[]];
      if (sql.includes("WHERE p.purchase_id = ?")) return [[{ ...purchaseRow({ email }), reference_code: referenceCode }]];
      throw new Error("Unexpected post-commit query");
    },
  };
  const { notifier, messages } = fakeDelivery(db, events, { failSend });
  const handler = createCreateBooking({ db, paymentVerifier: { async verifyPayment() {
    events.push("verify_payment"); return { ok: paid };
  } }, notifier });
  const request = (auth = customerAuth) => ({
    body: { userId: 8, showtimeId: 7, seatIds: [41], paymentMethod: "gcash" }, auth,
  });
  return { events, messages, handler, request };
}

function cancellationFixture({ branchId = 3, purchaseBranchId = branchId, failCommit = false, email, failSend = false } = {}) {
  const events = [];
  let committed = false;
  const conn = {
    async beginTransaction() { events.push("begin"); },
    async commit() {
      if (failCommit) throw new Error("mock commit failed");
      committed = true; events.push("commit");
    },
    async rollback() { events.push("rollback"); },
    release() { events.push("release"); },
    async query(sql) {
      if (sql.includes("FROM TOTAL_PURCHASE WHERE purchase_id = ? FOR UPDATE")) return [[{ purchase_id: 42, status: "confirmed" }]];
      if (sql.includes("FROM TICKET t") && sql.includes("WHERE t.purchase_id = ?")) {
        return [[{ seat_id: 41, screening_id: 7, branch_id: branchId }]];
      }
      if (sql.trim().startsWith("UPDATE")) return [{ affectedRows: 1 }];
      throw new Error("Unexpected cancellation query");
    },
  };
  const db = {
    async getConnection() { return conn; },
    async query(sql) {
      assert.equal(committed, true, "cancellation data must be read after commit");
      events.push("read_committed_purchase");
      if (sql === BOOKING_NOTIFICATION_SQL) return [[{ ...purchaseRow({ status: "cancelled", email }), branch_id: purchaseBranchId }]];
      if (sql.includes("WHERE p.purchase_id = ?")) return [[purchaseRow({ status: "cancelled", email })]];
      throw new Error("Unexpected post-commit query");
    },
  };
  const { notifier, messages } = fakeDelivery(db, events, { failSend });
  const handler = createCancelBooking({ db, notifier });
  const request = (auth = adminAuth, queryBranch = branchId) => ({
    params: { id: "42" }, query: { branchId: queryBranch }, body: { status: "cancelled" }, auth,
  });
  return { events, messages, handler, request };
}

test("actual checkout handler sends one fake confirmation after paid commit and connection release", async () => {
  const f = checkoutFixture();
  const res = response();
  await f.handler(f.request(), res);
  assert.equal(res.code, 201);
  assert.equal(res.body.booking.reference_code.startsWith("FV-"), true);
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].to, "customer@example.invalid");
  assert.match(f.messages[0].subject, /booking confirmed/i);
  assert.match(f.messages[0].text, /FV-TEST1234/);
  assert.ok(f.events.indexOf("commit") < f.events.indexOf("release"));
  assert.ok(f.events.indexOf("screening_lock") < f.events.indexOf("verify_payment"));
  assert.ok(f.events.indexOf("release") < f.events.indexOf("read_committed_purchase"));
  assert.ok(f.events.indexOf("read_committed_purchase") < f.events.indexOf("fake_send"));
});

test("checkout uses the saved account recipient when the address matches or is omitted", async () => {
  for (const submittedEmail of ["customer@example.invalid", " CUSTOMER@example.invalid ", undefined]) {
    const f = checkoutFixture();
    const req = f.request();
    if (submittedEmail !== undefined) req.body.email = submittedEmail;
    const res = response();
    await f.handler(req, res);
    assert.equal(res.code, 201);
    assert.equal(f.messages.length, 1);
    assert.equal(f.messages[0].to, "customer@example.invalid");
    assert.ok(f.events.indexOf("commit") < f.events.indexOf("fake_send"));
  }
});

test("invalid or different checkout addresses fail before payment and mail", async () => {
  for (const submittedEmail of ["", "not-an-email", "bad\r\nBcc: x@example.invalid",
    ["customer@example.invalid"], "other@example.invalid"]) {
    const f = checkoutFixture();
    const req = f.request();
    req.body.email = submittedEmail;
    const res = response();
    await f.handler(req, res);
    assert.equal(res.code, 400);
    assert.equal(res.body.code, submittedEmail === "other@example.invalid" ? "EMAIL_MISMATCH" : "VALIDATION_ERROR");
    assert.equal(f.messages.length, 0);
    assert.ok(!f.events.includes("verify_payment"));
    assert.ok(!f.events.includes("commit"));
  }
});

test("checkout compares against the current database account address", async () => {
  const f = checkoutFixture({ accountEmail: "new-account@example.invalid" });
  const req = f.request();
  req.body.email = "customer@example.invalid";
  const res = response();
  await f.handler(req, res);
  assert.equal(res.code, 400);
  assert.equal(res.body.code, "EMAIL_MISMATCH");
  assert.equal(f.messages.length, 0);
  assert.ok(!f.events.includes("verify_payment"));
});

test("checkout rejects missing, mismatched, or browser-only identity before payment", async () => {
  for (const auth of [null, { userId: 9, role: "customer", branchId: null },
    { userId: 8, role: "admin", branchId: 3 },
    { userId: "8", role: "customer", branchId: null },
    { userId: 8, role: "customer" }]) {
    const f = checkoutFixture();
    const req = f.request(auth);
    req.body.role = "customer";
    req.body.auth = customerAuth;
    req.query = { userId: 8 };
    req.headers = { authorization: "unverified" };
    const res = response();
    await f.handler(req, res);
    assert.ok([401, 403].includes(res.code));
    assert.equal(f.messages.length, 0);
    assert.ok(!f.events.includes("verify_payment"));
  }
});

test("failed payment or failed checkout commit sends no confirmation", async () => {
  for (const options of [{ paid: false }, { failCommit: true }]) {
    const f = checkoutFixture(options);
    const res = response();
    const originalError = console.error;
    console.error = () => {};
    try { await f.handler(f.request(), res); }
    finally { console.error = originalError; }
    assert.notEqual(res.code, 201);
    assert.equal(f.messages.length, 0);
    assert.ok(f.events.includes("rollback"));
  }
});

test("invalid database recipient suppresses checkout mail without changing booking result", async () => {
  const f = checkoutFixture({ email: "bad\r\nBcc: x" });
  const res = response();
  await f.handler(f.request(), res);
  assert.equal(res.code, 201);
  assert.equal(f.messages.length, 0);
});

test("committed purchase ownership mismatch suppresses confirmation", async () => {
  const f = checkoutFixture({ ownerId: 9 });
  const res = response();
  await f.handler(f.request(), res);
  assert.equal(res.code, 201);
  assert.equal(f.messages.length, 0);
});

test("fake mail failure cannot roll back a committed checkout", async () => {
  const f = checkoutFixture({ failSend: true });
  const res = response();
  await f.handler(f.request(), res);
  assert.equal(res.code, 201);
  assert.equal(f.messages.length, 1);
  assert.ok(f.events.includes("commit"));
  assert.ok(!f.events.includes("rollback"));
});

test("actual cancellation handler sends one fake notice after commit and connection release", async () => {
  const f = cancellationFixture();
  const res = response();
  await f.handler(f.request(), res);
  assert.equal(res.code, 200);
  assert.equal(res.body.seatsReleased, 1);
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].to, "customer@example.invalid");
  assert.match(f.messages[0].subject, /booking cancelled/i);
  assert.ok(f.events.indexOf("commit") < f.events.indexOf("release"));
  assert.ok(f.events.indexOf("release") < f.events.indexOf("read_committed_purchase"));
  assert.ok(f.events.indexOf("read_committed_purchase") < f.events.indexOf("fake_send"));
});

test("cancellation rejects missing, wrong-role, and wrong-branch auth despite browser branch", async () => {
  for (const auth of [null, customerAuth, { ...adminAuth, branchId: 4 },
    { ...adminAuth, branchId: "3" }]) {
    const f = cancellationFixture();
    const req = f.request(auth);
    req.body.role = "admin";
    req.body.auth = adminAuth;
    const res = response();
    await f.handler(req, res);
    assert.ok([403, 404].includes(res.code));
    assert.equal(f.messages.length, 0);
  }
});

test("committed purchase branch mismatch and invalid recipient suppress cancellation mail", async () => {
  for (const options of [{ purchaseBranchId: 4 }, { email: "bad\r\nBcc: x" }]) {
    const f = cancellationFixture(options);
    const res = response();
    await f.handler(f.request(), res);
    assert.equal(res.code, 200);
    assert.equal(f.messages.length, 0);
  }
});

test("failed cancellation transaction or target in another branch sends no notice", async () => {
  const failed = cancellationFixture({ failCommit: true });
  const failedResponse = response();
  const originalError = console.error;
  console.error = () => {};
  try { await failed.handler(failed.request(), failedResponse); }
  finally { console.error = originalError; }
  assert.equal(failedResponse.code, 500);
  assert.equal(failed.messages.length, 0);
  assert.ok(failed.events.includes("rollback"));

  const scoped = cancellationFixture({ branchId: 4 });
  const scopedResponse = response();
  await scoped.handler(scoped.request(adminAuth, 4), scopedResponse);
  assert.equal(scopedResponse.code, 404);
  assert.equal(scoped.messages.length, 0);
});

test("fake mail failure cannot roll back a committed admin cancellation", async () => {
  const f = cancellationFixture({ failSend: true });
  const res = response();
  await f.handler(f.request(), res);
  assert.equal(res.code, 200);
  assert.equal(f.messages.length, 1);
  assert.ok(f.events.includes("commit"));
  assert.ok(!f.events.includes("rollback"));
});

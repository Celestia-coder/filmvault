const test = require("node:test");
const assert = require("node:assert/strict");
const { createRescheduleNotifier, AFFECTED_BOOKINGS_SQL } = require("../services/rescheduleNotificationService");
const { createUpdateShowtime } = require("../controllers/showtimeController");

const env = { EMAIL_DELIVERY_ENABLED: "true", RESCHEDULE_NOTIFICATIONS_ENABLED: "true" };
const previous = {
  showtime_id: 7, movie_id: 2, cinema_id: 5, cinema_num: 2, branch_id: 3,
  branch_name: "Example Branch", show_date: "2026-12-05", show_time: "18:30:00",
  total_seats: 100, booked_seats: 3, status: "scheduled",
};
const updated = { ...previous, show_date: "2026-12-06", show_time: "19:00:00" };
const admin = { verified: true, role: "admin", branchId: 3 };
const bookingRows = [
  { purchase_id: 10, reference_code: "FV-AAAA2222", customer_email: "one@example.invalid", customer_name: "One Example", movie_title: "A Fictional Film", row_num: 1, seat_num: 1 },
  { purchase_id: 10, reference_code: "FV-AAAA2222", customer_email: "one@example.invalid", customer_name: "One Example", movie_title: "A Fictional Film", row_num: 1, seat_num: 2 },
  { purchase_id: 11, reference_code: "FV-BBBB3333", customer_email: "two@example.invalid", customer_name: "Two Example", movie_title: "A Fictional Film", row_num: 2, seat_num: 3 },
];

function fakeDb(initialRows = bookingRows, current = previous, options = {}) {
  let rows = initialRows;
  let activeScreening = current;
  const events = [];
  let db;
  const connection = {
    async beginTransaction() { events.push("begin"); },
    async commit() { events.push("commit"); options.afterCommit?.(db); },
    async rollback() { events.push("rollback"); },
    release() {
      events.push("release");
      if (options.failRelease) throw new Error("mock release failed");
    },
    async query(sql, params) {
      if (sql.includes("FOR UPDATE")) return [[activeScreening]];
      if (sql.includes("FROM CINEMA c JOIN BRANCH")) {
        return [[{ cinema_id: 5, cinema_num: 2, branch_id: 3, branch_name: "Example Branch" }]];
      }
      if (sql.includes("screening_id != ?")) return [options.conflict ? [{ screening_id: 8 }] : []];
      if (sql === AFFECTED_BOOKINGS_SQL) {
        assert.deepEqual(params, [7, 3]);
        events.push("affected_read");
        if (options.failRead) throw new Error("mock recipient read failed");
        return [rows.map((row) => ({ ...row }))];
      }
      if (sql.includes("UPDATE SCREENING SET")) {
        if (options.failUpdate) throw new Error("mock update failed");
        events.push("update");
        return [{ affectedRows: 1 }];
      }
      throw new Error("Unexpected transaction query");
    },
  };
  db = {
    events, connection,
    setRows(next) { rows = next; },
    setCurrent(next) { activeScreening = next; },
    async getConnection() { return connection; },
    async query() { throw new Error("Recipient read must use the transaction connection"); },
  };
  return db;
}

const event = (db, overrides = {}) => ({
  connection: db.connection, eventId: "event-1", screeningId: 7,
  previous, updated, admin, ...overrides,
});

function fakeResponse() {
  return {
    code: null, body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const request = (verifiedAdmin = admin) => ({
  params: { id: "7" },
  body: { cinemaId: 5, showDate: "2026-12-06", showTime: "19:00" },
  authenticatedAdmin: verifiedAdmin,
});

test("recipient query is scoped to one screening, branch, confirmed and paid purchases", () => {
  assert.match(AFFECTED_BOOKINGS_SQL, /t\.screening_id = \? AND c\.branch_id = \?/);
  assert.match(AFFECTED_BOOKINGS_SQL, /p\.status = 'confirmed' AND p\.payment_status = 'paid'/);
  assert.match(AFFECTED_BOOKINGS_SQL, /u\.email AS customer_email/);
});

test("pre-change snapshot groups seats and sends one email per affected booking", async () => {
  const db = fakeDb();
  const requests = [];
  const notifier = createRescheduleNotifier({ env, send: async (data) => { requests.push(data); return { status: "sent" }; } });
  const prepared = await notifier.prepare(event(db));
  assert.equal(prepared.status, "ready");
  assert.equal(db.events[0], "affected_read");
  assert.equal((await notifier.notify({ prepared, committed: false })).status, "not_committed");
  assert.equal(requests.length, 0);
  const result = await notifier.notify({ prepared, committed: true });
  assert.equal(result.status, "sent");
  assert.equal(result.sent, 2);
  assert.deepEqual(requests[0].data.seats, ["A1", "A2"]);
  assert.deepEqual(requests[1].data.seats, ["B3"]);
  assert.equal(requests[0].data.previous.date, "2026-12-05");
  assert.equal(requests[0].data.previous.time, "18:30:00");
  assert.equal(requests[0].data.updated.time, "19:00:00");
});

test("two purchases by one customer remain two separate booking notices", async () => {
  const db = fakeDb([...bookingRows, { ...bookingRows[2], purchase_id: 12, reference_code: "FV-CCCC4444", customer_email: "one@example.invalid" }]);
  const sent = [];
  const notifier = createRescheduleNotifier({ env, send: async ({ to, data }) => { sent.push([to, data.referenceCode]); return { status: "sent" }; } });
  const prepared = await notifier.prepare(event(db));
  assert.equal((await notifier.notify({ prepared, committed: true })).sent, 3);
  assert.deepEqual(sent.filter(([to]) => to === "one@example.invalid").map(([, ref]) => ref), ["FV-AAAA2222", "FV-CCCC4444"]);
});

test("empty snapshot, unchanged schedule, and disabled delivery send nothing", async () => {
  const db = fakeDb([]);
  const notifier = createRescheduleNotifier({ env, send: () => { throw new Error("must not send"); } });
  const empty = await notifier.prepare(event(db));
  assert.equal((await notifier.notify({ prepared: empty, committed: true })).status, "no_recipients");
  assert.equal((await notifier.prepare(event(db, { updated: { ...previous, show_time: "18:30" } }))).status, "unchanged");
  const disabled = createRescheduleNotifier({ env: {}, send: () => { throw new Error("must not send"); } });
  assert.equal((await disabled.prepare(event(db))).status, "disabled");
  assert.deepEqual(db.events, ["affected_read"]);
});

test("unverified or wrong-branch admin and cinema moves never read recipients", async () => {
  const db = fakeDb();
  const notifier = createRescheduleNotifier({ env, send: () => { throw new Error("must not send"); } });
  assert.equal((await notifier.prepare(event(db, { admin: undefined }))).status, "unauthorized");
  assert.equal((await notifier.prepare(event(db, { admin: { ...admin, branchId: 9 } }))).status, "unauthorized");
  assert.equal((await notifier.prepare(event(db, { updated: { ...updated, cinema_id: 6, cinema_num: 3 } }))).status, "seat_revalidation_required");
  assert.equal((await notifier.prepare(event(db, { previous: { ...previous, status: "cancelled" } }))).status, "ineligible_screening");
  assert.deepEqual(db.events, []);
});

test("invalid address is skipped; duplicate event and failed send are not retried automatically", async () => {
  const db = fakeDb([{ ...bookingRows[0], customer_email: "bad\r\nBcc: x" }, bookingRows[2]]);
  const logs = [];
  let sends = 0;
  const notifier = createRescheduleNotifier({ env, log: (message) => logs.push(message), send: async () => { sends++; throw new Error("private SMTP detail"); } });
  const prepared = await notifier.prepare(event(db));
  const first = await notifier.notify({ prepared, committed: true });
  assert.deepEqual(first, { status: "partial_failure", sent: 0, failed: 1, skipped: 1 });
  assert.equal((await notifier.notify({ prepared, committed: true })).status, "duplicate");
  assert.equal(sends, 1);
  assert.match(logs[0], /1 booking/);
  assert.doesNotMatch(logs[0], /private|SMTP detail|example\.invalid/);
});

test("overlapping calls for one event attempt each purchase only once", async () => {
  const db = fakeDb();
  let finishSend;
  const sendGate = new Promise((resolve) => { finishSend = resolve; });
  const attempts = [];
  const notifier = createRescheduleNotifier({ env, send: async ({ data }) => {
    attempts.push(data.referenceCode);
    await sendGate;
    return { status: "sent" };
  } });
  const prepared = await notifier.prepare(event(db));

  const first = notifier.notify({ prepared, committed: true });
  const duplicate = await notifier.notify({ prepared, committed: true });
  finishSend();

  assert.equal(duplicate.status, "duplicate");
  assert.equal((await first).sent, 2);
  assert.deepEqual(attempts, ["FV-AAAA2222", "FV-BBBB3333"]);
});

test("a booking added after commit is absent from the pre-change snapshot", async () => {
  const db = fakeDb(bookingRows.slice(0, 2), previous, {
    afterCommit(database) { database.setRows(bookingRows); },
  });
  const recipients = [];
  const notifier = createRescheduleNotifier({ env, send: async ({ to }) => { recipients.push(to); return { status: "sent" }; } });
  const response = fakeResponse();
  await createUpdateShowtime({ db, notifier })(request(), response);
  assert.equal(response.code, 200);
  assert.deepEqual(recipients, ["one@example.invalid"]);
  assert.ok(db.events.indexOf("affected_read") < db.events.indexOf("commit"));
});

test("controller releases the database connection before mail; failure does not undo commit", async () => {
  const db = fakeDb();
  const logs = [];
  const notifier = createRescheduleNotifier({ env, log: (message) => logs.push(message), send: async () => {
    db.events.push("send");
    return { status: "failed", reason: "transport_error" };
  } });
  const response = fakeResponse();
  await createUpdateShowtime({ db, notifier })(request(), response);
  assert.equal(response.code, 200);
  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.notification, { status: "partial_failure", sent: 0, failed: 2, skipped: 0 });
  assert.deepEqual(db.events.slice(0, 5), ["begin", "affected_read", "update", "commit", "release"]);
  assert.ok(db.events.indexOf("release") < db.events.indexOf("send"));
  assert.ok(!db.events.includes("rollback"));
  assert.equal(logs.length, 1);
});

test("controller without verified admin still updates but never queries customer records", async () => {
  const db = fakeDb();
  const notifier = createRescheduleNotifier({ env, send: () => { throw new Error("must not send"); } });
  const response = fakeResponse();
  await createUpdateShowtime({ db, notifier })(request(null), response);
  assert.equal(response.code, 200);
  assert.equal(response.body.notification.status, "unauthorized");
  assert.ok(!db.events.includes("affected_read"));
});

test("unchanged controller request creates neither recipient query nor update", async () => {
  const db = fakeDb([], updated);
  let notifications = 0;
  const response = fakeResponse();
  await createUpdateShowtime({ db, notifier: { async prepare() { notifications++; }, async notify() { notifications++; } } })(request(), response);
  assert.equal(response.code, 200);
  assert.equal(response.body.notification.status, "unchanged");
  assert.equal(notifications, 0);
  assert.deepEqual(db.events, ["begin", "rollback", "release"]);
});

test("retrying a committed schedule request creates no second notification event", async () => {
  const db = fakeDb(bookingRows, previous, {
    afterCommit(database) { database.setCurrent(updated); },
  });
  const attempts = [];
  const notifier = createRescheduleNotifier({ env, send: async ({ data }) => {
    attempts.push(data.referenceCode);
    return { status: "sent" };
  } });
  const update = createUpdateShowtime({ db, notifier });
  const first = fakeResponse();
  const retry = fakeResponse();

  await update(request(), first);
  await update(request(), retry);

  assert.equal(first.body.notification.sent, 2);
  assert.equal(retry.body.notification.status, "unchanged");
  assert.deepEqual(attempts, ["FV-AAAA2222", "FV-BBBB3333"]);
  assert.equal(db.events.filter((entry) => entry === "affected_read").length, 1);
  assert.equal(db.events.filter((entry) => entry === "update").length, 1);
});

test("conflicting and failed updates roll back and never send", async () => {
  for (const options of [{ conflict: true }, { failUpdate: true }]) {
    const db = fakeDb(bookingRows, previous, options);
    let sends = 0;
    const notifier = createRescheduleNotifier({ env, send: async () => { sends++; return { status: "sent" }; } });
    const response = fakeResponse();
    const originalError = console.error;
    console.error = () => {};
    try { await createUpdateShowtime({ db, notifier })(request(), response); }
    finally { console.error = originalError; }
    assert.equal(response.code, options.conflict ? 409 : 500);
    assert.equal(sends, 0);
    assert.ok(db.events.includes("rollback"));
    assert.ok(!db.events.includes("commit"));
  }
});

test("recipient lookup failure is reported without cancelling a successful schedule update", async () => {
  const db = fakeDb(bookingRows, previous, { failRead: true });
  const notifier = createRescheduleNotifier({ env, send: () => { throw new Error("must not send"); } });
  const response = fakeResponse();
  const originalError = console.error;
  const logs = [];
  console.error = (message) => logs.push(message);
  try { await createUpdateShowtime({ db, notifier })(request(), response); }
  finally { console.error = originalError; }
  assert.equal(response.code, 200);
  assert.equal(response.body.notification.status, "preparation_failed");
  assert.ok(db.events.includes("commit"));
  assert.equal(logs.length, 1);
  assert.doesNotMatch(logs[0], /mock recipient|example\.invalid/);
});

test("connection release failure after commit does not turn a successful update into an error", async () => {
  const db = fakeDb([], previous, { failRelease: true });
  const notifier = createRescheduleNotifier({ env });
  const response = fakeResponse();
  const originalError = console.error;
  const logs = [];
  console.error = (message) => logs.push(message);
  try { await createUpdateShowtime({ db, notifier })(request(), response); }
  finally { console.error = originalError; }
  assert.equal(response.code, 200);
  assert.ok(db.events.includes("commit"));
  assert.match(logs[0], /release failed after commit/);
});

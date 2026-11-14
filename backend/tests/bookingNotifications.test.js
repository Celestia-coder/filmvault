const test = require("node:test");
const assert = require("node:assert/strict");
const { createEmailService } = require("../services/emailService");
const { createBookingNotifier, BOOKING_NOTIFICATION_SQL, BOOKING_SNACKS_SQL } = require("../services/bookingNotificationService");

const rows = [
  { purchase_id: 42, reference_code: "FV-TEST1234", status: "confirmed", payment_status: "paid",
    total_price: "840.00", payment_method: "gcash", discount_type: "mixed",
    purchased_at: "2026-11-15 14:20:00", ticket_price: "350.00",
    age_rating: "PG", duration: 125, user_id: 8, customer_name: "Sample Customer",
    customer_email: "customer@example.invalid", screening_id: 7, show_date: "2026-12-05",
    show_time: "18:30:00", movie_title: "A Fictional Film", cinema_id: 5, cinema_num: 2,
    branch_id: 3, branch_name: "Example Branch", row_num: 1, seat_num: 1, ticket_type: "Regular" },
  { purchase_id: 42, reference_code: "FV-TEST1234", status: "confirmed", payment_status: "paid",
    total_price: "840.00", payment_method: "gcash", discount_type: "mixed",
    purchased_at: "2026-11-15 14:20:00", ticket_price: "300.00",
    age_rating: "PG", duration: 125, user_id: 8, customer_name: "Sample Customer",
    customer_email: "customer@example.invalid", screening_id: 7, show_date: "2026-12-05",
    show_time: "18:30:00", movie_title: "A Fictional Film", cinema_id: 5, cinema_num: 2,
    branch_id: 3, branch_name: "Example Branch", row_num: 1, seat_num: 2, ticket_type: "Senior" },
];
const customer = { verified: true, userId: 8 };
const admin = { verified: true, role: "admin", branchId: 3 };

function fakeDb(data = rows, snacks = [{ name: "Popcorn", quantity: 2, subtotal: "100.00" }]) {
  const reads = [];
  return {
    reads,
    async query(sql, params) {
      if (sql === BOOKING_NOTIFICATION_SQL) {
        reads.push({ kind: "booking", params });
        return [data.map((row) => ({ ...row }))];
      }
      assert.equal(sql, BOOKING_SNACKS_SQL);
      reads.push({ kind: "snacks", params });
      return [snacks.map((row) => ({ ...row }))];
    },
  };
}

test("paid, committed booking uses trusted records and existing templates with fake transport", async () => {
  const delivered = [];
  const service = createEmailService({ mailer: {
    enabled: true,
    async send(message) { delivered.push(message); return { status: "sent" }; },
  } });
  const db = fakeDb();
  const notifier = createBookingNotifier({ db, sendConfirmation: service.sendBookingConfirmation });
  const prepared = await notifier.prepare({ type: "confirmation", purchaseId: 42,
    committed: true, paymentVerified: true, customer });
  assert.equal(prepared.status, "ready");
  assert.deepEqual(db.reads, [{ kind: "booking", params: [42] }, { kind: "snacks", params: [42] }]);
  assert.deepEqual(prepared.data.seats, ["A1", "A2"]);
  assert.deepEqual(prepared.data.ticketTypes, ["Regular", "Senior"]);
  assert.equal(prepared.data.amountPaid, 840);
  assert.deepEqual(prepared.data.ticketItems, [
    { seat: "A1", type: "Regular", price: 350 },
    { seat: "A2", type: "Senior", price: 300 },
  ]);
  assert.deepEqual(prepared.data.snackItems, [{ name: "Popcorn", quantity: 2, subtotal: 100 }]);
  assert.equal(prepared.data.bookingFee, 90);
  assert.equal(prepared.data.paymentMethod, "GCash");
  assert.equal(prepared.data.bookedAt, "2026-11-15 14:20:00");
  assert.equal(prepared.data.ticketUrl, undefined);
  assert.equal((await notifier.notify(prepared)).status, "sent");
  assert.equal((await notifier.notify(prepared)).status, "duplicate");
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].to, "customer@example.invalid");
  assert.match(delivered[0].subject, /FilmVault booking confirmed.*FV-TEST1234/);
  assert.match(delivered[0].html, /A1, A2/);
  assert.match(delivered[0].text, /FV-TEST1234/);
  for (const value of ["Seat A1 · Regular", "Seat A2 · Senior", "Popcorn × 2", "₱350.00", "₱300.00", "₱100.00", "Booking fee", "₱90.00", "Paid via GCash", "PG · 125 min", "November 15, 2026"]) {
    assert.ok(delivered[0].html.includes(value), `HTML missing ${value}`);
    assert.ok(delivered[0].text.includes(value), `text missing ${value}`);
  }
  assert.doesNotMatch(delivered[0].html, /\/verify\/|View your ticket/);
});

test("failed payment, uncommitted booking, and unverified customer cannot prepare mail", async () => {
  const db = fakeDb();
  const notifier = createBookingNotifier({ db });
  assert.equal((await notifier.prepare({ type: "confirmation", purchaseId: 42,
    committed: false, paymentVerified: true, customer })).status, "not_committed");
  assert.equal((await notifier.prepare({ type: "confirmation", purchaseId: 42,
    committed: true, paymentVerified: false, customer })).status, "unverified_event");
  assert.equal((await notifier.prepare({ type: "confirmation", purchaseId: 42,
    committed: true, paymentVerified: true, customer: { userId: 8 } })).status, "unverified_event");
  assert.deepEqual(db.reads, []);
  const unpaid = createBookingNotifier({ db: fakeDb(rows.map((row) => ({ ...row, payment_status: "pending" }))) });
  assert.equal((await unpaid.prepare({ type: "confirmation", purchaseId: 42,
    committed: true, paymentVerified: true, customer })).status, "ineligible_booking");
});

test("cancelled booking is prepared only for a verified admin of its branch", async () => {
  const cancelled = rows.map((row) => ({ ...row, status: "cancelled" }));
  const db = fakeDb(cancelled);
  const delivered = [];
  const service = createEmailService({ mailer: {
    enabled: true,
    async send(message) { delivered.push(message); return { status: "sent" }; },
  } });
  const notifier = createBookingNotifier({ db, sendCancellation: service.sendCancellationNotice });
  assert.equal((await notifier.prepare({ type: "cancellation", purchaseId: 42,
    committed: true, admin: { ...admin, branchId: 4 } })).status, "unauthorized");
  const prepared = await notifier.prepare({ type: "cancellation", purchaseId: 42,
    committed: true, admin });
  assert.equal(prepared.status, "ready");
  assert.equal((await notifier.notify(prepared)).status, "sent");
  assert.equal(delivered.length, 1);
  assert.match(delivered[0].subject, /FilmVault booking cancelled.*FV-TEST1234/);
  assert.match(delivered[0].text, /A1, A2/);
  assert.doesNotMatch(delivered[0].text, /refund/i);
  assert.doesNotMatch(delivered[0].text, /Popcorn|Booking fee|Paid via/);
});

test("no snacks and a zero booking fee render from committed purchase values", async () => {
  const records = rows.map((row) => ({ ...row, total_price: "650.00", discount_type: "none" }));
  const prepared = await createBookingNotifier({ db: fakeDb(records, []) }).prepare({
    type: "confirmation", purchaseId: 42, committed: true, paymentVerified: true, customer,
  });
  assert.equal(prepared.status, "ready");
  assert.deepEqual(prepared.data.snackItems, []);
  assert.equal(prepared.data.bookingFee, 0);
  assert.equal(prepared.data.discountNote, undefined);
});

test("inconsistent committed totals are not presented as a fabricated booking fee", async () => {
  const records = rows.map((row) => ({ ...row, total_price: "100.00" }));
  const prepared = await createBookingNotifier({ db: fakeDb(records) }).prepare({
    type: "confirmation", purchaseId: 42, committed: true, paymentVerified: true, customer,
  });
  assert.equal(prepared.status, "inconsistent_total");
});

test("unverified admin, active purchase, mixed branches, and invalid address do not send", async () => {
  const db = fakeDb();
  const notifier = createBookingNotifier({ db });
  assert.equal((await notifier.prepare({ type: "cancellation", purchaseId: 42,
    committed: true, admin: { branchId: 3 } })).status, "unauthorized");
  assert.deepEqual(db.reads, []);
  assert.equal((await notifier.prepare({ type: "cancellation", purchaseId: 42,
    committed: true, admin })).status, "ineligible_booking");
  const mixed = createBookingNotifier({ db: fakeDb([rows[0], { ...rows[1], branch_id: 4 }]) });
  assert.equal((await mixed.prepare({ type: "confirmation", purchaseId: 42,
    committed: true, paymentVerified: true, customer })).status, "mixed_screenings");
  const invalid = createBookingNotifier({ db: fakeDb(rows.map((row) => ({ ...row, customer_email: "bad\r\nBcc: x" }))) });
  assert.equal((await invalid.prepare({ type: "confirmation", purchaseId: 42,
    committed: true, paymentVerified: true, customer })).status, "invalid_recipient");
});

test("transport failure does not change the committed event or retry the purchase", async () => {
  const logs = [];
  let attempts = 0;
  const notifier = createBookingNotifier({ db: fakeDb(), log: (message) => logs.push(message),
    sendConfirmation: async () => { attempts += 1; throw new Error("private SMTP detail"); } });
  const prepared = await notifier.prepare({ type: "confirmation", purchaseId: 42,
    committed: true, paymentVerified: true, customer });
  assert.equal((await notifier.notify(prepared)).status, "failed");
  assert.equal((await notifier.notify(prepared)).status, "duplicate");
  assert.equal(attempts, 1);
  assert.doesNotMatch(logs[0], /private|SMTP detail|example\.invalid/);
});

test("default delivery remains disabled even for a valid prepared event", async () => {
  const service = createEmailService({ mailer: { enabled: false, send() { throw new Error("must not send"); } } });
  const notifier = createBookingNotifier({ db: fakeDb(), sendConfirmation: service.sendBookingConfirmation });
  const prepared = await notifier.prepare({ type: "confirmation", purchaseId: 42,
    committed: true, paymentVerified: true, customer });
  assert.equal((await notifier.notify(prepared)).status, "disabled");
});

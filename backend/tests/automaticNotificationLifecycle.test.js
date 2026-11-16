// Test-only event harness. The live booking/cancellation routes have no
// authenticated actor middleware, so this must never be mounted as an API.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createEmailService } = require("../services/emailService");
const { createBookingNotifier, BOOKING_NOTIFICATION_SQL, BOOKING_SNACKS_SQL } = require("../services/bookingNotificationService");

const customer = { verified: true, userId: 8 };
const admin = { verified: true, role: "admin", branchId: 3 };
const ticketRows = [1, 2].map((seat) => ({
  purchase_id: 42, reference_code: "FV-TEST1234", status: "confirmed", payment_status: "paid",
  total_price: "700.00", payment_method: "gcash", discount_type: "none",
  purchased_at: "2026-11-15 14:20:00", user_id: 8,
  customer_name: "Sample Customer", customer_email: "customer@example.invalid",
  screening_id: 7, ticket_price: "350.00", show_date: "2026-12-05",
  show_time: "18:30:00", movie_title: "A Fictional Film", age_rating: "PG", duration: 125,
  cinema_id: 5, cinema_num: 2, branch_id: 3, branch_name: "Example Branch",
  row_num: 1, seat_num: seat, ticket_type: "Regular",
}));

function fixture({ sendFailure = false } = {}) {
  const events = [];
  const messages = [];
  let committedRows = [];
  const db = {
    async query(sql, params) {
      assert.deepEqual(params, [42]);
      events.push("read_committed_purchase");
      if (sql === BOOKING_NOTIFICATION_SQL) return [committedRows.map((row) => ({ ...row }))];
      assert.equal(sql, BOOKING_SNACKS_SQL);
      return [[]];
    },
  };
  const mailer = { enabled: true, async send(message) {
    events.push("fake_send");
    messages.push(message);
    if (sendFailure) return { status: "failed", reason: "transport_error" };
    return { status: "sent" };
  } };
  const email = createEmailService({ mailer });
  const notifier = createBookingNotifier({
    db, log: () => {},
    sendConfirmation: email.sendBookingConfirmation,
    sendCancellation: email.sendCancellationNotice,
  });
  const transaction = {
    async begin() { events.push("begin"); },
    async commit(rows) { committedRows = rows; events.push("commit"); },
    async rollback() { events.push("rollback"); },
  };
  return { events, messages, notifier, transaction };
}

async function simulateConfirmedCheckout(context, { paymentOk = true, commitOk = true,
  actor = customer, records = ticketRows } = {}) {
  const { transaction, notifier } = context;
  await transaction.begin();
  if (!paymentOk || !commitOk) {
    await transaction.rollback();
    return { status: paymentOk ? "transaction_failed" : "payment_failed" };
  }
  await transaction.commit(records);
  return notifier.notifyCommitted({ type: "confirmation", purchaseId: 42,
    committed: true, paymentVerified: paymentOk, customer: actor });
}

async function simulateAdminCancellation(context, { commitOk = true, actor = admin,
  records = ticketRows.map((row) => ({ ...row, status: "cancelled" })) } = {}) {
  const { transaction, notifier } = context;
  await transaction.begin();
  if (!commitOk) {
    await transaction.rollback();
    return { status: "transaction_failed" };
  }
  await transaction.commit(records);
  return notifier.notifyCommitted({ type: "cancellation", purchaseId: 42,
    committed: true, admin: actor });
}

test("simulated verified checkout reads committed records and sends one fictional confirmation", async () => {
  const context = fixture();
  assert.equal((await simulateConfirmedCheckout(context)).status, "sent");
  assert.deepEqual(context.events, ["begin", "commit", "read_committed_purchase", "read_committed_purchase", "fake_send"]);
  assert.equal(context.messages.length, 1);
  assert.equal(context.messages[0].to, "customer@example.invalid");
  assert.match(context.messages[0].subject, /booking confirmed.*FV-TEST1234/i);
  assert.match(context.messages[0].html, /A1, A2/);
  assert.match(context.messages[0].text, /FV-TEST1234/);
});

test("failed transaction or simulated payment never prepares or sends confirmation", async () => {
  for (const options of [{ paymentOk: false }, { commitOk: false }]) {
    const context = fixture();
    await simulateConfirmedCheckout(context, options);
    assert.deepEqual(context.events, ["begin", "rollback"]);
    assert.equal(context.messages.length, 0);
  }
  const unpaid = fixture();
  assert.equal((await simulateConfirmedCheckout(unpaid, {
    records: ticketRows.map((row) => ({ ...row, payment_status: "pending" })),
  })).status, "ineligible_booking");
  assert.equal(unpaid.messages.length, 0);
});

test("unverified customer and invalid trusted recipient cannot trigger confirmation", async () => {
  const unverified = fixture();
  assert.equal((await simulateConfirmedCheckout(unverified, { actor: { userId: 8 } })).status, "unverified_event");
  assert.deepEqual(unverified.events, ["begin", "commit"]);
  const invalid = fixture();
  assert.equal((await simulateConfirmedCheckout(invalid, {
    records: ticketRows.map((row) => ({ ...row, customer_email: "bad\r\nBcc: x" })),
  })).status, "invalid_recipient");
  assert.equal(invalid.messages.length, 0);
});

test("simulated verified admin cancellation sends only after commit", async () => {
  const context = fixture();
  assert.equal((await simulateAdminCancellation(context)).status, "sent");
  assert.deepEqual(context.events, ["begin", "commit", "read_committed_purchase", "fake_send"]);
  assert.equal(context.messages.length, 1);
  assert.match(context.messages[0].subject, /booking cancelled.*FV-TEST1234/i);
  assert.match(context.messages[0].text, /A1, A2/);
});

test("failed, unauthorized, and wrong-branch cancellation sends no email", async () => {
  for (const options of [{ commitOk: false }, { actor: { branchId: 3 } },
    { actor: { ...admin, branchId: 4 } }]) {
    const context = fixture();
    await simulateAdminCancellation(context, options);
    assert.equal(context.messages.length, 0);
  }
});

test("duplicate event attempts and fake transport failure leave committed purchase intact", async () => {
  const context = fixture({ sendFailure: true });
  assert.equal((await simulateConfirmedCheckout(context)).status, "failed");
  assert.ok(context.events.includes("commit"));
  assert.ok(!context.events.includes("rollback"));
  assert.equal((await context.notifier.notifyCommitted({ type: "confirmation", purchaseId: 42,
    committed: true, paymentVerified: true, customer })).status, "duplicate");
  assert.equal(context.messages.length, 1);
});

test("committed event preparation failure is contained without a mail attempt", async () => {
  const logs = [];
  const notifier = createBookingNotifier({
    db: { async query() { throw new Error("private database detail"); } },
    sendConfirmation: () => { throw new Error("must not send"); },
    log: (message) => logs.push(message),
  });
  assert.equal((await notifier.notifyCommitted({ type: "confirmation", purchaseId: 42,
    committed: true, paymentVerified: true, customer })).status, "preparation_failed");
  assert.equal(logs.length, 1);
  assert.doesNotMatch(logs[0], /private|database detail|example\.invalid/);
});

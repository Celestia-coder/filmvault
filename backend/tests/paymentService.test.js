const test = require("node:test");
const assert = require("node:assert/strict");
const { createVerifyPayment } = require("../services/paymentService");

const fakeXendit = (invoice) => ({
  async createInvoice(args) {
    this.created = args;
    return { id: "inv_1", invoice_url: "https://checkout-staging.xendit.co/inv_1" };
  },
  async getInvoice() {
    return invoice;
  },
});
const xenditMode = (xendit) => createVerifyPayment({ provider: () => "xendit", xendit });
const paidInvoice = { id: "inv_1", external_id: "filmvault-7-123", status: "PAID", amount: 380 };

test("auto-passes when Xendit is not enabled", async () => {
  const verify = createVerifyPayment({ provider: () => undefined });
  assert.deepEqual(await verify({ userId: 7, amount: 380 }), { ok: true, transactionId: null });
});

test("first attempt creates an invoice for the server total", async () => {
  const xendit = fakeXendit();
  const result = await xenditMode(xendit)({ userId: 7, amount: 380 });
  assert.equal(result.pending, true);
  assert.equal(result.ok, false);
  assert.deepEqual(result.invoice, { id: "inv_1", url: "https://checkout-staging.xendit.co/inv_1" });
  assert.equal(xendit.created.amount, 380);
  assert.match(xendit.created.externalId, /^filmvault-7-/);
});

test("paid invoice with the right amount and owner passes", async () => {
  const result = await xenditMode(fakeXendit(paidInvoice))({ userId: 7, amount: 380, paymentRef: "inv_1" });
  assert.deepEqual(result, { ok: true, transactionId: "inv_1" });
});

test("rejects unpaid, wrong amount, and another user's invoice", async () => {
  const verify = (invoice, userId = 7) =>
    xenditMode(fakeXendit(invoice))({ userId, amount: 380, paymentRef: "inv_1" });
  assert.equal((await verify({ ...paidInvoice, status: "PENDING" })).ok, false);
  assert.equal((await verify({ ...paidInvoice, amount: 1 })).ok, false);
  assert.equal((await verify(paidInvoice, 70)).ok, false); // "filmvault-7-" must not match user 70
});

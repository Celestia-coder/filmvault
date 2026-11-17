const test = require("node:test");
const assert = require("node:assert/strict");
const { runSmokeTest } = require("../scripts/emailSmokeTest");

const argv = ["--send-test-emails", "--to", "test-inbox@example.invalid"];
const env = {
  EMAIL_DELIVERY_ENABLED: "true",
  EMAIL_SMOKE_TEST_RECIPIENTS: "other@example.invalid, test-inbox@example.invalid",
  MAIL_FROM: "FilmVault <sender@example.invalid>",
};

test("manual smoke test sends all three existing templates through an injected fake transport", async () => {
  const messages = [];
  const logs = [];
  const transport = { async sendMail(message) {
    messages.push(message);
    return { messageId: `fake-${messages.length}` };
  } };
  const results = await runSmokeTest({ argv, env, transport, log: (line) => logs.push(line) });
  assert.deepEqual(results.map(({ status }) => status), ["sent", "sent", "sent"]);
  assert.equal(messages.length, 3);
  assert.deepEqual(messages.map(({ to }) => to), Array(3).fill("test-inbox@example.invalid"));
  assert.match(messages[0].subject, /booking confirmed/i);
  assert.match(messages[1].subject, /booking cancelled/i);
  assert.match(messages[2].subject, /showtime changed/i);
  for (const message of messages) {
    assert.match(message.html, /FV-TEST2345/);
    assert.match(message.text, /FV-TEST2345/);
    assert.doesNotMatch(message.html, /localhost|\/verify\//);
  }
  assert.match(messages[2].text, /December 5, 2026 at 6:30 PM \(PHT\)/);
  assert.match(messages[2].text, /December 6, 2026 at 7:00 PM \(PHT\)/);
  assert.ok(logs.every((line) => !line.includes("example.invalid")));
});

test("missing explicit invocation, missing allowlist, and a non-allowlisted recipient never send", async () => {
  let sends = 0;
  const transport = { async sendMail() { sends++; return {}; } };
  const run = (options) => runSmokeTest({ argv, env, transport, log: () => {}, ...options });
  await assert.rejects(run({ argv: [] }), /Usage/);
  await assert.rejects(run({ env: { ...env, EMAIL_SMOKE_TEST_RECIPIENTS: "" } }), /EMAIL_SMOKE_TEST_RECIPIENTS/);
  await assert.rejects(run({ env: { ...env, EMAIL_SMOKE_TEST_RECIPIENTS: "another@example.invalid" } }), /not on/);
  await assert.rejects(run({ argv: ["--send-test-emails", "--to", "bad\r\nBcc: x"] }), /valid test recipient/);
  assert.equal(sends, 0);
});

test("disabled delivery and missing SMTP settings fail before any send", async () => {
  let sends = 0;
  const transport = { async sendMail() { sends++; return {}; } };
  await assert.rejects(runSmokeTest({ argv, env: { ...env, NODE_ENV: "production" }, transport }), /development-only/);
  await assert.rejects(runSmokeTest({ argv, env: { ...env, EMAIL_DELIVERY_ENABLED: "false" }, transport }), /EMAIL_DELIVERY_ENABLED/);
  await assert.rejects(runSmokeTest({ argv, env }), /SMTP_HOST/);
  assert.equal(sends, 0);
});

test("fake transport failure is reported without logging SMTP details", async () => {
  const logs = [];
  const results = await runSmokeTest({ argv, env, log: (line) => logs.push(line),
    transport: { async sendMail() { throw new Error("private SMTP password"); } },
  });
  assert.deepEqual(results.map(({ status }) => status), ["failed", "failed", "failed"]);
  assert.doesNotMatch(logs.join("\n"), /password|private|example.invalid/);
});

test("a rejected terminal approval prevents every email attempt", async () => {
  let sends = 0;
  await assert.rejects(runSmokeTest({ argv, env, approve: async ({ to, names }) => {
    assert.equal(to, "test-inbox@example.invalid");
    assert.deepEqual(names, ["Booking confirmation", "Booking cancellation", "Showtime reschedule"]);
    return false;
  }, transport: { async sendMail() { sends++; return {}; } } }), /cancelled/);
  assert.equal(sends, 0);
});

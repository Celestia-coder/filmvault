const test = require("node:test");
const assert = require("node:assert/strict");
const { createMailer, readMailConfig, EmailConfigurationError } = require("../utils/mailer");
const { createEmailService } = require("../services/emailService");

const enabledEnv = { EMAIL_DELIVERY_ENABLED: "true", MAIL_FROM: "FilmVault <no-reply@example.invalid>" };
const confirmation = {
  referenceCode: "FV-ABCD2345", customerName: "Alex Example", movieTitle: "A Fictional Film",
  branchName: "Example Branch", cinemaNumber: 2, showDate: "2026-12-05",
  showTime: "18:30", seats: ["A1", "A2"], amountPaid: 480,
};
const reschedule = {
  referenceCode: confirmation.referenceCode, customerName: confirmation.customerName,
  movieTitle: confirmation.movieTitle, seats: confirmation.seats,
  previous: { date: "2026-12-05", time: "18:30", branchName: "Example Branch", cinemaNumber: 2 },
  updated: { date: "2026-12-06", time: "19:00", branchName: "Example Branch", cinemaNumber: 2 },
};

test("delivery is disabled by default and creates no SMTP transport", async () => {
  const mailer = createMailer({ env: {}, transportFactory: () => { throw new Error("must not connect"); } });
  assert.deepEqual(await mailer.send({ to: "alex@example.invalid" }), { status: "disabled" });
  const service = createEmailService({ mailer });
  assert.deepEqual(await service.sendBookingConfirmation({ to: "alex@example.invalid", data: confirmation }), { status: "disabled" });
});

test("SMTP configuration validates required settings without revealing values", () => {
  assert.throws(() => readMailConfig({ EMAIL_DELIVERY_ENABLED: "maybe" }), EmailConfigurationError);
  assert.throws(() => readMailConfig(enabledEnv), /SMTP_HOST is required/);
  assert.throws(() => readMailConfig({ ...enabledEnv, SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "bad", SMTP_SECURE: "false", SMTP_USER: "user", SMTP_PASS: "secret" }), /SMTP_PORT/);
  const config = readMailConfig({ ...enabledEnv, SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "587", SMTP_SECURE: "false", SMTP_USER: "user", SMTP_PASS: "secret" });
  assert.equal(config.transportOptions.connectionTimeout, 5000);
  assert.equal(config.transportOptions.socketTimeout, 10000);
  assert.equal(config.transportOptions.secure, false);
  assert.throws(() => createMailer({ env: { EMAIL_DELIVERY_ENABLED: "true" }, transport: { sendMail() {} } }), /MAIL_FROM/);
});

test("fake transport receives the exact shared templates for all three notices", async () => {
  const captured = [];
  const transport = { async sendMail(message) { captured.push(message); return { messageId: `fake-${captured.length}` }; } };
  const service = createEmailService({ env: enabledEnv, transport });
  const recipient = "alex@example.invalid";
  const requests = [
    [service.sendBookingConfirmation, confirmation, "buildBookingConfirmationEmail"],
    [service.sendCancellationNotice, { ...confirmation, cinemaNumber: undefined }, "buildBookingCancellationEmail"],
    [service.sendRescheduleNotice, reschedule, "buildShowtimeRescheduleEmail"],
  ];
  const templates = await import("../../frontend/src/email/emailTemplates.js");
  for (const [send, data, builder] of requests) {
    const result = await send({ to: recipient, data });
    assert.equal(result.status, "sent");
    const rendered = templates[builder](data);
    const message = captured.at(-1);
    assert.deepEqual({ subject: message.subject, html: message.html, text: message.text }, rendered);
    assert.equal(message.to, recipient);
    assert.equal(message.from, enabledEnv.MAIL_FROM);
    assert.match(message.subject, /FV-ABCD2345/);
    assert.match(message.html, /FILMVAULT|FilmVault/);
    assert.match(message.text, /FV-ABCD2345/);
  }
  assert.equal(captured.length, 3);
  assert.match(captured[2].text, /Previously selected seats: A1, A2/);
  assert.match(captured[2].text, /December 5, 2026.*6:30 PM/);
  assert.match(captured[2].text, /December 6, 2026.*7:00 PM/);
});

test("poster and logo are optional, escaped, and never default to local paths", async () => {
  const captured = [];
  const service = createEmailService({ env: enabledEnv, transport: { async sendMail(message) { captured.push(message); return {}; } } });
  await service.sendBookingConfirmation({ to: "alex@example.invalid", data: confirmation });
  assert.doesNotMatch(captured[0].html, /<img\b|localhost|example\.com\/sample-ticket/);
  await service.sendBookingConfirmation({
    to: "alex@example.invalid",
    data: { ...confirmation, posterUrl: "https://example.invalid/poster.png?x=1&y=2", logoUrl: "https://example.invalid/logo.png" },
  });
  assert.match(captured[1].html, /poster\.png\?x=1&amp;y=2/);
  assert.match(captured[1].html, /alt="FILMVAULT"/);
});

test("invalid recipient and template data never reach transport", async () => {
  let count = 0;
  const service = createEmailService({ env: enabledEnv, transport: { async sendMail() { count++; return {}; } } });
  assert.deepEqual(await service.sendBookingConfirmation({ to: "a@example.invalid\r\nBcc: x", data: confirmation }), { status: "invalid_recipient" });
  assert.deepEqual(await service.sendBookingConfirmation({ to: "a@example.invalid", data: { ...confirmation, showDate: "invalid" } }), { status: "invalid_data" });
  assert.equal(count, 0);
});

test("transport failure returns a safe result without throwing or leaking secrets", async () => {
  const service = createEmailService({ env: enabledEnv, transport: { async sendMail() { throw new Error("secret account password"); } } });
  const result = await service.sendRescheduleNotice({ to: "alex@example.invalid", data: reschedule });
  assert.deepEqual(result, { status: "failed", reason: "transport_error" });
  assert.doesNotMatch(JSON.stringify(result), /secret|password/);
});

test("SMTP timeout from an injected transport is reported without exposing details", async () => {
  const timeout = Object.assign(new Error("private server and customer details"), { code: "ETIMEDOUT" });
  const service = createEmailService({
    env: enabledEnv,
    transport: { async sendMail() { throw timeout; } },
  });
  const result = await service.sendBookingConfirmation({ to: "alex@example.invalid", data: confirmation });
  assert.deepEqual(result, { status: "failed", reason: "transport_error" });
  assert.doesNotMatch(JSON.stringify(result), /private|example\.invalid|ETIMEDOUT/);
});

const test = require("node:test");
const assert = require("node:assert/strict");
const nodemailer = require("nodemailer");
const { readFileSync } = require("node:fs");
const path = require("node:path");
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

test("local browser test allowlist rejects other recipients before transport", async () => {
  const sent = [];
  const env = { ...enabledEnv, NODE_ENV: "development",
    EMAIL_LOCAL_TEST_RECIPIENT: "approved@example.invalid" };
  const service = createEmailService({ env, transport: { async sendMail(message) {
    sent.push(message);
    return { messageId: "fake-local-test" };
  } } });
  assert.equal((await service.sendBookingConfirmation({
    to: "other@example.invalid", data: confirmation,
  })).status, "not_allowlisted");
  assert.equal(sent.length, 0);
  assert.equal((await service.sendBookingConfirmation({
    to: "APPROVED@example.invalid", data: confirmation,
  })).status, "sent");
  assert.equal(sent.length, 1);
  assert.throws(() => readMailConfig({ ...env, NODE_ENV: "production" },
    { injectedTransport: true }), /EMAIL_LOCAL_TEST_RECIPIENT/);
  assert.throws(() => readMailConfig({ ...env, EMAIL_LOCAL_TEST_RECIPIENT: "bad" },
    { injectedTransport: true }), /EMAIL_LOCAL_TEST_RECIPIENT/);
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

test("development IPv4 resolution retains the SMTP hostname for TLS verification", async () => {
  const env = { ...enabledEnv, NODE_ENV: "development",
    EMAIL_LOCAL_TEST_RECIPIENT: "approved@example.invalid",
    SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "587", SMTP_SECURE: "false",
    SMTP_USER: "user", SMTP_PASS: "secret", SMTP_LOCAL_IPV4_RESOLVE: "true" };
  let resolvedHost;
  let options;
  let sends = 0;
  const mailer = createMailer({ env,
    resolveIpv4: async (host) => { resolvedHost = host; return { address: "192.0.2.10", family: 4 }; },
    transportFactory: (settings) => { options = settings; return { async sendMail() {
      sends += 1; return { messageId: "fake" };
    } }; },
  });
  assert.equal((await mailer.send({ to: "other@example.invalid" })).status, "not_allowlisted");
  assert.equal(resolvedHost, undefined);
  assert.equal((await mailer.send({ to: "approved@example.invalid" })).status, "sent");
  assert.equal(resolvedHost, "smtp.example.invalid");
  assert.equal(options.host, "192.0.2.10");
  assert.deepEqual(options.tls, { servername: "smtp.example.invalid" });
  assert.equal(options.requireTLS, true);
  assert.equal(options.auth.user, "user");
  assert.equal(sends, 1);
});

test("IPv4 workaround is off by default and restricted to development", async () => {
  const smtp = { ...enabledEnv, SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "465",
    SMTP_SECURE: "true", SMTP_USER: "user", SMTP_PASS: "secret" };
  let options;
  const mailer = createMailer({ env: smtp,
    resolveIpv4: () => { throw new Error("must not resolve"); },
    transportFactory: (settings) => { options = settings; return { async sendMail() { return {}; } }; },
  });
  assert.equal((await mailer.send({ to: "approved@example.invalid" })).status, "sent");
  assert.equal(options.host, "smtp.example.invalid");
  assert.equal(options.tls, undefined);
  assert.throws(() => readMailConfig({ ...smtp, SMTP_LOCAL_IPV4_RESOLVE: "yes" }), /SMTP_LOCAL_IPV4_RESOLVE/);
  assert.throws(() => readMailConfig({ ...smtp, NODE_ENV: "production",
    SMTP_LOCAL_IPV4_RESOLVE: "true" }), /development/);
  assert.throws(() => readMailConfig({ ...smtp, SMTP_LOCAL_IPV4_RESOLVE: "true" }), /development/);
});

test("failed IPv4 resolution does not create an SMTP transport", async () => {
  const env = { ...enabledEnv, NODE_ENV: "development", SMTP_LOCAL_IPV4_RESOLVE: "true",
    SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "587", SMTP_SECURE: "false",
    SMTP_USER: "user", SMTP_PASS: "secret" };
  let created = false;
  const mailer = createMailer({ env, resolveIpv4: async () => ({ address: "::1" }),
    transportFactory: () => { created = true; throw new Error("must not connect"); } });
  assert.deepEqual(await mailer.send({ to: "approved@example.invalid" }),
    { status: "failed", reason: "transport_error", outcome: "uncertain" });
  assert.equal(created, false);
});

test("mailer verification authenticates without sending a message", async () => {
  const env = { ...enabledEnv, NODE_ENV: "development", SMTP_LOCAL_IPV4_RESOLVE: "true",
    SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "465", SMTP_SECURE: "true",
    SMTP_USER: "user", SMTP_PASS: "secret" };
  let options;
  let verified = 0;
  const mailer = createMailer({ env, resolveIpv4: async () => "192.0.2.11",
    transportFactory: (settings) => { options = settings; return {
      async verify() { verified += 1; },
      async sendMail() { throw new Error("must not send"); },
    }; } });
  assert.deepEqual(await mailer.verify(), { status: "verified" });
  assert.equal(verified, 1);
  assert.equal(options.host, "192.0.2.11");
  assert.deepEqual(options.tls, { servername: "smtp.example.invalid" });
  assert.equal(options.requireTLS, undefined);
  assert.deepEqual(await createMailer({ env: {} }).verify(), { status: "disabled" });
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
    const rendered = templates[builder](builder === "buildBookingConfirmationEmail"
      ? { ...data, logoImageCid: "filmvault-logo@filmvault.invalid" } : data);
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

test("confirmation embeds the original logo as an inline CID image", async () => {
  const captured = [];
  const service = createEmailService({ env: enabledEnv,
    transport: { async sendMail(message) { captured.push(message); return {}; } } });
  assert.equal((await service.sendBookingConfirmation({ to: "alex@example.invalid", data: confirmation })).status, "sent");
  const [logo] = captured[0].attachments;
  assert.equal(logo.cid, "filmvault-logo@filmvault.invalid");
  assert.equal(logo.contentType, "image/png");
  assert.equal(logo.contentDisposition, "inline");
  assert.deepEqual(logo.content, readFileSync(path.resolve(__dirname, "../../frontend/src/assets/images/logo.png")));
  assert.match(captured[0].html, /src="cid:filmvault-logo@filmvault\.invalid"/);
  assert.equal((captured[0].html.match(/src="cid:filmvault-logo@filmvault\.invalid"/g) ?? []).length, 1);
  assert.doesNotMatch(captured[0].text, /cid:/);
});

test("offline MIME includes the inline logo Content-ID without SMTP", async () => {
  const stream = nodemailer.createTransport({ streamTransport: true, buffer: true });
  let mime;
  const service = createEmailService({ env: enabledEnv,
    transport: { async sendMail(message) {
      const result = await stream.sendMail(message);
      mime = result.message.toString();
      return result;
    } } });
  assert.equal((await service.sendBookingConfirmation({ to: "alex@example.invalid", data: confirmation })).status, "sent");
  assert.match(mime, /Content-ID: <filmvault-logo@filmvault\.invalid>/);
  assert.match(mime, /Content-Disposition: inline/);
  assert.match(mime, /cid:filmvault-logo@filmvault\.invalid/);
});

test("poster and public logo URLs remain optional when the local logo is unavailable", async () => {
  const captured = [];
  const service = createEmailService({ env: enabledEnv, logoReader: async () => { throw new Error("missing logo"); },
    transport: { async sendMail(message) { captured.push(message); return {}; } } });
  await service.sendBookingConfirmation({ to: "alex@example.invalid", data: confirmation });
  assert.doesNotMatch(captured[0].html, /<img\b|localhost|example\.com\/sample-ticket/);
  assert.equal(captured[0].attachments, undefined);
  await service.sendBookingConfirmation({
    to: "alex@example.invalid",
    data: { ...confirmation, posterUrl: "https://example.invalid/poster.png?x=1&y=2", logoUrl: "https://example.invalid/logo.png" },
  });
  assert.match(captured[1].html, /poster\.png\?x=1&amp;y=2/);
  assert.match(captured[1].html, /alt="FILMVAULT"/);
});

test("only confirmation forwards an inline attachment to the fake transport", async () => {
  const captured = [];
  const service = createEmailService({ env: enabledEnv,
    transport: { async sendMail(message) { captured.push(message); return {}; } } });
  const attachment = { cid: "filmvault-ticket-qr@filmvault.invalid", content: Buffer.from("fake"),
    contentType: "image/png", contentDisposition: "inline" };
  const ticketUrl = "https://tickets.example.com/verify/0123456789abcdef0123456789abcdef";
  assert.equal((await service.sendBookingConfirmation({ to: "alex@example.invalid",
    data: { ...confirmation, ticketUrl, qrImageCid: attachment.cid }, attachments: [attachment] })).status, "sent");
  assert.equal(captured[0].attachments.length, 2);
  assert.deepEqual(captured[0].attachments[0], attachment);
  assert.equal(captured[0].attachments[1].cid, "filmvault-logo@filmvault.invalid");
  assert.match(captured[0].html, /src="cid:filmvault-logo@filmvault\.invalid"/);
  assert.match(captured[0].html, /src="cid:filmvault-ticket-qr@filmvault\.invalid"/);
  assert.match(captured[0].text, /tickets\.example\.com\/verify\//);
  assert.equal((await service.sendCancellationNotice({ to: "alex@example.invalid",
    data: confirmation, attachments: [attachment] })).status, "sent");
  assert.equal(captured[1].attachments, undefined);
});

test("Nodemailer's offline stream contains a matching inline QR Content-ID", async () => {
  const stream = nodemailer.createTransport({ streamTransport: true, buffer: true });
  let mime;
  const transport = { async sendMail(message) {
    const result = await stream.sendMail(message);
    mime = result.message.toString();
    return result;
  } };
  const mailer = createMailer({ env: enabledEnv, transport });
  const cid = "filmvault-ticket-qr@filmvault.invalid";
  const ticketUrl = "https://tickets.example.com/verify/0123456789abcdef0123456789abcdef";
  const rendered = (await import("../../frontend/src/email/emailTemplates.js"))
    .buildBookingConfirmationEmail({ ...confirmation, ticketUrl, qrImageCid: cid });
  const result = await mailer.send({ to: "alex@example.invalid",
    ...rendered, attachments: [{ filename: "ticket.png", content: Buffer.from("fake-png"),
      contentType: "image/png", contentDisposition: "inline", cid }] });
  assert.equal(result.status, "sent");
  assert.match(mime, /Content-ID: <filmvault-ticket-qr@filmvault\.invalid>/);
  assert.match(mime, /Content-Disposition: inline/);
  assert.match(rendered.html, /src="cid:filmvault-ticket-qr@filmvault\.invalid"/);
  assert.equal(mailer.enabled, true);
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
  assert.deepEqual(result, { status: "failed", reason: "transport_error", outcome: "uncertain" });
  assert.doesNotMatch(JSON.stringify(result), /secret|password/);
});

test("SMTP timeout from an injected transport is reported without exposing details", async () => {
  const timeout = Object.assign(new Error("private server and customer details"), { code: "ETIMEDOUT" });
  const service = createEmailService({
    env: enabledEnv,
    transport: { async sendMail() { throw timeout; } },
  });
  const result = await service.sendBookingConfirmation({ to: "alex@example.invalid", data: confirmation });
  assert.deepEqual(result, { status: "failed", reason: "transport_error", outcome: "uncertain" });
  assert.doesNotMatch(JSON.stringify(result), /private|example\.invalid|ETIMEDOUT/);
});

test("only a permanent SMTP rejection before DATA is a definite non-delivery", async () => {
  const transport = { async sendMail() {
    throw Object.assign(new Error("private recipient and server detail"),
      { responseCode: 550, command: "RCPT TO" });
  } };
  const service = createEmailService({ env: enabledEnv, transport });
  const result = await service.sendBookingConfirmation({ to: "alex@example.invalid", data: confirmation });
  assert.deepEqual(result, { status: "failed", reason: "transport_error", outcome: "definite" });
  assert.doesNotMatch(JSON.stringify(result), /private|alex@example/);
  transport.sendMail = async () => { throw Object.assign(new Error("private"),
    { responseCode: 550, command: "DATA" }); };
  assert.equal((await service.sendBookingConfirmation({ to: "alex@example.invalid", data: confirmation })).outcome, "uncertain");
});

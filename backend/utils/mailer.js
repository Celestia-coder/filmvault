const nodemailer = require("nodemailer");

class EmailConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmailConfigurationError";
  }
}

const isValidRecipient = (email) =>
  typeof email === "string" &&
  email.length <= 254 &&
  /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(email);

function readMailConfig(env = process.env, { injectedTransport = false } = {}) {
  const flag = env.EMAIL_DELIVERY_ENABLED ?? "false";
  if (flag !== "true" && flag !== "false") {
    throw new EmailConfigurationError("EMAIL_DELIVERY_ENABLED must be true or false.");
  }
  if (flag === "false") return { enabled: false };

  if (!env.MAIL_FROM?.trim()) {
    throw new EmailConfigurationError("MAIL_FROM is required when email delivery is enabled.");
  }
  const config = { enabled: true, from: env.MAIL_FROM.trim() };
  if (injectedTransport) return config;

  for (const key of ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS"]) {
    if (!env[key]?.trim()) throw new EmailConfigurationError(`${key} is required when email delivery is enabled.`);
  }
  const port = Number(env.SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EmailConfigurationError("SMTP_PORT must be a valid TCP port.");
  }
  if (env.SMTP_SECURE !== "true" && env.SMTP_SECURE !== "false") {
    throw new EmailConfigurationError("SMTP_SECURE must be true or false.");
  }
  return {
    ...config,
    transportOptions: {
      host: env.SMTP_HOST.trim(),
      port,
      secure: env.SMTP_SECURE === "true",
      auth: { user: env.SMTP_USER.trim(), pass: env.SMTP_PASS },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    },
  };
}

function createMailer({ env = process.env, transport, transportFactory = nodemailer.createTransport } = {}) {
  const config = readMailConfig(env, { injectedTransport: Boolean(transport) });
  let sender = transport;
  return {
    enabled: config.enabled,
    async send({ to, subject, html, text, attachments }) {
      if (!config.enabled) return { status: "disabled" };
      if (!isValidRecipient(to)) return { status: "invalid_recipient" };
      try {
        sender ??= transportFactory(config.transportOptions);
        const result = await sender.sendMail({ from: config.from, to, subject, html, text,
          ...(attachments?.length ? { attachments } : {}) });
        return { status: "sent", messageId: result.messageId ?? null };
      } catch (error) {
        // SMTP errors may contain addresses, credentials, or server details.
        // Only an explicit permanent rejection before message DATA is a
        // definite non-delivery. A timeout/disconnect may follow acceptance.
        const rejectedBeforeData = Number.isInteger(error?.responseCode) &&
          error.responseCode >= 500 && error.responseCode < 600 &&
          (error.command === "MAIL FROM" || error.command === "RCPT TO");
        return { status: "failed", reason: "transport_error",
          outcome: rejectedBeforeData ? "definite" : "uncertain" };
      }
    },
  };
}

module.exports = { EmailConfigurationError, isValidRecipient, readMailConfig, createMailer };

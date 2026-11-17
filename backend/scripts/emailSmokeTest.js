// Manual, development-only SMTP check. Importing this module never sends mail.
const { createMailer, isValidRecipient, readMailConfig } = require("../utils/mailer");
const { createEmailService } = require("../services/emailService");

const sample = {
  customerName: "Alex Sample",
  referenceCode: "FV-TEST2345",
  movieTitle: "A Fictional Film",
  branchName: "Sample City Branch",
  showDate: "2026-12-05",
  showTime: "18:30:00",
  seats: ["C5", "C6"],
};

const notices = [
  {
    name: "Booking confirmation",
    builder: "buildBookingConfirmationEmail",
    method: "sendBookingConfirmation",
    data: { ...sample, cinemaNumber: 2, ticketTypes: ["Regular", "Regular"], amountPaid: 560 },
  },
  {
    name: "Booking cancellation",
    builder: "buildBookingCancellationEmail",
    method: "sendCancellationNotice",
    data: sample,
  },
  {
    name: "Showtime reschedule",
    builder: "buildShowtimeRescheduleEmail",
    method: "sendRescheduleNotice",
    data: {
      customerName: sample.customerName,
      referenceCode: sample.referenceCode,
      movieTitle: sample.movieTitle,
      previous: { date: "2026-12-05", time: "18:30:00", branchName: sample.branchName, cinemaNumber: 2 },
      updated: { date: "2026-12-06", time: "19:00:00", branchName: sample.branchName, cinemaNumber: 2 },
    },
  },
];

function testRecipient(argv, env) {
  if (argv.length !== 3 || !argv.includes("--send-test-emails") ||
      argv.filter((arg) => arg === "--to").length !== 1) {
    throw new Error("Usage: node scripts/emailSmokeTest.js --send-test-emails --to <allowlisted-test-email>");
  }
  const recipient = argv[argv.indexOf("--to") + 1];
  if (!isValidRecipient(recipient)) throw new Error("A valid test recipient is required.");
  const allowlist = (env.EMAIL_SMOKE_TEST_RECIPIENTS ?? "").split(",").map((address) => address.trim());
  if (allowlist.length === 0 || allowlist.some((address) => !isValidRecipient(address))) {
    throw new Error("EMAIL_SMOKE_TEST_RECIPIENTS must contain valid test addresses.");
  }
  if (!allowlist.some((address) => address.toLowerCase() === recipient.toLowerCase())) {
    throw new Error("The test recipient is not on EMAIL_SMOKE_TEST_RECIPIENTS.");
  }
  return recipient;
}

async function runSmokeTest({ argv = [], env = {}, transport, log = console.log, approve } = {}) {
  if (env.NODE_ENV === "production") throw new Error("The email smoke test is development-only.");
  const to = testRecipient(argv, env);
  // Validate all settings and content before the first possible SMTP send.
  readMailConfig(env, { injectedTransport: Boolean(transport) });
  if (env.EMAIL_DELIVERY_ENABLED !== "true") {
    throw new Error("EMAIL_DELIVERY_ENABLED must be true for this explicit smoke test.");
  }
  const templates = await import("../../frontend/src/email/emailTemplates.js");
  for (const notice of notices) templates[notice.builder](notice.data);
  if (approve && !(await approve({ to, names: notices.map(({ name }) => name) }))) {
    throw new Error("Smoke test cancelled; no email was sent.");
  }

  let mailer;
  if (!transport && env.SMTP_HOST === "smtp.gmail.com") {
    // This Windows development host can reach Gmail over IPv4, while
    // Nodemailer's automatic dual-stack connection times out. Keep Gmail's
    // hostname for TLS and require STARTTLS before authentication or sending.
    const net = require("node:net");
    const nodemailer = require("nodemailer");
    const localAddress = await new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: env.SMTP_HOST, port: Number(env.SMTP_PORT), family: 4, timeout: 10000 });
      socket.once("connect", () => {
        const address = socket.localAddress;
        socket.destroy();
        resolve(address);
      });
      socket.once("timeout", () => { socket.destroy(); reject(new Error("Gmail IPv4 connection timed out.")); });
      socket.once("error", reject);
    });
    mailer = createMailer({ env, transportFactory: (options) =>
      nodemailer.createTransport({ ...options, localAddress, requireTLS: true }) });
  }
  const service = createEmailService({ env, transport, mailer });
  const results = [];
  for (const notice of notices) {
    const result = await service[notice.method]({ to, data: notice.data });
    results.push({ name: notice.name, status: result.status });
    log(`${notice.name}: ${result.status}`);
  }
  return results;
}

if (require.main === module) {
  // Read the backend's ignored .env only during explicit CLI execution.
  require("dotenv").config();
  const approve = async ({ to, names }) => {
    if (!process.stdin.isTTY) throw new Error("An interactive terminal is required for real SMTP testing.");
    console.log(`Allowlisted test recipient: ${to}`);
    console.log(`Emails to send: ${names.join(", ")}`);
    console.log("Only this manual smoke test will use SMTP; automatic notifications remain disabled.");
    const readline = require("node:readline/promises");
    const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      const answer = await prompt.question('Type "SEND 3 TEST EMAILS" to approve: ');
      return answer === "SEND 3 TEST EMAILS";
    } finally {
      prompt.close();
    }
  };
  runSmokeTest({ argv: process.argv.slice(2), env: process.env, approve })
    .then((results) => { if (results.some((result) => result.status !== "sent")) process.exitCode = 1; })
    .catch((error) => {
      // Configuration errors name missing keys; transport details remain hidden.
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = { runSmokeTest };

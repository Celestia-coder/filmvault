// services/otpService.js
// Email OTP for sign up. One active code per email, stored hashed in EMAIL_OTP.
// Flow: issue(email) sends a 6-digit code -> verify(email, code) at register
// -> consume(email) once the account row exists.

const crypto = require("crypto");
const pool = require("../config/database");
const { sendOtpCode } = require("./emailService");

const OTP_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const OTP_PATTERN = /^\d{6}$/;

const normalizeEmail = (email) =>
	String(email ?? "")
		.trim()
		.toLowerCase();

function createOtpService({
	db = pool,
	send = sendOtpCode,
	env = process.env,
	log = console.error,
} = {}) {
	// HMAC, so a leaked EMAIL_OTP table can't be brute-forced without the secret.
	function hashCode(email, code) {
		const secret = env.OTP_SECRET || env.AUTH_TOKEN_SECRET;
		if (!secret)
			throw new Error("OTP_SECRET or AUTH_TOKEN_SECRET must be set.");
		return crypto
			.createHmac("sha256", secret)
			.update(`${email}:${code}`)
			.digest("hex");
	}

	// Returns { status: "sent" | "cooldown" | "email_unavailable" | "send_failed", retryAfter? }
	async function issue(rawEmail) {
		const email = normalizeEmail(rawEmail);

		// Housekeeping: drop codes that expired more than a day ago.
		await db.query(
			"DELETE FROM EMAIL_OTP WHERE expires_at < DATE_SUB(NOW(), INTERVAL 1 DAY)",
		);

		const [rows] = await db.query(
			"SELECT TIMESTAMPDIFF(SECOND, created_at, NOW()) AS age FROM EMAIL_OTP WHERE email = ?",
			[email],
		);
		if (rows.length > 0 && Number(rows[0].age) < RESEND_COOLDOWN_SECONDS) {
			return {
				status: "cooldown",
				retryAfter: RESEND_COOLDOWN_SECONDS - Number(rows[0].age),
			};
		}

		const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
		const hash = hashCode(email, code);
		await db.query(
			`INSERT INTO EMAIL_OTP (email, otp_hash, expires_at, attempts, created_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 0, NOW())
       ON DUPLICATE KEY UPDATE otp_hash = ?, expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE),
                               attempts = 0, created_at = NOW()`,
			[email, hash, OTP_TTL_MINUTES, hash, OTP_TTL_MINUTES],
		);

		let result;
		try {
			result = await send({
				to: email,
				data: { code, expiresInMinutes: OTP_TTL_MINUTES },
			});
		} catch {
			result = { status: "failed" };
		}
		if (result?.status === "sent") return { status: "sent" };

		// Local development without SMTP: print the code instead of blocking sign up.
		if (result?.status === "disabled" && env.NODE_ENV !== "production") {
			log(
				`[DEV] Email delivery is disabled. Sign-up code for ${email}: ${code}`,
			);
			return { status: "sent" };
		}

		// Nothing was delivered, so free the email to try again right away.
		await db.query("DELETE FROM EMAIL_OTP WHERE email = ?", [email]);
		return {
			status:
				result?.status === "disabled"
					? "email_unavailable"
					: "send_failed",
		};
	}

	// Returns { status: "ok" | "invalid" | "invalid_format" | "expired" | "too_many_attempts", attemptsLeft? }
	async function verify(rawEmail, rawCode) {
		const email = normalizeEmail(rawEmail);
		const code = String(rawCode ?? "").trim();
		if (!OTP_PATTERN.test(code)) return { status: "invalid_format" };

		// Count the attempt first and atomically, so parallel guesses can't exceed the limit.
		const [update] = await db.query(
			"UPDATE EMAIL_OTP SET attempts = attempts + 1 WHERE email = ? AND attempts < ? AND expires_at > NOW()",
			[email, MAX_ATTEMPTS],
		);
		if (update.affectedRows === 0) {
			const [rows] = await db.query(
				"SELECT (expires_at > NOW()) AS live FROM EMAIL_OTP WHERE email = ?",
				[email],
			);
			if (rows.length === 0 || !Number(rows[0].live))
				return { status: "expired" };
			return { status: "too_many_attempts" };
		}

		const [rows] = await db.query(
			"SELECT otp_hash, attempts FROM EMAIL_OTP WHERE email = ?",
			[email],
		);
		if (rows.length === 0) return { status: "expired" };

		const expected = Buffer.from(rows[0].otp_hash, "hex");
		const actual = Buffer.from(hashCode(email, code), "hex");
		if (
			expected.length === actual.length &&
			crypto.timingSafeEqual(expected, actual)
		) {
			return { status: "ok" };
		}
		return {
			status: "invalid",
			attemptsLeft: Math.max(0, MAX_ATTEMPTS - Number(rows[0].attempts)),
		};
	}

	async function consume(rawEmail) {
		await db.query("DELETE FROM EMAIL_OTP WHERE email = ?", [
			normalizeEmail(rawEmail),
		]);
	}

	return { issue, verify, consume };
}

module.exports = {
	createOtpService,
	OTP_TTL_MINUTES,
	RESEND_COOLDOWN_SECONDS,
	MAX_ATTEMPTS,
};

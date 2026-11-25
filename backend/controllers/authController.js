// controllers/authController.js
// Register (signup), login, and the customer profile (view + edit, including
// the profile photo). Backed by the MySQL `USER` table via config/database.js.

const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const pool = require("../config/database");
const { normalizePhone } = require("../utils/phone");
const { signAuthToken } = require("../utils/authToken");
const { createOtpService } = require("../services/otpService");
const {
	GoogleConfigError,
	verifyGoogleIdToken,
} = require("../services/googleAuthService");

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,}$/;
const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_PART = 75; // USER.first_name / USER.last_name are VARCHAR(75)

const otpService = createOtpService();

// Profile photos must be images uploaded to our own Cloudinary folder
// (POST /api/upload/profile), so the column can't hold links to other sites.
const MAX_PHOTO_URL_LENGTH = 500; // matches USER.profile_photo_url
const isOurProfilePhoto = (url) =>
	typeof url === "string" &&
	url.length <= MAX_PHOTO_URL_LENGTH &&
	url.startsWith(
		`https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`,
	) &&
	url.includes("/filmvault/profiles/");

// Existing account with the same email or username, or null.
const findDuplicateAccount = async (cleanEmail, cleanUsername) => {
	const [existing] = await pool.query(
		"SELECT email, username FROM `USER` WHERE email = ? OR username = ?",
		[cleanEmail, cleanUsername],
	);
	if (
		existing.some(
			(row) => row.email.toLowerCase() === cleanEmail.toLowerCase(),
		)
	) {
		return {
			field: "email",
			message: "An account with this email already exists.",
		};
	}
	if (existing.length > 0) {
		return {
			field: "username",
			message:
				"That display name is already taken. Please choose another.",
		};
	}
	return null;
};

const otpFailureMessage = ({ status, attemptsLeft }) => {
	switch (status) {
		case "invalid":
			return attemptsLeft > 0
				? `Incorrect code. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left.`
				: "Incorrect code. Request a new one.";
		case "too_many_attempts":
			return "Too many incorrect attempts. Request a new code.";
		case "expired":
			return "That code has expired or was never sent. Request a new one.";
		default:
			return "Enter the 6-digit code sent to your email.";
	}
};

// POST /api/auth/register/send-otp
// body: { email, username }
// Step 1 of sign up: checks the email/username are free, then emails a code.
// The account is only created by POST /api/auth/register with that code.
const sendRegisterOtp = async (req, res) => {
	const cleanEmail = String(req.body?.email ?? "").trim();
	const cleanUsername = String(req.body?.username ?? "").trim();

	if (!EMAIL_PATTERN.test(cleanEmail)) {
		return res.status(400).json({
			success: false,
			field: "email",
			message: "Enter a valid email address.",
		});
	}
	if (!USERNAME_PATTERN.test(cleanUsername)) {
		return res.status(400).json({
			success: false,
			field: "username",
			message:
				"Display name must be at least 3 characters: letters, numbers and underscores only.",
		});
	}

	try {
		const duplicate = await findDuplicateAccount(cleanEmail, cleanUsername);
		if (duplicate) {
			return res.status(409).json({ success: false, ...duplicate });
		}

		const result = await otpService.issue(cleanEmail);
		switch (result.status) {
			case "sent":
				return res.status(200).json({
					success: true,
					message: "Verification code sent.",
				});
			case "cooldown":
				res.set("Retry-After", String(result.retryAfter));
				return res.status(429).json({
					success: false,
					retryAfter: result.retryAfter,
					message: `A code was just sent. You can request another in ${result.retryAfter}s.`,
				});
			case "email_unavailable":
				return res.status(503).json({
					success: false,
					message:
						"Email verification is unavailable right now. Please try again later.",
				});
			default:
				return res.status(502).json({
					success: false,
					message:
						"We couldn't send the verification code. Please try again.",
				});
		}
	} catch (error) {
		console.error("Send OTP error:", error);
		return res.status(500).json({
			success: false,
			message:
				"Something went wrong while sending the verification code.",
		});
	}
};

// POST /api/auth/register
// body also needs `otp`: the 6-digit code from POST /api/auth/register/send-otp.
const register = async (req, res) => {
	const { firstName, lastName, email, password, username, phoneNum, otp } =
		req.body ?? {};

	if (
		!firstName?.trim() ||
		!lastName?.trim() ||
		!email?.trim() ||
		!password ||
		!username?.trim()
	) {
		return res.status(400).json({
			success: false,
			message:
				"All fields (firstName, lastName, email, password, username) are required.",
		});
	}

	const cleanEmail = email.trim();
	const cleanUsername = username.trim();

	if (firstName.trim().length > MAX_NAME_PART) {
		return res.status(400).json({
			success: false,
			field: "firstName",
			message: "First name is too long.",
		});
	}
	if (lastName.trim().length > MAX_NAME_PART) {
		return res.status(400).json({
			success: false,
			field: "lastName",
			message: "Last name is too long.",
		});
	}
	if (!EMAIL_PATTERN.test(cleanEmail)) {
		return res.status(400).json({
			success: false,
			field: "email",
			message: "Enter a valid email address.",
		});
	}
	if (!USERNAME_PATTERN.test(cleanUsername)) {
		return res.status(400).json({
			success: false,
			field: "username",
			message:
				"Display name must be at least 3 characters: letters, numbers and underscores only.",
		});
	}
	if (password.length < MIN_PASSWORD_LENGTH) {
		return res.status(400).json({
			success: false,
			field: "password",
			message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
		});
	}

	const { phone, error: phoneError } = normalizePhone(phoneNum);
	if (phoneError) {
		return res
			.status(400)
			.json({ success: false, field: "phone", message: phoneError });
	}

	try {
		const duplicate = await findDuplicateAccount(cleanEmail, cleanUsername);
		if (duplicate) {
			return res.status(409).json({ success: false, ...duplicate });
		}

		// The code must have been sent to this exact email.
		const otpCheck = await otpService.verify(cleanEmail, otp);
		if (otpCheck.status !== "ok") {
			return res.status(400).json({
				success: false,
				field: "otp",
				message: otpFailureMessage(otpCheck),
			});
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		const fullName = `${firstName.trim()} ${lastName.trim()}`;

		const [result] = await pool.query(
			"INSERT INTO `USER` (role, email, password, username, name, first_name, last_name, phone_num) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			[
				"customer",
				cleanEmail,
				hashedPassword,
				cleanUsername,
				fullName,
				firstName.trim(),
				lastName.trim(),
				phone,
			],
		);

		// Code is single-use. A failed cleanup must not undo the sign up.
		await otpService.consume(cleanEmail).catch(() => {});

		return res.status(201).json({
			success: true,
			message: "Registration successful.",
			user: {
				userId: result.insertId,
				username: cleanUsername,
				name: fullName,
				email: cleanEmail,
				role: "customer",
				branchId: null,
			},
		});
	} catch (error) {
		console.error("Register error:", error);
		return res.status(500).json({
			success: false,
			message: "Something went wrong while creating the account.",
		});
	}
};

// POST /api/auth/login
// Returns the user plus a signed token. The frontend sends the token as
// `Authorization: Bearer <token>` so middleware/authenticate.js can set
// req.auth from the verified token and the current USER row.
const login = async (req, res) => {
	const { email, password } = req.body ?? {};

	if (!email || !password) {
		return res.status(400).json({
			success: false,
			message: "Email and password are required.",
		});
	}

	try {
		const [rows] = await pool.query(
			"SELECT * FROM `USER` WHERE email = ?",
			[email],
		);

		if (rows.length === 0) {
			return res.status(401).json({
				success: false,
				message: "Invalid email or password.",
			});
		}

		const matchedUser = rows[0];
		const isMatch = await bcrypt.compare(password, matchedUser.password);

		if (!isMatch) {
			return res.status(401).json({
				success: false,
				message: "Invalid email or password.",
			});
		}

		return res.status(200).json({
			success: true,
			message: "Login successful.",
			token: signAuthToken(matchedUser.user_id),
			user: {
				userId: matchedUser.user_id,
				username: matchedUser.username,
				name: matchedUser.name,
				email: matchedUser.email,
				role: matchedUser.role,
				// Admins manage one branch; the admin pages send this as ?branchId=.
				branchId: matchedUser.branch_id ?? null,
			},
		});
	} catch (error) {
		console.error("Login error:", error);
		return res.status(500).json({
			success: false,
			message: "Something went wrong while logging in.",
		});
	}
};

/* ----------------------------- password reset ----------------------------- */
// Customers only. Admin accounts are never reset by email.

const GENERIC_RESET_MESSAGE =
	"If that email has an account, we sent a 6-digit code to it.";

const findCustomerByEmail = async (cleanEmail) => {
	const [rows] = await pool.query(
		"SELECT user_id FROM `USER` WHERE email = ? AND role = 'customer'",
		[cleanEmail],
	);
	return rows[0] ?? null;
};

// POST /api/auth/forgot-password
// body: { email }
// Always answers the same way, so it can't be used to find out which emails
// have accounts.
const forgotPassword = async (req, res) => {
	const cleanEmail = String(req.body?.email ?? "").trim();
	if (!EMAIL_PATTERN.test(cleanEmail)) {
		return res.status(400).json({
			success: false,
			field: "email",
			message: "Enter a valid email address.",
		});
	}

	try {
		if (await findCustomerByEmail(cleanEmail)) {
			const result = await otpService.issue(cleanEmail, "reset");
			if (result.status !== "sent" && result.status !== "cooldown") {
				console.error(
					`Password reset code not sent (${result.status}).`,
				);
			}
		}
		return res
			.status(200)
			.json({ success: true, message: GENERIC_RESET_MESSAGE });
	} catch (error) {
		console.error("Forgot password error:", error);
		return res.status(500).json({
			success: false,
			message: "Something went wrong. Please try again.",
		});
	}
};

// POST /api/auth/reset-password
// body: { email, otp, newPassword }
const resetPassword = async (req, res) => {
	const { email, otp, newPassword } = req.body ?? {};
	const cleanEmail = String(email ?? "").trim();

	if (!EMAIL_PATTERN.test(cleanEmail)) {
		return res.status(400).json({
			success: false,
			field: "email",
			message: "Enter a valid email address.",
		});
	}
	if (
		typeof newPassword !== "string" ||
		newPassword.length < MIN_PASSWORD_LENGTH
	) {
		return res.status(400).json({
			success: false,
			field: "password",
			message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
		});
	}

	try {
		const customer = await findCustomerByEmail(cleanEmail);
		// No account gets the same answer as a code that was never sent.
		const check = customer
			? await otpService.verify(cleanEmail, otp, "reset")
			: { status: "expired" };
		if (check.status !== "ok") {
			return res.status(400).json({
				success: false,
				field: "otp",
				message: otpFailureMessage(check),
			});
		}

		const passwordHash = await bcrypt.hash(newPassword, 10);
		await pool.query(
			"UPDATE `USER` SET password = ? WHERE user_id = ? AND role = 'customer'",
			[passwordHash, customer.user_id],
		);

		// Code is single-use. A failed cleanup must not undo the reset.
		await otpService.consume(cleanEmail, "reset").catch(() => {});

		return res.status(200).json({
			success: true,
			message: "Password updated. You can now log in.",
		});
	} catch (error) {
		console.error("Reset password error:", error);
		return res.status(500).json({
			success: false,
			message: "Something went wrong while resetting the password.",
		});
	}
};

/* ---------------------------------- google --------------------------------- */

// Username from the email's local part: letters/digits/underscore, 3+ chars.
const usernameCandidates = function* (email) {
	let base = email
		.split("@")[0]
		.replace(/[^a-zA-Z0-9_]/g, "_")
		.slice(0, 30);
	if (base.length < 3) base = `user_${base}`;
	yield base;
	for (let i = 0; i < 4; i += 1)
		yield `${base}${crypto.randomInt(100, 10000)}`;
	yield `user_${crypto.randomBytes(5).toString("hex")}`;
};

const findUserForGoogle = async ({ googleId, email }) => {
	const [rows] = await pool.query(
		"SELECT * FROM `USER` WHERE google_id = ? OR email = ?",
		[googleId, email],
	);
	return (
		rows.find((row) => row.google_id === googleId) ??
		rows.find((row) => row.email.toLowerCase() === email) ??
		null
	);
};

// Creates a customer for a first-time Google sign-in. Returns the USER row.
const createGoogleUser = async ({
	googleId,
	email,
	name,
	givenName,
	familyName,
}) => {
	// Google accounts have no password: store a hash of random bytes nobody knows.
	const unusablePassword = await bcrypt.hash(
		crypto.randomBytes(32).toString("hex"),
		10,
	);
	const fullName = (name || email.split("@")[0]).slice(0, 150);
	// Prefer Google's own first/last name; otherwise split the full name once.
	const { firstName, lastName } =
		givenName || familyName
			? { firstName: givenName ?? "", lastName: familyName ?? "" }
			: splitName(fullName);

	for (const username of usernameCandidates(email)) {
		try {
			const [result] = await pool.query(
				"INSERT INTO `USER` (role, email, password, username, name, first_name, last_name, phone_num, google_id) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)",
				[
					"customer",
					email,
					unusablePassword,
					username,
					fullName,
					firstName.slice(0, MAX_NAME_PART),
					lastName.slice(0, MAX_NAME_PART),
					googleId,
				],
			);
			const [rows] = await pool.query(
				"SELECT * FROM `USER` WHERE user_id = ?",
				[result.insertId],
			);
			return rows[0];
		} catch (error) {
			if (error.code !== "ER_DUP_ENTRY") throw error;
			// Same person signed in twice at once: use the row that won the race.
			const existing = await findUserForGoogle({ googleId, email });
			if (existing) return existing;
			// Otherwise the username was taken: try the next candidate.
		}
	}
	throw new Error("Could not generate a unique username.");
};

// POST /api/auth/google
// body: { credential }   the ID token from Google's sign-in button
// Logs in (or creates) the customer for that Google account and returns the
// same { token, user } shape as /login.
const googleAuth = async (req, res) => {
	const credential = req.body?.credential;
	if (typeof credential !== "string" || !credential) {
		return res
			.status(400)
			.json({
				success: false,
				message: "Google credential is required.",
			});
	}

	let profile;
	try {
		profile = await verifyGoogleIdToken(credential);
	} catch (error) {
		console.error("Google token verification failed:", error.message);
		if (error instanceof GoogleConfigError) {
			return res.status(503).json({
				success: false,
				message: "Google sign-in is not available right now.",
			});
		}
		return res.status(401).json({
			success: false,
			message: "Google sign-in failed. Please try again.",
		});
	}

	if (!profile.emailVerified) {
		return res.status(401).json({
			success: false,
			message: "Your Google email address is not verified.",
		});
	}

	try {
		let user = await findUserForGoogle(profile);
		let isNewUser = false;

		if (user) {
			// Staff accounts sign in with a password only.
			if (user.role !== "customer") {
				return res.status(403).json({
					success: false,
					message: "Please sign in with your email and password.",
				});
			}
			if (user.google_id && user.google_id !== profile.googleId) {
				return res.status(409).json({
					success: false,
					message:
						"This email is linked to a different Google account.",
				});
			}
			if (!user.google_id) {
				// Existing email/password customer: link the Google account.
				await pool.query(
					"UPDATE `USER` SET google_id = ? WHERE user_id = ? AND google_id IS NULL",
					[profile.googleId, user.user_id],
				);
			}
		} else {
			user = await createGoogleUser(profile);
			isNewUser = true;
		}

		return res.status(isNewUser ? 201 : 200).json({
			success: true,
			message: isNewUser
				? "Account created with Google."
				: "Login successful.",
			isNewUser,
			token: signAuthToken(user.user_id),
			user: {
				userId: user.user_id,
				username: user.username,
				name: user.name,
				email: user.email,
				role: user.role,
				branchId: user.branch_id ?? null,
			},
		});
	} catch (error) {
		console.error("Google auth error:", error);
		return res.status(500).json({
			success: false,
			message: "Something went wrong while signing in with Google.",
		});
	}
};

/* -------------------------------- profile --------------------------------- */
// TODO (before real deployment): like the booking endpoints, these trust the
// userId sent by the client. Now that login issues a token and
// middleware/authenticate.js sets req.auth, switch these to read the user from
// req.auth instead of the request.

const parseUserId = (raw) => {
	const userId = Number(raw);
	return Number.isInteger(userId) && userId > 0 ? userId : null;
};

// USER keeps first_name and last_name separately (name = "First Last" is just
// the combined copy other pages use). Rows created before those columns existed
// have them NULL, so for those only, split `name` on the first space.
const splitName = (fullName = "") => {
	const trimmed = fullName.trim();
	const space = trimmed.indexOf(" ");
	return space === -1
		? { firstName: trimmed, lastName: "" }
		: {
				firstName: trimmed.slice(0, space),
				lastName: trimmed.slice(space + 1).trim(),
			};
};

// Booking counts for the Profile page. Cancelled purchases are not counted;
// "active" = not cancelled and the screening hasn't started yet.
const loadBookingStats = async (userId) => {
	const [[totals]] = await pool.query(
		"SELECT COUNT(*) AS total FROM TOTAL_PURCHASE WHERE user_id = ? AND status <> 'cancelled'",
		[userId],
	);
	const [[active]] = await pool.query(
		`SELECT COUNT(DISTINCT p.purchase_id) AS active
       FROM TOTAL_PURCHASE p
       JOIN TICKET t ON t.purchase_id = p.purchase_id
       JOIN SCREENING s ON s.screening_id = t.screening_id
      WHERE p.user_id = ? AND p.status <> 'cancelled'
        AND TIMESTAMP(s.show_date, s.show_time) > NOW()`,
		[userId],
	);
	return { totalBookings: totals.total, activeReservations: active.active };
};

// The profile the page shows. Never includes the password hash.
const buildProfile = async (row) => {
	const { firstName, lastName } =
		row.first_name != null
			? { firstName: row.first_name, lastName: row.last_name ?? "" }
			: splitName(row.name);
	const { phone } = normalizePhone(row.phone_num); // old signups were saved as +63...
	const stats = await loadBookingStats(row.user_id);
	return {
		userId: row.user_id,
		avatarUrl: row.profile_photo_url ?? null,
		firstName,
		lastName,
		email: row.email,
		phone: phone ?? row.phone_num ?? "",
		username: row.username,
		role: row.role,
		memberId: `FV-${String(row.user_id).padStart(5, "0")}`,
		status: "Active",
		...stats,
	};
};

// GET /api/auth/profile?userId=
const getProfile = async (req, res) => {
	const userId = parseUserId(req.query.userId);
	if (!userId) {
		return res.status(400).json({
			success: false,
			message: "userId is required and must be a positive integer.",
		});
	}

	try {
		const [rows] = await pool.query(
			"SELECT * FROM `USER` WHERE user_id = ?",
			[userId],
		);
		if (rows.length === 0) {
			return res
				.status(404)
				.json({ success: false, message: "User not found." });
		}
		return res
			.status(200)
			.json({ success: true, profile: await buildProfile(rows[0]) });
	} catch (error) {
		console.error("getProfile error:", error);
		return res
			.status(500)
			.json({ success: false, message: "Failed to load the profile." });
	}
};

// PUT /api/auth/profile
// body: { userId, firstName, lastName, email, phone, username,
//         currentPassword?, newPassword?, avatarUrl? }
// avatarUrl: omit to keep the current photo, null to remove it, or a Cloudinary
// URL returned by POST /api/upload/profile.
const updateProfile = async (req, res) => {
	const {
		firstName,
		lastName,
		email,
		phone,
		username,
		currentPassword,
		newPassword,
		avatarUrl,
	} = req.body ?? {};
	const userId = parseUserId(req.body?.userId);
	if (!userId) {
		return res.status(400).json({
			success: false,
			message: "userId is required and must be a positive integer.",
		});
	}

	const fail = (status, field, message) =>
		res.status(status).json({ success: false, field, message });

	if (!firstName?.trim())
		return fail(400, "firstName", "First name is required.");
	if (!lastName?.trim())
		return fail(400, "lastName", "Last name is required.");
	if (firstName.trim().length > MAX_NAME_PART)
		return fail(400, "firstName", "First name is too long.");
	if (lastName.trim().length > MAX_NAME_PART)
		return fail(400, "lastName", "Last name is too long.");
	if (!EMAIL_PATTERN.test((email ?? "").trim()))
		return fail(400, "email", "Enter a valid email address.");
	if (!USERNAME_PATTERN.test((username ?? "").trim())) {
		return fail(
			400,
			"username",
			"At least 3 characters: letters, numbers, underscore only.",
		);
	}
	const { phone: cleanPhone, error: phoneError } = normalizePhone(phone);
	if (phoneError) return fail(400, "phone", phoneError);
	if (newPassword && newPassword.length < MIN_PASSWORD_LENGTH) {
		return fail(
			400,
			"next",
			`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
		);
	}
	if (
		avatarUrl !== undefined &&
		avatarUrl !== null &&
		!isOurProfilePhoto(avatarUrl)
	) {
		return fail(
			400,
			"avatar",
			"Profile photo must be an image uploaded through FilmVault.",
		);
	}

	const cleanEmail = email.trim();
	const cleanUsername = username.trim();

	try {
		const [rows] = await pool.query(
			"SELECT * FROM `USER` WHERE user_id = ?",
			[userId],
		);
		if (rows.length === 0) return fail(404, null, "User not found.");
		const user = rows[0];

		// Email and username must stay unique across other accounts.
		const [clashes] = await pool.query(
			"SELECT email, username FROM `USER` WHERE (email = ? OR username = ?) AND user_id <> ?",
			[cleanEmail, cleanUsername, userId],
		);
		if (
			clashes.some(
				(row) => row.email.toLowerCase() === cleanEmail.toLowerCase(),
			)
		) {
			return fail(
				409,
				"email",
				"Another account already uses this email.",
			);
		}
		if (clashes.length > 0)
			return fail(409, "username", "That username is already taken.");

		// Changing the password needs the current one.
		let passwordHash = user.password;
		if (newPassword) {
			if (
				!currentPassword ||
				!(await bcrypt.compare(currentPassword, user.password))
			) {
				return fail(400, "current", "Current password is incorrect.");
			}
			passwordHash = await bcrypt.hash(newPassword, 10);
		}

		// Photo: keep the saved one unless avatarUrl was sent.
		const photoUrl =
			avatarUrl === undefined
				? (user.profile_photo_url ?? null)
				: avatarUrl;

		await pool.query(
			"UPDATE `USER` SET name = ?, first_name = ?, last_name = ?, email = ?, phone_num = ?, username = ?, password = ?, profile_photo_url = ? WHERE user_id = ?",
			[
				`${firstName.trim()} ${lastName.trim()}`,
				firstName.trim(),
				lastName.trim(),
				cleanEmail,
				cleanPhone,
				cleanUsername,
				passwordHash,
				photoUrl,
				userId,
			],
		);

		const [updated] = await pool.query(
			"SELECT * FROM `USER` WHERE user_id = ?",
			[userId],
		);
		return res.status(200).json({
			success: true,
			message: "Profile updated.",
			profile: await buildProfile(updated[0]),
		});
	} catch (error) {
		console.error("updateProfile error:", error);
		return res
			.status(500)
			.json({ success: false, message: "Failed to update the profile." });
	}
};

module.exports = {
	register,
	sendRegisterOtp,
	login,
	googleAuth,
	forgotPassword,
	resetPassword,
	getProfile,
	updateProfile,
};

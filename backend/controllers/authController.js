// controllers/authController.js
// Register (signup), login, and the customer profile (view + edit, including
// the profile photo). Backed by the MySQL `USER` table via config/database.js.

const bcrypt = require("bcryptjs");
const pool = require("../config/database");
const { normalizePhone } = require("../utils/phone");
const { signAuthToken } = require("../utils/authToken");
const { createOtpService } = require("../services/otpService");

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,}$/;
const MIN_PASSWORD_LENGTH = 8;

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
			"INSERT INTO `USER` (role, email, password, username, name, phone_num) VALUES (?, ?, ?, ?, ?, ?)",
			[
				"customer",
				cleanEmail,
				hashedPassword,
				cleanUsername,
				fullName,
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

/* -------------------------------- profile --------------------------------- */
// TODO (before real deployment): like the booking endpoints, these trust the
// userId sent by the client. Now that login issues a token and
// middleware/authenticate.js sets req.auth, switch these to read the user from
// req.auth instead of the request.

const parseUserId = (raw) => {
	const userId = Number(raw);
	return Number.isInteger(userId) && userId > 0 ? userId : null;
};

// The USER table stores one `name` column ("First Last"); the Profile page
// shows first and last name separately, so split on the first space.
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
	const { firstName, lastName } = splitName(row.name);
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
			"UPDATE `USER` SET name = ?, email = ?, phone_num = ?, username = ?, password = ?, profile_photo_url = ? WHERE user_id = ?",
			[
				`${firstName.trim()} ${lastName.trim()}`,
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
	getProfile,
	updateProfile,
};

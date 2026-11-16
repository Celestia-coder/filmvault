// controllers/authController.js
// Holds the actual logic for register (signup) and login.
// Now backed by the real MySQL `USER` table via config/database.js.

const bcrypt = require("bcryptjs");
const pool = require("../config/database");
const { normalizePhone } = require("../utils/phone");

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,}$/;
const MIN_PASSWORD_LENGTH = 8;

// POST /api/auth/register
const register = async (req, res) => {
  const { firstName, lastName, email, password, username, phoneNum } = req.body ?? {};

  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password || !username?.trim()) {
    return res.status(400).json({
      success: false,
      message:
        "All fields (firstName, lastName, email, password, username) are required.",
    });
  }

  const cleanEmail = email.trim();
  const cleanUsername = username.trim();

  if (!EMAIL_PATTERN.test(cleanEmail)) {
    return res.status(400).json({ success: false, field: "email", message: "Enter a valid email address." });
  }
  if (!USERNAME_PATTERN.test(cleanUsername)) {
    return res.status(400).json({
      success: false,
      field: "username",
      message: "Display name must be at least 3 characters: letters, numbers and underscores only.",
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
    return res.status(400).json({ success: false, field: "phone", message: phoneError });
  }

  try {
    const [existing] = await pool.query(
      "SELECT email, username FROM `USER` WHERE email = ? OR username = ?",
      [cleanEmail, cleanUsername]
    );

    if (existing.some((row) => row.email.toLowerCase() === cleanEmail.toLowerCase())) {
      return res.status(409).json({
        success: false,
        field: "email",
        message: "An account with this email already exists.",
      });
    }
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        field: "username",
        message: "That display name is already taken. Please choose another.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    const [result] = await pool.query(
      "INSERT INTO `USER` (role, email, password, username, name, phone_num) VALUES (?, ?, ?, ?, ?, ?)",
      ["customer", cleanEmail, hashedPassword, cleanUsername, fullName, phone]
    );

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
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required.",
    });
  }

  try {
    const [rows] = await pool.query(
      "SELECT * FROM `USER` WHERE email = ?",
      [email]
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
// userId sent by the client. Once real sessions/tokens exist, read the user
// from the verified token instead.

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
    : { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space + 1).trim() };
};

// Booking counts for the Profile page. Cancelled purchases are not counted;
// "active" = not cancelled and the screening hasn't started yet.
const loadBookingStats = async (userId) => {
  const [[totals]] = await pool.query(
    "SELECT COUNT(*) AS total FROM TOTAL_PURCHASE WHERE user_id = ? AND status <> 'cancelled'",
    [userId]
  );
  const [[active]] = await pool.query(
    `SELECT COUNT(DISTINCT p.purchase_id) AS active
       FROM TOTAL_PURCHASE p
       JOIN TICKET t ON t.purchase_id = p.purchase_id
       JOIN SCREENING s ON s.screening_id = t.screening_id
      WHERE p.user_id = ? AND p.status <> 'cancelled'
        AND TIMESTAMP(s.show_date, s.show_time) > NOW()`,
    [userId]
  );
  return { totalBookings: totals.total, activeReservations: active.active };
};

// Never includes the password hash.
const buildProfile = async (row) => {
  const { firstName, lastName } = splitName(row.name);
  const { phone } = normalizePhone(row.phone_num); // old signups were saved as +63...
  const stats = await loadBookingStats(row.user_id);
  return {
    userId: row.user_id,
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
    return res.status(400).json({ success: false, message: "userId is required and must be a positive integer." });
  }

  try {
    const [rows] = await pool.query("SELECT * FROM `USER` WHERE user_id = ?", [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    return res.status(200).json({ success: true, profile: await buildProfile(rows[0]) });
  } catch (error) {
    console.error("getProfile error:", error);
    return res.status(500).json({ success: false, message: "Failed to load the profile." });
  }
};

// PUT /api/auth/profile
// body: { userId, firstName, lastName, email, phone, username, currentPassword?, newPassword? }
const updateProfile = async (req, res) => {
  const { firstName, lastName, email, phone, username, currentPassword, newPassword } = req.body ?? {};
  const userId = parseUserId(req.body?.userId);
  if (!userId) {
    return res.status(400).json({ success: false, message: "userId is required and must be a positive integer." });
  }

  const fail = (status, field, message) => res.status(status).json({ success: false, field, message });

  if (!firstName?.trim()) return fail(400, "firstName", "First name is required.");
  if (!lastName?.trim()) return fail(400, "lastName", "Last name is required.");
  if (!EMAIL_PATTERN.test((email ?? "").trim())) return fail(400, "email", "Enter a valid email address.");
  if (!USERNAME_PATTERN.test((username ?? "").trim())) {
    return fail(400, "username", "At least 3 characters: letters, numbers, underscore only.");
  }
  const { phone: cleanPhone, error: phoneError } = normalizePhone(phone);
  if (phoneError) return fail(400, "phone", phoneError);
  if (newPassword && newPassword.length < MIN_PASSWORD_LENGTH) {
    return fail(400, "next", `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const cleanEmail = email.trim();
  const cleanUsername = username.trim();

  try {
    const [rows] = await pool.query("SELECT * FROM `USER` WHERE user_id = ?", [userId]);
    if (rows.length === 0) return fail(404, null, "User not found.");
    const user = rows[0];

    const [clashes] = await pool.query(
      "SELECT email, username FROM `USER` WHERE (email = ? OR username = ?) AND user_id <> ?",
      [cleanEmail, cleanUsername, userId]
    );
    if (clashes.some((row) => row.email.toLowerCase() === cleanEmail.toLowerCase())) {
      return fail(409, "email", "Another account already uses this email.");
    }
    if (clashes.length > 0) return fail(409, "username", "That username is already taken.");

    let passwordHash = user.password;
    if (newPassword) {
      if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password))) {
        return fail(400, "current", "Current password is incorrect.");
      }
      passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await pool.query(
      "UPDATE `USER` SET name = ?, email = ?, phone_num = ?, username = ?, password = ? WHERE user_id = ?",
      [`${firstName.trim()} ${lastName.trim()}`, cleanEmail, cleanPhone, cleanUsername, passwordHash, userId]
    );

    const [updated] = await pool.query("SELECT * FROM `USER` WHERE user_id = ?", [userId]);
    return res.status(200).json({ success: true, message: "Profile updated.", profile: await buildProfile(updated[0]) });
  } catch (error) {
    console.error("updateProfile error:", error);
    return res.status(500).json({ success: false, message: "Failed to update the profile." });
  }
};

module.exports = { register, login, getProfile, updateProfile };
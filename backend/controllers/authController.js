// controllers/authController.js
// Holds the actual logic for register (signup) and login.
// Now backed by the real MySQL `USER` table via config/database.js.

const bcrypt = require("bcryptjs");
const pool = require("../config/database");

// POST /api/auth/register
const register = async (req, res) => {
  const { firstName, lastName, email, password, username, phoneNum } = req.body;

  if (!firstName || !lastName || !email || !password || !username) {
    return res.status(400).json({
      success: false,
      message:
        "All fields (firstName, lastName, email, password, username) are required.",
    });
  }

  try {
    const [existing] = await pool.query(
      "SELECT user_id FROM `USER` WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const fullName = `${firstName} ${lastName}`;

    const [result] = await pool.query(
      "INSERT INTO `USER` (role, email, password, username, name, phone_num) VALUES (?, ?, ?, ?, ?, ?)",
      ["customer", email, hashedPassword, username, fullName, phoneNum || null]
    );

    return res.status(201).json({
      success: true,
      message: "Registration successful.",
      user: { userId: result.insertId, username, name: fullName, email },
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

module.exports = { register, login };
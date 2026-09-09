// controllers/authController.js
// Holds the actual logic for register (signup) and login.
// NOTE: No real database yet. Using a plain in-memory array to simulate
// a "users table" until Database Lead's MySQL connection is wired in.

const users = []; // temporary in-memory "database"

// POST /api/auth/register
const register = (req, res) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields (firstName, lastName, email, password) are required.",
    });
  }

  const existingUser = users.find((user) => user.email === email);
  if (existingUser) {
    return res.status(409).json({
      success: false,
      message: "An account with this email already exists.",
    });
  }

  // --- TODO: real database insert goes here once Database Lead's MySQL User table is ready ---

  // TODO: hash the password before storing (e.g. with bcrypt) — MUST fix before real deployment.
  const newUser = { firstName, lastName, email, password };
  users.push(newUser);

  return res.status(201).json({
    success: true,
    message: "Registration successful.",
    user: { firstName, lastName, email },
  });
};

// POST /api/auth/login
const login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required.",
    });
  }

  // --- TODO: real database lookup goes here once connected to MySQL ---

  // TODO: replace plain-text comparison with a hashed password check (bcrypt.compare) later.
  const matchedUser = users.find(
    (user) => user.email === email && user.password === password
  );

  if (!matchedUser) {
    return res.status(401).json({
      success: false,
      message: "Invalid email or password.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Login successful.",
    user: { firstName: matchedUser.firstName, lastName: matchedUser.lastName, email: matchedUser.email },
  });
};

module.exports = { register, login };
// server.js — entry point, starts the server

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const movieRoutes = require("./routes/movieRoutes");

const app = express();

// Allow the React frontend (running on a different port) to call this API
app.use(cors());

// Allow Express to read JSON request bodies (req.body)
app.use(express.json());

// Simple test route to confirm the server is alive
app.get("/", (req, res) => {
  res.send("FilmVault backend server is running.");
});

// Connect the auth routes — anything hitting /api/... goes here
app.use("/api/auth", authRoutes);

// Movie routes: public (/api/movies) and admin (/api/admin/movies)
app.use("/api", movieRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
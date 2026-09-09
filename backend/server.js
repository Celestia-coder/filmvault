require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");

const app = express();

// Middleware
app.use(cors()); 
app.use(express.json()); 

// Routes
app.use("/api/auth", authRoutes);

// Simple test route to confirm the server is alive
app.get("/", (req, res) => {
  res.send("FilmVault backend is up and running.");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
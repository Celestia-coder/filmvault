// config/database.js
// MySQL connection pool shared across the app.

const mysql = require("mysql2/promise");
require("dotenv").config();

const port = process.env.DB_PORT === undefined ? 3306 : Number(process.env.DB_PORT);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("DB_PORT must be a valid TCP port.");
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: ["DATE"],
});

module.exports = pool;

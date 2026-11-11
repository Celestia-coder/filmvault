// routes/snackRoutes.js
const express = require("express");
const router = express.Router();
const { getSnacks } = require("../controllers/snackController");

router.get("/snacks", getSnacks);

module.exports = router;

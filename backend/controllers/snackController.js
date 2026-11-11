// controllers/snackController.js
// GET /api/snacks - the food & drinks Checkout offers. Prices live in the SNACK table;
// the booking endpoint re-reads them itself, so a browser can never choose its own price.
const pool = require("../config/database");

const getSnacks = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT snack_id, snack_name, snack_price FROM SNACK ORDER BY snack_id");
    return res.status(200).json({
      success: true,
      snacks: rows.map((r) => ({ snack_id: r.snack_id, snack_name: r.snack_name, snack_price: Number(r.snack_price) })),
    });
  } catch (error) {
    console.error("getSnacks error:", error);
    return res.status(500).json({ success: false, code: "SERVER_ERROR", message: "Failed to fetch snacks." });
  }
};

module.exports = { getSnacks };

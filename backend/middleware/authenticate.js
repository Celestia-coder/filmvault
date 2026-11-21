// middleware/authenticate.js

const jwt = require("jsonwebtoken");
const pool = require("../config/database");

// Sets req.auth only from a verified token plus the current USER row.
// Never reads identity from the request body, query, or other headers.
async function authenticate(req, res, next) {
	const header = req.headers.authorization || "";
	const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
	if (!token || !process.env.AUTH_TOKEN_SECRET) return next();

	try {
		const payload = jwt.verify(token, process.env.AUTH_TOKEN_SECRET, {
			algorithms: ["HS256"],
		});
		const userId = Number(payload.userId);
		if (!Number.isSafeInteger(userId) || userId <= 0) return next();

		const [rows] = await pool.query(
			"SELECT user_id, role, branch_id FROM `USER` WHERE user_id = ?",
			[userId],
		);
		if (rows.length === 1) {
			const role = String(rows[0].role || "").toLowerCase();
			if (role === "admin" || role === "customer") {
				req.auth = {
					userId: Number(rows[0].user_id),
					role,
					branchId:
						role === "admin" && rows[0].branch_id != null
							? Number(rows[0].branch_id)
							: null,
				};
			}
		}
	} catch {
		// Invalid or expired token: leave req.auth unset so the email hooks skip.
	}
	next();
}

module.exports = authenticate;

// middleware/requireAdmin.js
// Blocks the request unless the verified login token (req.auth, set by the
// authenticate middleware) belongs to an admin. Use on admin-only routes.

function requireAdmin(req, res, next) {
	if (!req.auth) {
		return res
			.status(401)
			.json({ success: false, message: "Please log in as an admin." });
	}
	if (req.auth.role !== "admin") {
		return res
			.status(403)
			.json({ success: false, message: "Admin access required." });
	}
	next();
}

module.exports = requireAdmin;
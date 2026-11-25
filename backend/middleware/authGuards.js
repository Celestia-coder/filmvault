// middleware/authGuards.js
// Route guards built on req.auth, which authenticate.js sets ONLY from a verified
// login token (see server.js). Nothing here trusts a userId or branchId sent by the browser.
//
//   requireLogin     any logged-in account (customer or admin)
//   requireCustomer  logged-in customer
//   ownUserId(where) forces userId in req.query / req.body to the logged-in user, so the
//                    old controllers (which read userId from the request) can only ever
//                    act on the caller's own account
//   branchAdminOnly  logged-in admin; forces ?branchId= to the admin's own branch, so one
//                    branch can't read or change another branch's bookings or seats

const fail = (res, status, code, message) =>
	res.status(status).json({ success: false, code, message });

const requireLogin = (req, res, next) => {
	if (!req.auth)
		return fail(res, 401, "UNAUTHORIZED", "Please log in to continue.");
	next();
};

const requireCustomer = (req, res, next) => {
	if (!req.auth)
		return fail(res, 401, "UNAUTHORIZED", "Please log in to continue.");
	if (req.auth.role !== "customer")
		return fail(res, 403, "FORBIDDEN", "This is for customer accounts only.");
	next();
};

// Replaces req.query with a copy that has the given values. Works on Express 4 and 5
// (in Express 5 req.query is a read-only getter, so it can't just be assigned).
const setQuery = (req, values) => {
	Object.defineProperty(req, "query", {
		value: { ...req.query, ...values },
		writable: true,
		configurable: true,
		enumerable: true,
	});
};

// where: "query" for GET routes, "body" for POST/PUT. Use AFTER any multipart parser.
const ownUserId = (where) => (req, res, next) => {
	if (!req.auth)
		return fail(res, 401, "UNAUTHORIZED", "Please log in to continue.");
	const userId = req.auth.userId;
	if (where === "query") {
		setQuery(req, { userId: String(userId) });
	} else {
		req.body = req.body || {};
		req.body.userId = userId;
		delete req.body.user_id;
	}
	next();
};

const branchAdminOnly = (req, res, next) => {
	if (!req.auth)
		return fail(res, 401, "UNAUTHORIZED", "Please log in to continue.");
	if (req.auth.role !== "admin" || !req.auth.branchId)
		return fail(res, 403, "FORBIDDEN", "Branch admin access only.");
	setQuery(req, { branchId: String(req.auth.branchId) });
	next();
};

module.exports = { requireLogin, requireCustomer, ownUserId, branchAdminOnly };
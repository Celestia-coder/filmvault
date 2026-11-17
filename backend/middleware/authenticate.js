const { timingSafeEqual } = require("node:crypto");
const pool = require("../config/database");
const { credentialVersion, signingSecret, verifyAuthToken } = require("../utils/authToken");

function createAuthentication({ db = pool, env = process.env } = {}) {
  async function authenticate(req, res, next) {
    if (!signingSecret(env)) {
      return res.status(503).json({ success: false, message: "Authentication is unavailable." });
    }
    const match = /^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.get("authorization") || "");
    const claims = match && verifyAuthToken(match[1], env);
    if (!claims) {
      return res.status(401).json({ success: false, message: "Please sign in." });
    }
    try {
      // The token contains no role or branch entitlement. Resolve both from
      // the current USER row on every request so account changes take effect.
      const [rows] = await db.query(
        "SELECT user_id, role, branch_id, password FROM `USER` WHERE user_id = ?",
        [claims.userId],
      );
      const user = rows[0];
      const expected = Buffer.from(claims.credentialVersion, "hex");
      const current = user?.password && Buffer.from(credentialVersion(user), "hex");
      if (!user || !current || !timingSafeEqual(expected, current) ||
          !["customer", "admin"].includes(user.role)) {
        return res.status(401).json({ success: false, message: "Please sign in again." });
      }
      const branchId = user.role === "admin" && user.branch_id != null
        ? Number(user.branch_id) : null;
      if (user.role === "admin" && (!Number.isSafeInteger(branchId) || branchId < 1)) {
        return res.status(403).json({ success: false, message: "Admin branch is unavailable." });
      }
      req.auth = { userId: Number(user.user_id), role: user.role, branchId };
      return next();
    } catch {
      return res.status(503).json({ success: false, message: "Authentication is unavailable." });
    }
  }

  function requireRole(role) {
    return [authenticate, (req, res, next) => req.auth.role === role
      ? next()
      : res.status(403).json({ success: false, message: "Access denied." })];
  }

  return { authenticate, requireCustomer: requireRole("customer"), requireAdmin: requireRole("admin") };
}

const { authenticate, requireCustomer, requireAdmin } = createAuthentication();
module.exports = { createAuthentication, authenticate, requireCustomer, requireAdmin };

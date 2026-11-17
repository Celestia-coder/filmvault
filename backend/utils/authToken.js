const { createHash } = require("node:crypto");
const jwt = require("jsonwebtoken");

const ISSUER = "filmvault";
const AUDIENCE = "filmvault-api";
const TOKEN_LIFETIME_SECONDS = 15 * 60;

function signingSecret(env = process.env) {
  const secret = env.AUTH_TOKEN_SECRET;
  return typeof secret === "string" && Buffer.byteLength(secret, "utf8") >= 32
    ? secret
    : null;
}

function credentialVersion(user) {
  return createHash("sha256")
    .update(`${user.password}\0${user.role}\0${user.branch_id ?? ""}`)
    .digest("hex");
}

function issueAuthToken(user, env = process.env) {
  const secret = signingSecret(env);
  if (!secret) throw new Error("AUTH_TOKEN_SECRET must contain at least 32 bytes.");
  if (!Number.isSafeInteger(Number(user.user_id)) || Number(user.user_id) < 1 ||
      typeof user.password !== "string") throw new TypeError("Invalid user record.");
  return jwt.sign({ credentialVersion: credentialVersion(user) }, secret, {
    algorithm: "HS256", issuer: ISSUER, audience: AUDIENCE,
    subject: String(user.user_id), expiresIn: TOKEN_LIFETIME_SECONDS,
  });
}

function verifyAuthToken(token, env = process.env) {
  const secret = signingSecret(env);
  if (!secret || typeof token !== "string") return null;
  try {
    const claims = jwt.verify(token, secret, {
      algorithms: ["HS256"], issuer: ISSUER, audience: AUDIENCE,
    });
    const userId = Number(claims.sub);
    if (!Number.isSafeInteger(userId) || userId < 1 ||
        !/^[0-9a-f]{64}$/.test(claims.credentialVersion)) return null;
    return { userId, credentialVersion: claims.credentialVersion };
  } catch {
    return null;
  }
}

module.exports = { signingSecret, credentialVersion, issueAuthToken, verifyAuthToken,
  TOKEN_LIFETIME_SECONDS };

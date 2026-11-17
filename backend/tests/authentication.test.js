const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { createAuthentication } = require("../middleware/authenticate");
const { createLogin } = require("../controllers/authController");
const { issueAuthToken, verifyAuthToken, TOKEN_LIFETIME_SECONDS } = require("../utils/authToken");

const env = { AUTH_TOKEN_SECRET: "fictional-test-secret-which-is-longer-than-thirty-two-bytes" };
const customer = { user_id: 8, role: "customer", branch_id: null, password: "fictional-hash-a" };
const admin = { user_id: 9, role: "admin", branch_id: 3, password: "fictional-hash-b" };

async function withApp(users, run, configuration = env) {
  const db = { async query(_sql, [id]) { return [[users.get(id)].filter(Boolean)]; } };
  const auth = createAuthentication({ db, env: configuration });
  const app = express();
  app.get("/customer", ...auth.requireCustomer, (req, res) => res.json(req.auth));
  app.get("/admin", ...auth.requireAdmin, (req, res) => res.json(req.auth));
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    return await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function bearer(token) { return { Authorization: `Bearer ${token}` }; }

test("real login handler verifies a fictional password and issues a usable token", async () => {
  const hash = await bcrypt.hash("fictional-test-password", 4);
  const db = { async query() { return [[{ ...customer, password: hash, email: "fictional@example.invalid" }]]; } };
  const handler = createLogin({ db, env });
  const result = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ body: { email: "fictional@example.invalid", password: "fictional-test-password" } }, result);
  assert.equal(result.code, 200);
  assert.equal(result.body.user.userId, 8);
  assert.equal(verifyAuthToken(result.body.token, env).userId, 8);
  const bad = { status: result.status, json: result.json };
  await handler({ body: { email: "fictional@example.invalid", password: "wrong" } }, bad);
  assert.equal(bad.code, 401);
  assert.equal(bad.body.token, undefined);
});

test("signed customer token resolves current USER identity and no browser claims", async () => {
  const token = issueAuthToken(customer, env);
  assert.equal(verifyAuthToken(token, env).userId, 8);
  assert.equal(TOKEN_LIFETIME_SECONDS, 900);
  await withApp(new Map([[8, customer]]), async (base) => {
    const result = await fetch(`${base}/customer?userId=99&role=admin&branchId=5`, { headers: bearer(token) });
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { userId: 8, role: "customer", branchId: null });
  });
});

test("admin branch changes revoke old tokens and new login gets current branch", async () => {
  const users = new Map([[9, { ...admin }]]);
  const token = issueAuthToken(admin, env);
  users.set(9, { ...admin, branch_id: 4 });
  await withApp(users, async (base) => {
    const result = await fetch(`${base}/admin?branchId=3`, { headers: bearer(token) });
    assert.equal(result.status, 401);
    const current = await fetch(`${base}/admin?branchId=3`, {
      headers: bearer(issueAuthToken(users.get(9), env)),
    });
    assert.equal(current.status, 200);
    assert.deepEqual(await current.json(), { userId: 9, role: "admin", branchId: 4 });
  });
});

test("protected routes reject missing, forged, expired, and password-revoked tokens", async () => {
  const users = new Map([[8, customer]]);
  const good = issueAuthToken(customer, env);
  const forged = jwt.sign({ credentialVersion: "0".repeat(64) }, "wrong-secret", {
    algorithm: "HS256", issuer: "filmvault", audience: "filmvault-api", subject: "8", expiresIn: 60,
  });
  const expired = jwt.sign({ credentialVersion: "0".repeat(64), exp: 1 }, env.AUTH_TOKEN_SECRET, {
    algorithm: "HS256", issuer: "filmvault", audience: "filmvault-api", subject: "8",
  });
  await withApp(users, async (base) => {
    for (const headers of [{}, bearer(forged), bearer(expired), { "X-User-Id": "8", "X-Role": "customer" }]) {
      assert.equal((await fetch(`${base}/customer?userId=8`, { headers })).status, 401);
    }
    users.set(8, { ...customer, password: "changed-password-hash" });
    assert.equal((await fetch(`${base}/customer`, { headers: bearer(good) })).status, 401);
  });
});

test("customer and admin roles cannot cross protected routes", async () => {
  await withApp(new Map([[8, customer], [9, admin]]), async (base) => {
    assert.equal((await fetch(`${base}/admin`, { headers: bearer(issueAuthToken(customer, env)) })).status, 403);
    assert.equal((await fetch(`${base}/customer`, { headers: bearer(issueAuthToken(admin, env)) })).status, 403);
  });
});

test("missing signing secret and missing admin branch fail closed", async () => {
  await withApp(new Map([[8, customer]]), async (base) => {
    assert.equal((await fetch(`${base}/customer`, { headers: bearer(issueAuthToken(customer, env)) })).status, 503);
  }, {});
  const unassignedAdmin = { ...admin, branch_id: null };
  await withApp(new Map([[9, unassignedAdmin]]), async (base) => {
    assert.equal((await fetch(`${base}/admin`, { headers: bearer(issueAuthToken(unassignedAdmin, env)) })).status, 403);
  });
});

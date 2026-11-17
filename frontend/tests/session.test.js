import test from "node:test";
import assert from "node:assert/strict";
import { saveUser, getUser, getToken, authHeaders, clearUser, setToken } from "../src/api/session.js";

function storage() {
  const values = new Map();
  return {
    setItem(key, value) { values.set(key, value); },
    getItem(key) { return values.get(key) ?? null; },
    removeItem(key) { values.delete(key); },
  };
}

test("browser display identity alone cannot authorize API requests", () => {
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
  saveUser({ userId: 8, role: "customer" });
  assert.equal(getUser(), null);
  assert.deepEqual(authHeaders(), {});
  setToken("fictional-signed-token");
  assert.deepEqual(getUser(), { userId: 8, role: "customer" });
  assert.equal(getToken(), "fictional-signed-token");
  assert.deepEqual(authHeaders(), { Authorization: "Bearer fictional-signed-token" });
  clearUser();
  assert.equal(getUser(), null);
  assert.deepEqual(authHeaders(), {});
});

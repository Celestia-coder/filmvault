import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("checkout describes the confirmation email and where to find the QR ticket", () => {
  const checkout = readFileSync(new URL("../src/pages/client/Checkout.jsx", import.meta.url), "utf8");
  assert.match(checkout, /Your booking confirmation is sent to this account email/);
  assert.match(checkout, /we'll email your booking confirmation/);
  assert.match(checkout, /Open My Tickets\s+in FilmVault to view your e-ticket and QR code/);
  assert.doesNotMatch(checkout, /email your QR-coded ticket|QR code & booking confirmation are sent here/i);
});

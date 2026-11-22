// services/xendit.js
// Tiny client for Xendit's Invoice API (hosted payment page). Uses the secret key
// from XENDIT_SECRET_KEY; a "xnd_development_..." key means test mode, where the
// invoice page has buttons to simulate a successful payment.

const API = "https://api.xendit.co/v2/invoices";

const call = async (url, options = {}) => {
  const key = process.env.XENDIT_SECRET_KEY;
  if (!key) throw new Error("XENDIT_SECRET_KEY is not set.");
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: "Basic " + Buffer.from(key + ":").toString("base64"),
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Xendit ${res.status}: ${data.message || "request failed"}`);
  return data;
};

// amount is in pesos. externalId ties the invoice to our user (checked on verify).
const createInvoice = ({ externalId, amount, description, durationSeconds }) =>
  call(API, {
    method: "POST",
    body: JSON.stringify({
      external_id: externalId,
      amount,
      currency: "PHP",
      description,
      invoice_duration: durationSeconds,
    }),
  });

const getInvoice = (id) => call(`${API}/${encodeURIComponent(id)}`);

module.exports = { createInvoice, getInvoice };

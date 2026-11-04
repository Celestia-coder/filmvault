// services/paymentService.js
// The ONE place payment happens. createBooking() calls verifyPayment() and
// nothing else in the codebase talks to a payment provider.
//
// TODAY: it auto-passes, so every booking is "paid".
// LATER (payment simulation / a real gateway): only this function changes.
// Keep the contract the same and the booking code does not need to be touched:
//
//   verifyPayment({ userId, amount, paymentMethod })
//     -> resolves { ok: true,  transactionId? }
//     -> resolves { ok: false, reason }          (payment declined/failed)
//     -> or throws                               (treated as a failed payment)
//
// amount is the server-calculated total in pesos (a number with 2 decimals).

const verifyPayment = async ({ userId, amount, paymentMethod }) => {
  // eslint-disable-next-line no-unused-vars
  void userId, amount, paymentMethod;
  return { ok: true, transactionId: null };
};

module.exports = { verifyPayment };

// services/paymentService.js
// The ONE place payment happens. createBooking() calls verifyPayment() and
// nothing else in the booking code talks to a payment provider.
//
//   verifyPayment({ userId, amount, paymentMethod, paymentRef })
//     -> resolves { ok: true,  transactionId? }
//     -> resolves { ok: false, reason }                     (payment declined/failed)
//     -> resolves { ok: false, pending: true, invoice }     (Xendit: pay first, then retry
//                                                            the booking with paymentRef)
//     -> or throws                                          (treated as a failed payment)
//
// amount is the server-calculated total in pesos (a number with 2 decimals).
// A total of 0 is always accepted as paid without calling the provider.
//
// PAYMENT_PROVIDER=xendit turns on Xendit (test mode with a xnd_development_ key).
// Anything else keeps the old behaviour: every booking auto-passes as "paid".

const xenditClient = require("./xendit");

const PAID_STATUSES = new Set(["PAID", "SETTLED"]);
// Seats are held for 10 minutes; the invoice must not outlive the hold.
const INVOICE_SECONDS = 10 * 60;

const createVerifyPayment =
	({
		provider = () => process.env.PAYMENT_PROVIDER,
		xendit = xenditClient,
	} = {}) =>
	async ({ userId, amount, paymentRef }) => {
		// Nothing to pay (e.g. a free Taguig senior ticket): no invoice to create or check.
		// Xendit rejects a zero amount, so skip the provider entirely.
		if (!(Number(amount) > 0)) return { ok: true, transactionId: null };

		if (provider() !== "xendit") return { ok: true, transactionId: null };

		// First attempt: no invoice yet, so make one for the server's total.
		if (!paymentRef) {
			const invoice = await xendit.createInvoice({
				externalId: `filmvault-${userId}-${Date.now()}`,
				amount,
				description: "FilmVault booking",
				durationSeconds: INVOICE_SECONDS,
			});
			return {
				ok: false,
				pending: true,
				invoice: { id: invoice.id, url: invoice.invoice_url },
			};
		}

		// Retry after paying: Xendit, not the browser, says whether it was paid.
		const invoice = await xendit.getInvoice(paymentRef);
		if (!String(invoice.external_id).startsWith(`filmvault-${userId}-`))
			return {
				ok: false,
				reason: "This payment belongs to another account.",
			};
		if (!PAID_STATUSES.has(invoice.status))
			return { ok: false, reason: "Payment was not completed." };
		if (Math.round(invoice.amount * 100) !== Math.round(amount * 100))
			return {
				ok: false,
				reason: "Paid amount doesn't match the booking total.",
			};
		return { ok: true, transactionId: invoice.id };
	};

const verifyPayment = createVerifyPayment();

module.exports = { verifyPayment, createVerifyPayment };

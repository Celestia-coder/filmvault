// routes/paymentRoutes.js
// Checkout polls this while the customer pays on Xendit's page in another tab.
const express = require("express");
const router = express.Router();
const { getInvoice } = require("../services/xendit");
const { requireCustomer } = require("../middleware/authGuards");

// GET /api/payments/invoices/:id -> { success, status }  (PENDING | PAID | SETTLED | EXPIRED)
// Customers only, and only for their own invoices (paymentService names them filmvault-<userId>-...).
router.get("/payments/invoices/:id", requireCustomer, async (req, res) => {
	try {
		const invoice = await getInvoice(req.params.id);
		if (
			!String(invoice.external_id).startsWith(
				`filmvault-${req.auth.userId}-`,
			)
		) {
			return res
				.status(404)
				.json({ success: false, message: "Invoice not found." });
		}
		res.json({ success: true, status: invoice.status });
	} catch (error) {
		console.error("Invoice status error:", error.message);
		res.status(502).json({
			success: false,
			message: "Couldn't check the payment status.",
		});
	}
});

module.exports = router;

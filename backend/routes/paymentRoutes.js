// routes/paymentRoutes.js
// Checkout polls this while the customer pays on Xendit's page in another tab.
const express = require("express");
const router = express.Router();
const { getInvoice } = require("../services/xendit");

// GET /api/payments/invoices/:id -> { success, status }  (PENDING | PAID | SETTLED | EXPIRED)
router.get("/payments/invoices/:id", async (req, res) => {
	try {
		const invoice = await getInvoice(req.params.id);
		res.json({ success: true, status: invoice.status });
	} catch (error) {
		console.error("Invoice status error:", error.message);
		res.status(502).json({ success: false, message: "Couldn't check the payment status." });
	}
});

module.exports = router;

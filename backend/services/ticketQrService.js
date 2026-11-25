const { isIP } = require("node:net");
const QRCode = require("qrcode");
const pool = require("../config/database");

// Eli's ticket QR encodes /verify/<TOTAL_PURCHASE.verification_token>.
// Keep its image settings in step with frontend/src/utils/ticket.js after integration.
const QR_CID = "filmvault-ticket-qr@filmvault.invalid";
const TOKEN_PATTERN = /^[0-9a-f]{32}$/;
const TOKEN_SQL = `SELECT verification_token FROM TOTAL_PURCHASE
  WHERE purchase_id = ? AND status = 'confirmed' AND payment_status = 'paid'`;

function publicAppOrigin(value) {
	if (typeof value !== "string") return null;
	try {
		const url = new URL(value);
		const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
		if (
			url.protocol !== "https:" ||
			url.username ||
			url.password ||
			url.pathname !== "/" ||
			url.search ||
			url.hash ||
			!host.includes(".") ||
			isIP(host) ||
			host === "localhost" ||
			host.endsWith(".localhost") ||
			host.endsWith(".local") ||
			host.endsWith(".internal")
		)
			return null;
		return url.origin;
	} catch {
		return null;
	}
}

// Local development only: lets the QR point at http://localhost:<port>.
// Never accepted when NODE_ENV is "production".
function localAppOrigin(value) {
	try {
		const url = new URL(value);
		const host = url.hostname.replace(/^\[|\]$/g, "");
		if (
			!["http:", "https:"].includes(url.protocol) ||
			url.username ||
			url.password ||
			url.pathname !== "/" ||
			url.search ||
			url.hash
		)
			return null;
		if (
			host !== "localhost" &&
			host !== "127.0.0.1" &&
			!host.endsWith(".localhost")
		)
			return null;
		return url.origin;
	} catch {
		return null;
	}
}

function createTicketQrService({
	db = pool,
	env = process.env,
	renderQr = (url, options) => QRCode.toBuffer(url, options),
	log = console.error,
} = {}) {
	async function prepareForPurchase(purchaseId) {
		// These independent gates also keep manual SMTP smoke tests QR-free.
		// Each skip says why in the server log, so a missing QR is easy to trace.
		if (env.EMAIL_TICKET_QR_ENABLED !== "true") {
			log("Ticket QR skipped: set EMAIL_TICKET_QR_ENABLED=true.");
			return null;
		}
		if (env.EMAIL_TICKET_QR_PRIVACY_APPROVED !== "true") {
			log(
				"Ticket QR skipped: set EMAIL_TICKET_QR_PRIVACY_APPROVED=true.",
			);
			return null;
		}
		if (!Number.isInteger(purchaseId) || purchaseId < 1) return null;
		let origin = publicAppOrigin(env.PUBLIC_APP_ORIGIN);
		let local = false;
		if (
			!origin &&
			env.NODE_ENV !== "production" &&
			env.EMAIL_TICKET_QR_ALLOW_LOCAL_ORIGIN === "true"
		) {
			origin = localAppOrigin(env.PUBLIC_APP_ORIGIN);
			local = Boolean(origin);
		}
		if (!origin) {
			log(
				"Ticket QR skipped: PUBLIC_APP_ORIGIN must be a public https URL " +
					"(for local testing also set EMAIL_TICKET_QR_ALLOW_LOCAL_ORIGIN=true and use http://localhost:5173).",
			);
			return null;
		}

		let token;
		try {
			const [rows] = await db.query(TOKEN_SQL, [purchaseId]);
			token = rows[0]?.verification_token;
		} catch {
			// A deployment without Eli's migration still sends the ordinary email.
			log("Ticket QR lookup unavailable; confirmation will omit the QR.");
			return null;
		}
		if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) {
			log(
				`Ticket QR skipped: purchase ${purchaseId} has no verification_token (or it is not confirmed and paid).`,
			);
			return null;
		}

		const ticketUrl = `${origin}/verify/${token}`;
		try {
			const content = await renderQr(ticketUrl, {
				type: "png",
				width: 512,
				margin: 1,
				errorCorrectionLevel: "M",
			});
			if (!Buffer.isBuffer(content) || content.length === 0) return null;
			return {
				ticketUrl,
				qrImageCid: QR_CID,
				allowLocalLink: local,
				attachment: {
					filename: "filmvault-ticket-qr.png",
					content,
					contentType: "image/png",
					contentDisposition: "inline",
					cid: QR_CID,
				},
			};
		} catch {
			log(
				"Ticket QR rendering unavailable; confirmation will omit the QR.",
			);
			return null;
		}
	}

	return { prepareForPurchase };
}

module.exports = { createTicketQrService, publicAppOrigin, TOKEN_SQL, QR_CID };

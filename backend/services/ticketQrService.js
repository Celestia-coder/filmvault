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
    if (url.protocol !== "https:" || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash || !host.includes(".") ||
        isIP(host) || host === "localhost" || host.endsWith(".localhost") ||
        host.endsWith(".local") || host.endsWith(".internal")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function createTicketQrService({ db = pool, env = process.env,
  renderQr = (url, options) => QRCode.toBuffer(url, options), log = console.error } = {}) {
  async function prepareForPurchase(purchaseId) {
    // These independent gates also keep manual SMTP smoke tests QR-free.
    if (env.EMAIL_TICKET_QR_ENABLED !== "true" ||
        env.EMAIL_TICKET_QR_PRIVACY_APPROVED !== "true" ||
        !Number.isInteger(purchaseId) || purchaseId < 1) return null;
    const origin = publicAppOrigin(env.PUBLIC_APP_ORIGIN);
    if (!origin) return null;

    let token;
    try {
      const [rows] = await db.query(TOKEN_SQL, [purchaseId]);
      token = rows[0]?.verification_token;
    } catch {
      // A deployment without Eli's migration still sends the ordinary email.
      log("Ticket QR lookup unavailable; confirmation will omit the QR.");
      return null;
    }
    if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) return null;

    const ticketUrl = `${origin}/verify/${token}`;
    try {
      const content = await renderQr(ticketUrl, { type: "png", width: 512, margin: 1, errorCorrectionLevel: "M" });
      if (!Buffer.isBuffer(content) || content.length === 0) return null;
      return {
        ticketUrl,
        qrImageCid: QR_CID,
        attachment: {
          filename: "filmvault-ticket-qr.png",
          content,
          contentType: "image/png",
          contentDisposition: "inline",
          cid: QR_CID,
        },
      };
    } catch {
      log("Ticket QR rendering unavailable; confirmation will omit the QR.");
      return null;
    }
  }

  return { prepareForPurchase };
}

module.exports = { createTicketQrService, publicAppOrigin, TOKEN_SQL, QR_CID };

// utils/ticket.js
// QR code + PDF helpers for the e-ticket.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { isValidTicket, ticketVerifyUrl } from "../api/bookings.js";

// 512px source shown at ~120px (and captured at 3x for the PDF) keeps the modules sharp.
export const ticketQrDataUrl = (token) =>
  QRCode.toDataURL(ticketVerifyUrl(token), { width: 512, margin: 1, errorCorrectionLevel: "M" });

// QR image for a booking, or null while it's generating / when the ticket isn't valid.
export function useTicketQr(booking) {
  const token = isValidTicket(booking) ? booking.verificationToken : null;
  const [qr, setQr] = useState({ token: null, src: null });

  useEffect(() => {
    if (!token) return undefined;
    let live = true;
    ticketQrDataUrl(token)
      .then((src) => live && setQr({ token, src }))
      .catch((err) => console.error("QR generation failed:", err));
    return () => {
      live = false;
    };
  }, [token]);

  return qr.token === token ? qr.src : null;
}

const A4 = { w: 210, h: 297, margin: 15 }; // mm

// Renders `node` (a mounted e-ticket) to an A4 PDF and downloads it.
export async function saveTicketPdf(node, filename) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  // Cross-site posters (TMDB) can't be drawn if the browser reuses a non-CORS cached copy,
  // so re-fetch them with CORS and point the off-screen copy at a same-origin blob URL.
  const blobUrls = [];
  await Promise.all(
    [...node.querySelectorAll("img")].map(async (img) => {
      if (!/^https?:/.test(img.src) || new URL(img.src).origin === location.origin) return;
      try {
        const res = await fetch(img.src, { mode: "cors", cache: "no-cache" });
        if (!res.ok) return;
        img.src = URL.createObjectURL(await res.blob());
        blobUrls.push(img.src);
      } catch {
        // host without CORS: leave it; the poster is just missing from the PDF
      }
    })
  );
  await Promise.all([...node.querySelectorAll("img")].map((img) => img.decode().catch(() => {})));
  await document.fonts.ready;

  const canvas = await html2canvas(node, {
    scale: 3,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: 800, // desktop layout even on a phone
    // the node sits off-screen in the page; bring the copy into view so it isn't blank
    onclone: (doc) => {
      doc.querySelector(".eticket-pdf-stage").style.left = "0";
    },
  });
  blobUrls.forEach((url) => URL.revokeObjectURL(url));

  const pdf = new jsPDF({ unit: "mm", format: "a4" }); // pages are white by default

  const maxW = A4.w - A4.margin * 2;
  const maxH = A4.h - A4.margin * 2;
  const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
  const w = canvas.width * ratio;
  const h = canvas.height * ratio;
  pdf.addImage(canvas, "PNG", (A4.w - w) / 2, A4.margin, w, h); // PNG, not JPEG: keeps the QR crisp
  pdf.save(filename);
}

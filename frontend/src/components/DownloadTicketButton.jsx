// "Download Ticket" for a valid booking. Renders the e-ticket off-screen (same
// component and styles as the Ticket page) and saves it as
// FilmVault-Ticket-<reference>.pdf. Renders nothing for invalid tickets.
import { useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Download } from "lucide-react";
import ETicket from "./ETicket.jsx";
import { isValidTicket } from "../api/bookings.js";
import { saveTicketPdf, ticketQrDataUrl } from "../utils/ticket.js";
import logo from "../assets/images/logo.png";

export default function DownloadTicketButton({ booking }) {
  const [qrSrc, setQrSrc] = useState(null); // set = the off-screen copy is mounted
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stageRef = useRef(null);

  if (!isValidTicket(booking)) return null;

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const src = await ticketQrDataUrl(booking.verificationToken);
      flushSync(() => setQrSrc(src)); // mount the copy now so we can capture it
      await saveTicketPdf(stageRef.current, `FilmVault-Ticket-${booking.referenceNo}.pdf`);
    } catch (err) {
      console.error("Ticket PDF failed:", err);
      setError("Couldn't create the PDF. Please try again.");
    } finally {
      setQrSrc(null);
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="ticket-download-btn" onClick={download} disabled={busy} aria-busy={busy}>
        <Download size={16} aria-hidden="true" />
        {busy ? "Preparing PDF…" : "Download Ticket"}
      </button>
      {error && (
        <p className="ticket-download-error" role="alert">
          {error}
        </p>
      )}
      {qrSrc &&
        createPortal(
          <div ref={stageRef} className="tickets-page eticket-pdf-stage" aria-hidden="true">
            <img className="eticket-pdf-logo" src={logo} alt="" />
            <ETicket booking={booking} qrSrc={qrSrc} />
          </div>,
          document.body
        )}
    </>
  );
}

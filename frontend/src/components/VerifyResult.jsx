// The outcome of GET /api/tickets/verify/:token on the admin Ticket Verification page.
// Same verdict rules and fields as the public "/verify/:token" page (pages/client/VerifyTicket.jsx),
// which keeps its own copy so it stays untouched. Styles: Ticket.css (needs --fv-muted).
// ticket = verifyTicket() result, or null when the backend answered 404 (unknown token).
import { CircleCheck, CircleX } from "lucide-react";
import { Poster } from "./ETicket.jsx";
import { paymentMethodName } from "../api/bookings.js";
import { formatDate, formatTime } from "../api/movies.js";

const TYPE_LABELS = { Senior: "Senior Citizen" };
const BOOKING_LABELS = { confirmed: "Confirmed", pending: "Pending", cancelled: "Cancelled" };
const PAYMENT_LABELS = { paid: "Paid", pending: "Pending", failed: "Failed" };

function verdict(ticket) {
  if (ticket.valid) return "VALID TICKET";
  if (ticket.status === "cancelled") return "INVALID TICKET – BOOKING CANCELLED";
  if (ticket.paymentStatus !== "paid") return "INVALID TICKET – PAYMENT NOT CONFIRMED";
  return "INVALID TICKET – BOOKING NOT CONFIRMED";
}

function Status({ valid, children }) {
  const Icon = valid ? CircleCheck : CircleX;
  return (
    <div className={`verify-status ${valid ? "verify-status--valid" : "verify-status--invalid"}`} role="status">
      <Icon size={28} aria-hidden="true" />
      <strong>{children}</strong>
    </div>
  );
}

export default function VerifyResult({ ticket }) {
  if (!ticket) {
    return (
      <div className="eticket">
        <Status valid={false}>INVALID TICKET</Status>
        <p className="verify-note">This QR code doesn't match any FilmVault booking.</p>
      </div>
    );
  }

  const discounted = ticket.tickets.some((t) => t.type.toLowerCase() !== "regular");
  return (
    <article className="eticket">
      <Status valid={ticket.valid}>{verdict(ticket)}</Status>

      {ticket.title && (
        <div className="eticket-top">
          <Poster src={ticket.poster} title={ticket.title} />
          <div className="eticket-heading">
            <h2 className="eticket-title">{ticket.title}</h2>
          </div>
        </div>
      )}

      <div className="eticket-ref">
        <span>Reference code</span>
        <strong>{ticket.referenceNo}</strong>
      </div>

      <dl className="eticket-grid">
        <div className="eticket-grid-wide">
          <dt>Ticket owner</dt>
          <dd>{ticket.ownerName}</dd>
        </div>
        {ticket.title && (
          <>
            <div>
              <dt>Branch</dt>
              <dd>{ticket.branchName}</dd>
            </div>
            <div>
              <dt>Cinema</dt>
              <dd>Cinema {ticket.cinemaNum}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatDate(ticket.showDate)}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{formatTime(ticket.showTime)}</dd>
            </div>
            <div className="eticket-grid-wide">
              <dt>Seats &amp; ticket types</dt>
              <dd>{ticket.tickets.map((t) => `${t.seat} · ${TYPE_LABELS[t.type] ?? t.type}`).join(", ")}</dd>
            </div>
          </>
        )}
        <div>
          <dt>Payment method</dt>
          <dd>{paymentMethodName(ticket.paymentMethod)}</dd>
        </div>
        <div>
          <dt>Total paid</dt>
          <dd>₱{Number(ticket.totalPrice).toFixed(2)}</dd>
        </div>
        <div>
          <dt>Booking</dt>
          <dd>{BOOKING_LABELS[ticket.status] ?? ticket.status}</dd>
        </div>
        <div>
          <dt>Payment</dt>
          <dd>{PAYMENT_LABELS[ticket.paymentStatus] ?? ticket.paymentStatus}</dd>
        </div>
      </dl>

      {ticket.valid && discounted && (
        <p className="verify-note">Discounted ticket: check the guest's Senior Citizen / PWD ID.</p>
      )}
    </article>
  );
}

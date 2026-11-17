// Route: "/verify/:token"  (public, no login)
// What the e-ticket QR code opens. Loads GET /api/tickets/verify/:token and shows
// whether the ticket is valid right now (confirmed + paid), plus the details staff
// need to check it against the guest.
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import { CircleCheck, CircleX } from "lucide-react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { Poster } from "../../components/ETicket.jsx";
import { paymentMethodName, verifyTicket } from "../../api/bookings.js";
import { formatDate, formatTime } from "../../api/movies.js";
import "../../styles/Tickets.css";
import "../../styles/Ticket.css";

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

export default function VerifyTicket() {
  const { token } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // { message, notFound }
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    verifyTicket(token, { signal: controller.signal })
      .then(setTicket)
      .catch((err) => {
        if (err.name !== "AbortError") setError({ message: err.message, notFound: err.status === 404 });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, reloadKey]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  let body;
  if (loading) {
    body = (
      <div className="bookings-empty" role="status">
        Verifying ticket…
      </div>
    );
  } else if (error?.notFound) {
    body = (
      <div className="eticket">
        <Status valid={false}>INVALID TICKET</Status>
        <p className="verify-note">This QR code doesn't match any FilmVault booking.</p>
      </div>
    );
  } else if (error) {
    body = (
      <div className="bookings-empty bookings-empty--error" role="alert">
        <p>We couldn't verify this ticket. {error.message}</p>
        <button type="button" className="tickets-search-btn" onClick={retry}>
          Try again
        </button>
      </div>
    );
  } else {
    const discounted = ticket.tickets.some((t) => t.type.toLowerCase() !== "regular");
    body = (
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

  return (
    <>
      <Navbar />
      <main className="tickets-page">
        <header className="tickets-header">
          <h1>Ticket Verification</h1>
        </header>
        {body}
      </main>
      <Footer />
    </>
  );
}

// Route: "/tickets/:bookingId"
// The e-ticket / booking confirmation. Checkout sends people here right after a
// successful payment; the Tickets list links here too. Loads GET /api/bookings/:id.
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import ETicket from "../../components/ETicket.jsx";
import DownloadTicketButton from "../../components/DownloadTicketButton.jsx";
import { fetchBooking } from "../../api/bookings.js";
import { getUser } from "../../api/session.js";
import { useTicketQr } from "../../utils/ticket.js";
import "../../styles/Tickets.css";
import "../../styles/Ticket.css";

// key={bookingId} gives each ticket a fresh page state (loading, error) when the URL changes.
export default function Ticket() {
  const { bookingId } = useParams();
  return <TicketView key={bookingId} bookingId={bookingId} />;
}

function TicketView({ bookingId }) {
  const { state } = useLocation();
  const user = getUser();
  const userId = user?.userId;

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null); // { message, notFound }
  const [reloadKey, setReloadKey] = useState(0);
  const qrSrc = useTicketQr(booking);

  useEffect(() => {
    if (!userId) return undefined;
    const controller = new AbortController();
    fetchBooking(bookingId, userId, { signal: controller.signal })
      .then(setBooking)
      .catch((err) => {
        if (err.name !== "AbortError") setError({ message: err.message, notFound: err.status === 404 });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [bookingId, userId, reloadKey]);

  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  let body;
  if (!userId) {
    body = (
      <div className="bookings-empty">
        <p>Log in to see your ticket.</p>
        <Link className="booking-view-link" to="/login">
          Log in
        </Link>
      </div>
    );
  } else if (loading) {
    body = (
      <div className="bookings-empty" role="status">
        Loading your ticket…
      </div>
    );
  } else if (error) {
    body = (
      <div className="bookings-empty bookings-empty--error" role="alert">
        <p>{error.notFound ? "We couldn't find that ticket." : `We couldn't load your ticket. ${error.message}`}</p>
        {error.notFound ? (
          <Link className="booking-view-link" to="/tickets">
            Back to My Bookings
          </Link>
        ) : (
          <button type="button" className="tickets-search-btn" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    );
  } else {
    const cancelled = booking.status === "cancelled";

    body = (
      <>
        {state?.justBooked && !cancelled && (
          <p className="eticket-banner" role="status">
            Booking confirmed — your ticket is below.
          </p>
        )}

        <ETicket booking={booking} qrSrc={qrSrc} />

        <div className="eticket-actions">
          <DownloadTicketButton booking={booking} />
        </div>

        <p className="eticket-back">
          <Link className="booking-view-link" to="/tickets">
            ← Back to My Bookings
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="tickets-page">
        <header className="tickets-header">
          <h1>Your Ticket</h1>
          <p>Show this QR code or reference code at the cinema.</p>
        </header>
        {body}
      </main>
      <Footer />
    </>
  );
}

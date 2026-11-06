// Route: "/tickets/:bookingId"
// The e-ticket / booking confirmation. Checkout sends people here right after a
// successful payment; the Tickets list links here too. Loads GET /api/bookings/:id.
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { Film } from "lucide-react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { fetchBooking } from "../../api/bookings.js";
import { formatDate, formatTime } from "../../api/movies.js";
import { getUser } from "../../api/session.js";
import "../../styles/Tickets.css";
import "../../styles/Ticket.css";

const peso = (amount) => `₱${Number(amount).toFixed(2)}`;

const STATUS_LABELS = { confirmed: "Confirmed", pending: "Pending", cancelled: "Cancelled" };
const PAYMENT_LABELS = { paid: "Paid", pending: "Payment pending", failed: "Payment failed" };
const DISCOUNT_LABELS = { none: null, senior: "Senior Citizen discount", pwd: "PWD discount", mixed: "Senior/PWD discount" };

function Poster({ src, title }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="eticket-poster eticket-poster--placeholder" aria-hidden="true">
        <Film size={28} />
      </div>
    );
  }
  return <img className="eticket-poster" src={src} alt={`${title} poster`} onError={() => setFailed(true)} />;
}

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
    const [showDate, showTime] = booking.showDateTime.split("T");
    const discountLabel = DISCOUNT_LABELS[booking.discountType];
    const cancelled = booking.status === "cancelled";

    body = (
      <>
        {state?.justBooked && !cancelled && (
          <p className="eticket-banner" role="status">
            Booking confirmed — your ticket is below.
          </p>
        )}

        <article className={`eticket ${cancelled ? "eticket--cancelled" : ""}`}>
          <div className="eticket-top">
            <Poster src={booking.poster} title={booking.title} />
            <div className="eticket-heading">
              <span className={`booking-badge booking-badge--${booking.status}`}>
                {STATUS_LABELS[booking.status] ?? booking.status}
              </span>
              <h2 className="eticket-title">{booking.title}</h2>
              <p className="eticket-sub">
                {booking.rating ? `${booking.rating} · ` : ""}
                {booking.runtimeMins ? `${booking.runtimeMins} min` : ""}
              </p>
            </div>
          </div>

          <div className="eticket-ref">
            <span>Reference code</span>
            <strong>{booking.referenceNo}</strong>
          </div>

          <dl className="eticket-grid">
            <div>
              <dt>Branch</dt>
              <dd>{booking.branchName}</dd>
            </div>
            <div>
              <dt>Cinema</dt>
              <dd>Cinema {booking.cinemaNum}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatDate(showDate)}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>{formatTime(showTime)}</dd>
            </div>
            <div className="eticket-grid-wide">
              <dt>Seats</dt>
              <dd>{booking.seats.join(", ")}</dd>
            </div>
          </dl>

          <ul className="eticket-lines">
            {booking.tickets.map((t) => (
              <li key={t.id}>
                <span>
                  Seat {t.seat} · {t.type}
                </span>
                <span>{peso(t.price)}</span>
              </li>
            ))}
            {booking.snacks.map((x) => (
              <li key={x.id}>
                <span>
                  {x.name} × {x.quantity}
                </span>
                <span>{peso(x.subtotal)}</span>
              </li>
            ))}
            <li>
              <span>Booking fee</span>
              <span>{peso(booking.bookingFee)}</span>
            </li>
            <li className="eticket-total">
              <span>Total</span>
              <span>{peso(booking.totalPrice)}</span>
            </li>
          </ul>

          <p className="eticket-foot">
            {PAYMENT_LABELS[booking.paymentStatus] ?? booking.paymentStatus} via {booking.paymentMethod}
            {discountLabel ? ` · ${discountLabel} (ID checked at the cinema)` : ""}
            <br />
            Booked on {booking.purchasedAt}
          </p>
        </article>

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
          <p>Show this reference code at the cinema.</p>
        </header>
        {body}
      </main>
      <Footer />
    </>
  );
}

// The e-ticket card, rendered off-screen for the PDF download (DownloadTicketButton).
// The Ticket page itself shows BookingTearTicket + OrderDetails instead.
// qrSrc: the QR image (data URL); omit it for tickets that aren't valid.
import { useState } from "react";
import { Film } from "lucide-react";
import { formatDate, formatTime } from "../api/movies.js";
import { paymentMethodName } from "../api/bookings.js";
import { DISCOUNT_LABELS, PAYMENT_LABELS, STATUS_LABELS, peso } from "../utils/ticket.js";

export function Poster({ src, title }) {
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

export default function ETicket({ booking, qrSrc }) {
  const [showDate, showTime] = booking.showDateTime.split("T");
  const discountLabel = DISCOUNT_LABELS[booking.discountType];
  const cancelled = booking.status === "cancelled";

  return (
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

      <div className="eticket-bottom">
        <p className="eticket-foot">
          {PAYMENT_LABELS[booking.paymentStatus] ?? booking.paymentStatus} via {paymentMethodName(booking.paymentMethod)}
          <br />
          {discountLabel && (
            <>
              {discountLabel} (ID checked at the cinema)
              <br />
            </>
          )}
          Booked on {booking.purchasedAt}
        </p>
        {qrSrc && (
          <figure className="eticket-qr">
            <img src={qrSrc} alt={`QR code to verify ticket ${booking.referenceNo}`} width="120" height="120" />
            <figcaption>Scan to verify ticket</figcaption>
          </figure>
        )}
      </div>
    </article>
  );
}

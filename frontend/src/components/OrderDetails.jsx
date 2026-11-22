// Order details on the Ticket page: what was ordered, the prices, payment info and the
// entry QR code. Kept off the tear-off ticket so it stays easy to read.
// qrSrc: the QR image (data URL); null for tickets that aren't valid (or while it loads).
import { ReceiptText } from "lucide-react";
import { isValidTicket, paymentMethodName } from "../api/bookings.js";
import { DISCOUNT_LABELS, PAYMENT_LABELS, peso } from "../utils/ticket.js";

// "2026-11-04 10:12:33" -> "Nov 4, 2026, 10:12 AM" (shows the raw value if it can't be read)
function formatBookedOn(value) {
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function OrderDetails({ booking, qrSrc }) {
  const discountLabel = DISCOUNT_LABELS[booking.discountType];
  const cancelled = booking.status === "cancelled";

  let qr;
  if (qrSrc) {
    qr = (
      <figure className="order-qr">
        <img src={qrSrc} alt={`QR code to verify ticket ${booking.referenceNo}`} width="168" height="168" />
        <figcaption>Scan at the cinema</figcaption>
      </figure>
    );
  } else if (!isValidTicket(booking)) {
    qr = (
      <p className="order-qr-note">
        {cancelled
          ? "No QR code: this booking was cancelled."
          : "The QR code shows up once the booking is confirmed and paid."}
      </p>
    );
  }

  return (
    <section className="order-card" aria-labelledby="order-card-title">
      <header className="order-card-head">
        <h2 id="order-card-title" className="order-card-title">
          <ReceiptText size={20} aria-hidden="true" />
          Order details
        </h2>
        <p className="order-card-ref">
          Ref <strong>{booking.referenceNo}</strong>
        </p>
      </header>

      <div className="order-card-layout">
        <div>
          <h3 className="order-group">Tickets</h3>
          <ul className="order-lines">
            {booking.tickets.map((t) => (
              <li key={t.id}>
                <span className="order-item">
                  Seat {t.seat}
                  <small>{t.type}</small>
                </span>
                <span className="order-price">{peso(t.price)}</span>
              </li>
            ))}
          </ul>

          {booking.snacks.length > 0 && (
            <>
              <h3 className="order-group">Food &amp; drinks</h3>
              <ul className="order-lines">
                {booking.snacks.map((x) => (
                  <li key={x.id}>
                    <span className="order-item">
                      {x.name} × {x.quantity}
                      {x.quantity > 1 && <small>{peso(x.unitPrice)} each</small>}
                    </span>
                    <span className="order-price">{peso(x.subtotal)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <ul className="order-lines order-summary">
            <li>
              <span className="order-item">Booking fee</span>
              <span className="order-price">{peso(booking.bookingFee)}</span>
            </li>
            <li className="order-total">
              <span>Total</span>
              <span className="order-price">{peso(booking.totalPrice)}</span>
            </li>
          </ul>

          <dl className="order-pay">
            <dt>Payment</dt>
            <dd>
              {PAYMENT_LABELS[booking.paymentStatus] ?? booking.paymentStatus} via{" "}
              {paymentMethodName(booking.paymentMethod)}
            </dd>
            {discountLabel && (
              <>
                <dt>Discount</dt>
                <dd>{discountLabel} (ID checked at the cinema)</dd>
              </>
            )}
            <dt>Booked on</dt>
            <dd>{formatBookedOn(booking.purchasedAt)}</dd>
          </dl>
        </div>

        {qr}
      </div>
    </section>
  );
}

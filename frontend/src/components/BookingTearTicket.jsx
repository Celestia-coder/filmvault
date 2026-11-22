// A booking shown as a tear-off ticket on the Ticket page ("View ticket").
// The ticket carries the movie, showtime, cinema, seats and reference code.
// Prices, payment and the QR code stay in <OrderDetails> below it.
// Tearing the stub is just for fun: nothing is saved and the ticket stays valid.
import { useState, useSyncExternalStore } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import TearTicket from "./TearTicket.jsx";
import { formatDate, formatTime } from "../api/movies.js";
import { STATUS_LABELS } from "../utils/ticket.js";

// Wide screens: stub on the right. Phones: stub at the bottom, so the text stays big
// instead of the whole ticket being shrunk to fit.
const NARROW = "(max-width: 640px)";
const LAYOUTS = {
  wide: { orientation: "horizontal", width: 600, height: 290, stubSize: 190 },
  narrow: { orientation: "vertical", width: 340, height: 540, stubSize: 160 },
};

const subscribeNarrow = (onChange) => {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const isNarrow = () => window.matchMedia(NARROW).matches;

export default function BookingTearTicket({ booking }) {
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow);
  const [torn, setTorn] = useState(false);

  const cancelled = booking.status === "cancelled";
  const [showDate, showTime] = booking.showDateTime.split("T");
  const admit = booking.tickets.length || booking.ticketCount;
  const details = [booking.rating, booking.runtimeMins ? `${booking.runtimeMins} min` : ""].filter(Boolean);

  const stub = (
    <div className="fvtt-stub">
      <div className="fvtt-admit">
        <span className="fvtt-label">Admit</span>
        <strong className="fvtt-admit-num">{admit}</strong>
      </div>
      <div>
        <span className="fvtt-label">{booking.seats.length === 1 ? "Seat" : "Seats"}</span>
        <strong>{booking.seats.join(", ")}</strong>
      </div>
      <div>
        <span className="fvtt-label">Reference</span>
        <strong className="fvtt-ref">{booking.referenceNo}</strong>
      </div>
    </div>
  );

  return (
    <div className="fvtt-wrap">
      <TearTicket
        className="fvtt"
        {...(narrow ? LAYOUTS.narrow : LAYOUTS.wide)}
        image={booking.poster}
        imageAlt={`${booking.title} poster`}
        stub={stub}
        torn={torn}
        onTear={() => setTorn(true)}
        disabled={cancelled}
        ariaLabel={`Tear off the stub of ticket ${booking.referenceNo}`}
        background="#262626"
        stubBackground="#b20710"
        color="#f5f5f5"
        radius={18}
        imageRadius={10}
        holes={14}
        holeSize={7}
        notch={4}
        rotate={-2}
        tiltMax={7}
      >
        <div className="fvtt-body">
          <span className={`fvtt-badge fvtt-badge--${booking.status}`}>
            {STATUS_LABELS[booking.status] ?? booking.status}
          </span>
          <div>
            <h2 className="fvtt-title">{booking.title}</h2>
            {details.length > 0 && <p className="fvtt-sub">{details.join(" · ")}</p>}
            <ul className="fvtt-facts">
              <li>
                <CalendarDays size={16} aria-hidden="true" />
                {formatDate(showDate)} · {formatTime(showTime)}
              </li>
              <li>
                <MapPin size={16} aria-hidden="true" />
                {booking.branchName} · Cinema {booking.cinemaNum}
              </li>
            </ul>
          </div>
        </div>
      </TearTicket>

      <p className="fvtt-hint" aria-live="polite">
        {cancelled ? (
          "This booking was cancelled."
        ) : torn ? (
          <>
            Stub torn off. See you at the cinemas.
            <button type="button" onClick={() => setTorn(false)}>
              Put it back
            </button>
          </>
        ) : (
          "Drag the red stub to tear it off — just for fun."
        )}
      </p>
    </div>
  );
}

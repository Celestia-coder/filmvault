// Route: "/booking/:movieId/seats" — reached from ShowtimeSelection's

import { useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import heroBg from "../../assets/images/hero-bg.png";
import "../../styles/SeatSelection.css";

const IconMapPin = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IconCalendar = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
const IconClock = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);
const IconTicket = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v2M13 17v2M13 11v2" />
  </svg>
);
const IconLock = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/* ---------------------------------------------------------------- */
/* Data — hardcoded seat map, matches the Figma layout              */
/* ---------------------------------------------------------------- */
// TODO: reserved seats are hardcoded for now since there's no backend
// yet — once real showtime/seat data exists, this should come from
// whatever seat-availability endpoint gets built.
const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const LEFT_SEATS = [1, 2, 3, 4, 5];
const RIGHT_SEATS = [6, 7, 8, 9, 10];

const RESERVED_SEATS = new Set(["A3", "A4", "D6", "D7", "D8", "D9", "D10"]);

const MIN_TICKETS = 1;
const MAX_TICKETS = 8;

function formatSidebarDate(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

function SeatButton({ seatId, number, status, isSelected, onToggle }) {
  const isReserved = status === "reserved";

  return (
    <button
      type="button"
      className={
        `seat-circle seat-circle--${status}` + (isSelected ? " is-selected" : "")
      }
      disabled={isReserved}
      aria-pressed={isSelected}
      aria-label={`Seat ${seatId}, ${isSelected ? "selected" : status}`}
      title={`${seatId} · ${isReserved ? "Reserved" : "Available"}`}
      onClick={() => onToggle(seatId)}
    >
      {number}
    </button>
  );
}

/* ---------------------------------------------------------------- */
/* Page                                                             */
/* ---------------------------------------------------------------- */
function SeatSelection() {
  const { movieId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    movieTitle = "Selected Movie",
    branch = null,
    date = null,
    showtime = null,
    ticketCount: initialTicketCount,
    seats: initialSeats,
  } = location.state || {};

  const [ticketCount, setTicketCount] = useState(initialTicketCount ?? 2);
  const [selectedSeats, setSelectedSeats] = useState(initialSeats ?? []); // e.g. ["H7", "H8"]

  const handleDecreaseTickets = () => {
    const next = Math.max(MIN_TICKETS, ticketCount - 1);
    setTicketCount(next);
    // Trim excess selected seats so selection never exceeds the new count.
    setSelectedSeats((seats) => seats.slice(0, next));
  };

  const handleIncreaseTickets = () => {
    setTicketCount((prev) => Math.min(MAX_TICKETS, prev + 1));
  };

  const toggleSeat = (seatId) => {
    if (RESERVED_SEATS.has(seatId)) return;

    setSelectedSeats((prev) => {
      if (prev.includes(seatId)) {
        return prev.filter((s) => s !== seatId);
      }
      if (prev.length >= ticketCount) return prev;
      return [...prev, seatId];
    });
  };

  const seatsRemaining = ticketCount - selectedSeats.length;
  const canCheckout = seatsRemaining === 0;

  const sortedSelectedSeats = useMemo(
    () => [...selectedSeats].sort(),
    [selectedSeats]
  );

  const handleCheckout = () => {
    if (!canCheckout) return;
    navigate("/checkout", {
      state: {
        movieId,
        movieTitle,
        branch,
        date,
        showtime,
        ticketCount,
        seats: sortedSelectedSeats,
      },
    });
  };

  const renderSeat = (row, number) => {
    const seatId = `${row}${number}`;
    return (
      <SeatButton
        key={seatId}
        seatId={seatId}
        number={number}
        status={RESERVED_SEATS.has(seatId) ? "reserved" : "available"}
        isSelected={selectedSeats.includes(seatId)}
        onToggle={toggleSeat}
      />
    );
  };

  return (
    <div className="seat-page">
      <div className="seat-bg" style={{ backgroundImage: `url(${heroBg})` }}></div>

      <section className="seat-hero">
        <Navbar />

        <div className="seat-page-header">
          <div className="seat-heading-block">
            <h1 className="seat-heading">Select Your Seats</h1>
            <p className="seat-subtext">Choose the seat you'd like to watch the movie.</p>
          </div>
          <button type="button" className="seat-btn-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>

        <div className="seat-layout">
          <div className="seat-main">
            {/* Tickets */}
            <section className="seat-panel" aria-label="Tickets">
              <header className="seat-panel-head">
                <span className="seat-panel-icon">
                  <IconTicket width={20} height={20} />
                </span>
                <h3 className="seat-panel-title">TICKETS</h3>
              </header>

              <div className="seat-panel-body seat-ticket-row">
                <div>
                  <p className="seat-ticket-label">Number of tickets</p>
                  <p className="seat-ticket-sublabel">
                    Maximum {MAX_TICKETS} tickets per booking
                  </p>
                </div>
                <div className="seat-stepper">
                  <button
                    type="button"
                    className="seat-stepper-btn"
                    onClick={handleDecreaseTickets}
                    disabled={ticketCount <= MIN_TICKETS}
                    aria-label="Decrease tickets"
                  >
                    −
                  </button>
                  <span className="seat-stepper-value">{ticketCount}</span>
                  <button
                    type="button"
                    className="seat-stepper-btn"
                    onClick={handleIncreaseTickets}
                    disabled={ticketCount >= MAX_TICKETS}
                    aria-label="Increase tickets"
                  >
                    +
                  </button>
                </div>
              </div>
            </section>

            {/* Seat map */}
            <section className="seat-panel" aria-label="Seat map">
              <header className="seat-panel-head">
                <span className="seat-panel-icon">
                  <IconTicket width={20} height={20} />
                </span>
                <h3 className="seat-panel-title">SELECT SEATS</h3>
              </header>

              <ul className="seat-legend">
                <li>
                  <span className="seat-circle seat-circle--available seat-legend-swatch" />
                  Available
                </li>
                <li>
                  <span className="seat-circle seat-circle--reserved seat-legend-swatch" />
                  Reserved
                </li>
                <li>
                  <span className="seat-circle seat-circle--available is-selected seat-legend-swatch" />
                  Selected
                </li>
              </ul>

              <div className="seat-map-scroll">
                <div
                  className="seat-map"
                  style={{
                    "--seat-per-row": LEFT_SEATS.length + RIGHT_SEATS.length,
                    "--seat-left-cols": LEFT_SEATS.length,
                    "--seat-right-cols": RIGHT_SEATS.length,
                  }}
                >
                  <div className="seat-screen">
                    <div className="seat-screen-bar" />
                    <span>Screen</span>
                  </div>

                  {ROWS.map((row) => (
                    <div className="seat-row" key={row}>
                      <span className="seat-row-label">{row}</span>

                      <div className="seat-group seat-group--left">
                        {LEFT_SEATS.map((num) => renderSeat(row, num))}
                      </div>

                      <div className="seat-group seat-group--right">
                        {RIGHT_SEATS.map((num) => renderSeat(row, num))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Sidebar — Booking Summary */}
          <aside className="seat-panel seat-sidebar" aria-label="Booking summary">
            <header className="seat-panel-head">
              <span className="seat-panel-icon">
                <IconTicket width={20} height={20} />
              </span>
              <h3 className="seat-panel-title">Booking Summary</h3>
            </header>

            <div className="seat-panel-body">
              <p className="seat-sidebar-label">SHOWTIME</p>

              <div className="seat-summary-row">
                <span className="seat-summary-icon"><IconMapPin /></span>
                <span className="seat-summary-label">Branch</span>
                <span className={"seat-summary-value" + (branch ? "" : " unset")}>
                  {branch ? branch.name : "Not selected"}
                </span>
              </div>

              <div className="seat-summary-row">
                <span className="seat-summary-icon"><IconTicket /></span>
                <span className="seat-summary-label">Cinema</span>
                <span className={"seat-summary-value" + (showtime ? "" : " unset")}>
                  {showtime ? showtime.hall : "Not selected"}
                </span>
              </div>

              <div className="seat-summary-row">
                <span className="seat-summary-icon"><IconCalendar /></span>
                <span className="seat-summary-label">Date</span>
                <span className={"seat-summary-value" + (date ? "" : " unset")}>
                  {date ? formatSidebarDate(date) : "Not selected"}
                </span>
              </div>

              <div className="seat-summary-row">
                <span className="seat-summary-icon"><IconClock /></span>
                <span className="seat-summary-label">Time</span>
                <span className={"seat-summary-value" + (showtime ? "" : " unset")}>
                  {showtime ? showtime.time : "Not selected"}
                </span>
              </div>

              <div className="seat-summary-row">
                <span className="seat-summary-icon"><IconTicket /></span>
                <span className="seat-summary-label">Tickets</span>
                <span className="seat-summary-value">{ticketCount}</span>
              </div>

              <p className="seat-sidebar-label">SELECTED SEATS</p>
              <div className="seat-chips">
                {sortedSelectedSeats.length === 0 ? (
                  <span className="seat-chip seat-chip--empty">None selected</span>
                ) : (
                  sortedSelectedSeats.map((seatId) => (
                    <span className="seat-chip" key={seatId}>{seatId}</span>
                  ))
                )}
              </div>

              <button
                type="button"
                className="seat-checkout-btn"
                disabled={!canCheckout}
                onClick={handleCheckout}
              >
                <IconLock /> Proceed to Checkout
              </button>

              <p className="seat-checkout-hint">
                {canCheckout
                  ? "You're all set!"
                  : `Select ${seatsRemaining} more seat${seatsRemaining === 1 ? "" : "s"} to continue`}
              </p>
            </div>
          </aside>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default SeatSelection;
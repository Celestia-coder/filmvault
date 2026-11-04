// Route: "/booking/:movieId/seats" — reached from ShowtimeSelection's
// "Continue to Seats" button, which passes branch/date/showtime via
// route state.
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
/* Data — hardcoded seat map             */
/* ---------------------------------------------------------------- */
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

/* ---------------------------------------------------------------- */
/* Page                                                              */
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
  } = location.state || {};

  const [ticketCount, setTicketCount] = useState(2);
  const [selectedSeats, setSelectedSeats] = useState([]); 

  const handleDecreaseTickets = () => {
    setTicketCount((prev) => {
      const next = Math.max(MIN_TICKETS, prev - 1);
      setSelectedSeats((seats) => seats.slice(0, next));
      return next;
    });
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
    navigate(`/booking/${movieId}/checkout`, {
      state: {
        movieId,
        movieTitle,
        branch,
        date,
        showtime,
        ticketCount,
        selectedSeats: sortedSelectedSeats,
      },
    });
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
          <button type="button" className="btn-back-top" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>

        <div className="seat-layout">
          <div className="seat-main">
            {/* Tickets */}
            <div className="step-card">
              <div className="step-header">
                <span className="step-icon"><IconTicket /></span>
                <p className="step-title">TICKETS</p>
              </div>
              <div className="ticket-stepper-row">
                <div>
                  <p className="ticket-label">Number of tickets</p>
                  <p className="ticket-sublabel">Maximum {MAX_TICKETS} tickets per booking</p>
                </div>
                <div className="ticket-stepper">
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={handleDecreaseTickets}
                    disabled={ticketCount <= MIN_TICKETS}
                    aria-label="Decrease tickets"
                  >
                    −
                  </button>
                  <span className="stepper-value">{ticketCount}</span>
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={handleIncreaseTickets}
                    disabled={ticketCount >= MAX_TICKETS}
                    aria-label="Increase tickets"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Seat map */}
            <div className="step-card">
              <div className="step-header">
                <span className="step-icon"><IconTicket /></span>
                <p className="step-title">SELECT SEATS</p>
              </div>

              <div className="seat-legend">
                <span className="legend-item">
                  <span className="legend-dot legend-available"></span> Available
                </span>
                <span className="legend-item">
                  <span className="legend-dot legend-reserved"></span> Reserved
                </span>
                <span className="legend-item">
                  <span className="legend-dot legend-selected"></span> Selected
                </span>
              </div>

              <div className="screen-bar"></div>
              <p className="screen-label">SCREEN</p>

              <div className="seat-grid">
                {ROWS.map((row) => (
                  <div className="seat-row" key={row}>
                    <span className="row-label">{row}</span>

                    <div className="seat-block">
                      {LEFT_SEATS.map((num) => {
                        const seatId = `${row}${num}`;
                        const isReserved = RESERVED_SEATS.has(seatId);
                        const isSelected = selectedSeats.includes(seatId);
                        return (
                          <button
                            type="button"
                            key={seatId}
                            className={
                              "seat-btn" +
                              (isReserved ? " reserved" : "") +
                              (isSelected ? " selected" : "")
                            }
                            disabled={isReserved}
                            onClick={() => toggleSeat(seatId)}
                            aria-label={`Seat ${seatId}`}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>

                    <div className="seat-block">
                      {RIGHT_SEATS.map((num) => {
                        const seatId = `${row}${num}`;
                        const isReserved = RESERVED_SEATS.has(seatId);
                        const isSelected = selectedSeats.includes(seatId);
                        return (
                          <button
                            type="button"
                            key={seatId}
                            className={
                              "seat-btn" +
                              (isReserved ? " reserved" : "") +
                              (isSelected ? " selected" : "")
                            }
                            disabled={isReserved}
                            onClick={() => toggleSeat(seatId)}
                            aria-label={`Seat ${seatId}`}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar — Booking Summary */}
          <div className="seat-sidebar">
            <div className="sidebar-header">
              <span className="sidebar-icon"><IconTicket /></span>
              <p className="sidebar-title">Booking Summary</p>
            </div>

            <p className="sidebar-section-label">SHOWTIME</p>

            <div className="summary-row">
              <span className="summary-icon"><IconMapPin /></span>
              <span className="summary-label">Branch</span>
              <span className={"summary-value" + (branch ? "" : " unset")}>
                {branch ? branch.name : "Not selected"}
              </span>
            </div>

            <div className="summary-row">
              <span className="summary-icon"><IconTicket /></span>
              <span className="summary-label">Cinema</span>
              <span className={"summary-value" + (showtime ? "" : " unset")}>
                {showtime ? showtime.hall : "Not selected"}
              </span>
            </div>

            <div className="summary-row">
              <span className="summary-icon"><IconCalendar /></span>
              <span className="summary-label">Date</span>
              <span className={"summary-value" + (date ? "" : " unset")}>
                {date ? formatSidebarDate(date) : "Not selected"}
              </span>
            </div>

            <div className="summary-row">
              <span className="summary-icon"><IconClock /></span>
              <span className="summary-label">Time</span>
              <span className={"summary-value" + (showtime ? "" : " unset")}>
                {showtime ? showtime.time : "Not selected"}
              </span>
            </div>

            <div className="summary-row">
              <span className="summary-icon"><IconTicket /></span>
              <span className="summary-label">Tickets</span>
              <span className="summary-value">{ticketCount}</span>
            </div>

            <p className="sidebar-section-label">SELECTED SEATS</p>
            <div className="selected-seats-chips">
              {sortedSelectedSeats.length === 0 ? (
                <span className="chip chip-empty">None selected</span>
              ) : (
                sortedSelectedSeats.map((seatId) => (
                  <span className="chip" key={seatId}>{seatId}</span>
                ))
              )}
            </div>

            <button
              type="button"
              className="btn-checkout"
              disabled={!canCheckout}
              onClick={handleCheckout}
            >
              <IconLock /> Proceed to Checkout
            </button>

            <p className="checkout-hint">
              {canCheckout
                ? "You're all set!"
                : `Select ${seatsRemaining} more seat${seatsRemaining === 1 ? "" : "s"} to continue`}
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default SeatSelection;
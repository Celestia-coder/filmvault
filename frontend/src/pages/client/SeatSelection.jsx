// SeatSelection.jsx
// Route: "/booking/:movieId/seats"

// Reached from ShowtimeSelection ("Continue to Seats"), which passes the picks in route state.
// Next page: "/checkout" (gets the held seats and the exact hold expiry in route state).
//
// API (via api/seats.js):
//   GET  /api/showtimes/:id/seats       -> loads the seat map
//   POST /api/showtimes/:id/seats/hold  -> holds the chosen seats for 10 minutes

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import heroBg from "../../assets/images/hero-bg.png";
import { fetchSeatMap, holdSeats } from "../../api/seats.js";
import { getUser } from "../../api/session.js";
import "../../styles/SeatSelection.css";
import "../../styles/BookingStates.css";

/* ---------------------------------------------------------------- */
/* Icons                                                            */
/* ---------------------------------------------------------------- */

// Shared SVG wrapper. Pass width/height to change the size.
const Icon = ({ children, ...props }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    {children}
  </svg>
);

const IconMapPin = (props) => (
  <Icon {...props}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </Icon>
);
const IconCalendar = (props) => (
  <Icon {...props}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Icon>
);
const IconClock = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </Icon>
);
const IconTicket = (props) => (
  <Icon {...props}>
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v2M13 17v2M13 11v2" />
  </Icon>
);
const IconLock = (props) => (
  <Icon {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Icon>
);

/* ---------------------------------------------------------------- */
/* Constants and helpers                                            */
/* ---------------------------------------------------------------- */

const MIN_TICKETS = 1;
const MAX_TICKETS = 8;

// Text shown to screen readers and in tooltips for each seat status.
const STATUS_TEXT = {
  available: "Available",
  held: "Held by someone else",
  booked: "Booked",
  blocked: "Not available",
};

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Formats a date for the sidebar, e.g. "FRI, Mar 7". Returns null if no date. 
function formatSidebarDate(date) {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}

// Joins labels into a sentence: "A3" / "A3 and A4" / "A3, A4 and A5". 
function joinLabels(labels) {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

// A seat can be picked if it is free, or if the current user already holds it
// (for example, when they come back from Checkout).

const isSelectable = (seat) => seat.status === "available" || seat.heldByYou;

/* ---------------------------------------------------------------- */
/* Small components                                                 */
/* ---------------------------------------------------------------- */

// Message box for loading, error and empty states. 
function StateBox({ tone = "info", title, children }) {
  return (
    <div className={`seat-state seat-state--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <p className="seat-state-title">{title}</p>
      {children}
    </div>
  );
}

// Header bar used at the top of each panel. 
function PanelHead({ title }) {
  return (
    <header className="seat-panel-head">
      <span className="seat-panel-icon">
        <IconTicket width={20} height={20} />
      </span>
      <h3 className="seat-panel-title">{title}</h3>
    </header>
  );
}

// One row in the booking summary. Shows "Not selected" when there is no value. 
function SummaryRow({ icon, label, value }) {
  return (
    <div className="seat-summary-row">
      <span className="seat-summary-icon">{icon}</span>
      <span className="seat-summary-label">{label}</span>
      <span className={"seat-summary-value" + (value ? "" : " unset")}>
        {value || "Not selected"}
      </span>
    </div>
  );
}

// A single clickable seat. Held, booked and blocked seats are disabled. 
function SeatButton({ seat, isSelected, onToggle }) {
  const unavailable = !isSelectable(seat);
  // Held, booked and blocked seats all use the "reserved" look.
  const visualStatus = unavailable ? "reserved" : "available";
  const statusText = isSelected ? "Selected" : seat.heldByYou ? "Held for you" : STATUS_TEXT[seat.status];

  return (
    <button
      type="button"
      className={`seat-circle seat-circle--${visualStatus}` + (isSelected ? " is-selected" : "")}
      disabled={unavailable}
      aria-pressed={isSelected}
      aria-label={`Seat ${seat.label}, ${statusText}`}
      title={`${seat.label} · ${statusText}`}
      onClick={() => onToggle(seat.id)}
    >
      {seat.number}
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

  // Booking details passed from the previous page.
  const bookingState = location.state || {};
  const {
    movieTitle = "Selected Movie",
    branch = null,
    date = null,
    showtime = null,
    ticketCount: initialTicketCount,
    seats: initialSeats,
  } = bookingState;
  const showtimeId = showtime?.id ?? bookingState.showtimeId ?? null;

  const [ticketCount, setTicketCount] = useState(initialTicketCount ?? MIN_TICKETS);
  const [selectedIds, setSelectedIds] = useState([]); // seat ids, e.g. [41, 42]

  const [seatMap, setSeatMap] = useState(null); // { cinema, seats }
  const [loadState, setLoadState] = useState(showtimeId ? "loading" : "no-showtime");
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0); // change it to reload the seat map

  const [holding, setHolding] = useState(false);
  const [holdError, setHoldError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  // Seats picked earlier (e.g. coming back from Checkout), as labels like "H7".
  const initialSeatsRef = useRef(initialSeats);

  // Fetches the seat map from the API and saves it in state. 
  const loadSeats = useCallback(
    async (signal) => {
      const map = await fetchSeatMap(showtimeId, { userId: getUser()?.userId, signal });
      setSeatMap(map);
      return map;
    },
    [showtimeId]
  );

  // Load the seat map, then re-select any seats picked earlier.
  useEffect(() => {
    if (!showtimeId) return undefined;
    const controller = new AbortController();
    setLoadState("loading");

    loadSeats(controller.signal)
      .then((map) => {
        const wanted = new Set(initialSeatsRef.current ?? []);
        if (wanted.size > 0) {
          setSelectedIds(map.seats.filter((s) => wanted.has(s.label) && isSelectable(s)).map((s) => s.id));
        }
        setLoadState("ready");
      })
      .catch((error) => {
        if (error.name === "AbortError") return; // page was left, ignore
        setLoadError(error.message);
        setLoadState(error.status === 404 ? "not-found" : "error");
      });

    return () => controller.abort();
  }, [showtimeId, loadSeats, reloadKey]);

  // Quick lookup: seat id -> seat.
  const seatsById = useMemo(
    () => new Map((seatMap?.seats ?? []).map((seat) => [seat.id, seat])),
    [seatMap]
  );

  // Seats grouped by row letter, sorted by seat number.
  const rows = useMemo(() => {
    const byRow = new Map();
    (seatMap?.seats ?? []).forEach((seat) => {
      if (!byRow.has(seat.row)) byRow.set(seat.row, []);
      byRow.get(seat.row).push(seat);
    });
    return [...byRow.entries()].map(([row, seats]) => ({
      row,
      seats: seats.sort((a, b) => a.number - b.number),
    }));
  }, [seatMap]);

  // Each row is split into a left and right block at the aisle.
  // The API doesn't send an aisle yet (aisleAfter is null), so we split in the middle.
  const seatsPerRow = seatMap?.cinema?.seatsPerRow ?? 0;
  const leftCount = seatMap?.cinema?.aisleAfter ?? Math.ceil(seatsPerRow / 2);

  // Selected seat objects, sorted by row then seat number.
  const selectedSeats = useMemo(
    () =>
      selectedIds
        .map((id) => seatsById.get(id))
        .filter(Boolean)
        .sort((a, b) => a.rowNum - b.rowNum || a.number - b.number),
    [selectedIds, seatsById]
  );

  const seatsRemaining = ticketCount - selectedSeats.length;
  const canCheckout = loadState === "ready" && seatsRemaining === 0 && !holding;

  // Lowers the ticket count and drops extra selected seats. 
  const handleDecreaseTickets = () => {
    const next = Math.max(MIN_TICKETS, ticketCount - 1);
    setTicketCount(next);
    setSelectedIds((ids) => ids.slice(0, next));
  };

  // Raises the ticket count (up to MAX_TICKETS). 
  const handleIncreaseTickets = () => {
    setTicketCount((prev) => Math.min(MAX_TICKETS, prev + 1));
  };

  // Selects or unselects a seat. Ignores clicks once all tickets have a seat. 
  const toggleSeat = (seatId) => {
    const seat = seatsById.get(seatId);
    if (!seat || !isSelectable(seat)) return;
    setHoldError("");

    setSelectedIds((prev) => {
      if (prev.includes(seatId)) return prev.filter((id) => id !== seatId);
      if (prev.length >= ticketCount) return prev;
      return [...prev, seatId];
    });
  };

  // Holds the chosen seats, then goes to Checkout.
  // If someone else took a seat first, it removes that seat and refreshes the map.

  const handleCheckout = async () => {
    if (!canCheckout) return;

    // Only logged-in users can hold seats.
    const user = getUser();
    if (!user?.userId) {
      setNeedsLogin(true);
      setHoldError("Please log in to hold your seats.");
      return;
    }

    setNeedsLogin(false);
    setHoldError("");
    setHolding(true);

    const seatIds = selectedSeats.map((seat) => seat.id);
    const labels = selectedSeats.map((seat) => seat.label);

    try {
      const hold = await holdSeats(showtimeId, { userId: user.userId, seatIds });

      navigate("/checkout", {
        state: {
          ...bookingState,
          movieId,
          movieTitle,
          branch,
          date,
          showtime,
          showtimeId,
          ticketCount,
          seats: labels, // labels like "H7", for display
          seatIds, // ids, for the booking request
          holdSeconds: hold.expiresInSeconds,
          holdExpiresAt: Date.now() + hold.expiresInSeconds * 1000,
        },
      });
    } catch (error) {
      if (error.status === 409 && Array.isArray(error.data?.failedSeats)) {
        // Someone got there first: tell the user which seats, drop them
        // from the selection, and refresh the map so they show as taken.
        const failedIds = new Set(error.data.failedSeats.map((f) => f.seatId));
        const failedLabels = selectedSeats.filter((s) => failedIds.has(s.id)).map((s) => s.label);
        setSelectedIds((ids) => ids.filter((id) => !failedIds.has(id)));
        setHoldError(
          `${joinLabels(failedLabels)} ${failedLabels.length === 1 ? "was" : "were"} just taken by someone else. ` +
            "We've refreshed the seat map, so please pick another seat."
        );
        try {
          await loadSeats();
        } catch {
          // Keep the old map. The error message above already explains what happened.
        }
      } else {
        setHoldError(error.message);
      }
    } finally {
      setHolding(false);
    }
  };

  // Renders one seat button. 
  const renderSeat = (seat) => (
    <SeatButton
      key={seat.id}
      seat={seat}
      isSelected={selectedIds.includes(seat.id)}
      onToggle={toggleSeat}
    />
  );

  // Renders the seat map, or a message for the loading, error and empty states. 
  const renderSeatMap = () => {
    if (loadState === "loading") {
      return <StateBox title="Loading seat map…">One moment while we check which seats are free.</StateBox>;
    }
    if (loadState === "no-showtime") {
      return (
        <StateBox tone="error" title="We lost track of your showtime.">
          <p>Please go back and pick a showtime again.</p>
          <button type="button" className="seat-btn-back" onClick={() => navigate(`/booking/${movieId}`)}>
            ← Pick a showtime
          </button>
        </StateBox>
      );
    }
    if (loadState === "not-found") {
      return (
        <StateBox tone="error" title="That showtime no longer exists.">
          <button type="button" className="seat-btn-back" onClick={() => navigate(`/booking/${movieId}`)}>
            ← Pick another showtime
          </button>
        </StateBox>
      );
    }
    if (loadState === "error") {
      return (
        <StateBox tone="error" title="Couldn't load the seat map.">
          <p>{loadError}</p>
          <button type="button" className="seat-btn-back" onClick={() => setReloadKey((k) => k + 1)}>
            Try again
          </button>
        </StateBox>
      );
    }
    if (rows.length === 0) {
      return (
        <StateBox title="No seats to show.">
          <p>This cinema doesn't have a seat layout set up yet.</p>
        </StateBox>
      );
    }

    return (
      <div className="seat-map-scroll">
        <div
          className="seat-map"
          style={{
            "--seat-per-row": seatsPerRow,
            "--seat-left-cols": leftCount,
            "--seat-right-cols": seatsPerRow - leftCount,
          }}
        >
          <div className="seat-screen">
            <div className="seat-screen-bar" />
            <span>Screen</span>
          </div>

          {rows.map(({ row, seats }) => (
            <div className="seat-row" key={row}>
              <span className="seat-row-label">{row}</span>

              <div className="seat-group seat-group--left">
                {seats.filter((seat) => seat.number <= leftCount).map(renderSeat)}
              </div>

              <div className="seat-group seat-group--right">
                {seats.filter((seat) => seat.number > leftCount).map(renderSeat)}
              </div>
            </div>
          ))}
        </div>
      </div>
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
          <button type="button" className="seat-btn-back" onClick={() => navigate(`/booking/${movieId}`)}>
            ← Back
          </button>
        </div>

        <div className="seat-layout">
          <div className="seat-main">
            {/* Tickets */}
            <section className="seat-panel" aria-label="Tickets">
              <PanelHead title="TICKETS" />

              <div className="seat-panel-body seat-ticket-row">
                <div>
                  <p className="seat-ticket-label">Number of tickets</p>
                  <p className="seat-ticket-sublabel">Maximum {MAX_TICKETS} tickets per booking</p>
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
              <PanelHead title="SELECT SEATS" />

              <ul className="seat-legend">
                <li>
                  <span className="seat-circle seat-circle--available seat-legend-swatch" />
                  Available
                </li>
                <li>
                  <span className="seat-circle seat-circle--reserved seat-legend-swatch" />
                  Unavailable
                </li>
                <li>
                  <span className="seat-circle seat-circle--available is-selected seat-legend-swatch" />
                  Selected
                </li>
              </ul>

              {renderSeatMap()}
            </section>
          </div>

          {/* Sidebar: Booking Summary */}
          <aside className="seat-panel seat-sidebar" aria-label="Booking summary">
            <PanelHead title="Booking Summary" />

            <div className="seat-panel-body">
              <p className="seat-sidebar-label">SHOWTIME</p>

              <SummaryRow icon={<IconMapPin />} label="Branch" value={branch?.name} />
              <SummaryRow icon={<IconTicket />} label="Cinema" value={showtime?.hall} />
              <SummaryRow icon={<IconCalendar />} label="Date" value={formatSidebarDate(date)} />
              <SummaryRow icon={<IconClock />} label="Time" value={showtime?.time} />
              <SummaryRow icon={<IconTicket />} label="Tickets" value={ticketCount} />

              <p className="seat-sidebar-label">SELECTED SEATS</p>
              <div className="seat-chips">
                {selectedSeats.length === 0 ? (
                  <span className="seat-chip seat-chip--empty">None selected</span>
                ) : (
                  selectedSeats.map((seat) => (
                    <span className="seat-chip" key={seat.id}>{seat.label}</span>
                  ))
                )}
              </div>

              <button
                type="button"
                className="seat-checkout-btn"
                disabled={!canCheckout}
                onClick={handleCheckout}
              >
                <IconLock /> {holding ? "Holding your seats…" : "Proceed to Checkout"}
              </button>

              {holdError && (
                <p className="seat-hold-error" role="alert">
                  {holdError}
                  {needsLogin && (
                    <>
                      {" "}
                      <Link to="/login" state={{ from: location.pathname, fromState: location.state }}>
                        Log in
                      </Link>
                    </>
                  )}
                </p>
              )}

              <p className="seat-checkout-hint">
                {canCheckout || holding
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
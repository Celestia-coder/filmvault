import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Search, Film } from "lucide-react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { fetchBookings } from "../../api/bookings.js";
import { getUser } from "../../api/session.js";
import "../../styles/Tickets.css";
import "../../styles/Ticket.css";

const TABS = [
  { key: "active", label: "Active Reservations" },
  { key: "past", label: "Past Reservations" },
];

/* ---------- Formatting helpers ---------- */

// 105 -> "1 hr 45 mins"
function formatRuntime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hrPart = h > 0 ? `${h} hr` : "";
  const minPart = m > 0 ? `${m} min${m === 1 ? "" : "s"}` : "";
  return [hrPart, minPart].filter(Boolean).join(" ");
}

// "2026-06-10T11:30:00" -> "Wed, June 10 at 11:30 AM"
function formatShowtime(iso) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "long",
    day: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} at ${time}`;
}

// 1090 -> "₱1090.00"
function formatPrice(amount) {
  return `₱${amount.toFixed(2)}`;
}

// "Active" = not cancelled and the movie hasn't finished yet. Everything else is "past".
function getTab(booking) {
  if (booking.status === "cancelled") return "past";
  const start = new Date(booking.showDateTime).getTime();
  const end = start + (booking.runtimeMins || 0) * 60 * 1000;
  return end > Date.now() ? "active" : "past";
}

/* ---------- Poster with fallback ---------- */

function Poster({ src, title }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="booking-poster booking-poster--placeholder" aria-hidden="true">
        <Film size={22} />
        <span>{title}</span>
      </div>
    );
  }

  return (
    <img
      className="booking-poster"
      src={src}
      alt={`${title} poster`}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/* ---------- Booking card ---------- */

function BookingCard({ booking }) {
  const { id, title, poster, runtimeMins, showDateTime, totalPrice, ticketCount, seats, referenceNo, status } = booking;

  return (
    <li className="booking-card">
      <Poster src={poster} title={title} />

      <div className="booking-info">
        <div>
          <h3 className="booking-title">{title}</h3>
          <p className="booking-runtime">{formatRuntime(runtimeMins)}</p>
        </div>
        <div>
          <p className="booking-showtime">{formatShowtime(showDateTime)}</p>
          <p className="booking-ref">
            Ref: {referenceNo}
            {status === "cancelled" && <span className="booking-badge booking-badge--cancelled">Cancelled</span>}
          </p>
        </div>
      </div>

      <div className="booking-meta">
        <p className="booking-price">{formatPrice(totalPrice)}</p>
        <p>Total Ticket(s): {ticketCount}</p>
        <p>Seat Number: {seats.join(", ")}</p>
        <Link className="booking-view-link" to={`/tickets/${id}`}>
          View ticket
        </Link>
      </div>
    </li>
  );
}

/* ---------- Page ---------- */

export default function Tickets() {
  const user = getUser();
  const userId = user?.userId;

  const [activeTab, setActiveTab] = useState("active");
  const [query, setQuery] = useState("");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // GET /api/bookings?userId=  (newest first). reloadKey lets "Try again" re-run it.
  useEffect(() => {
    if (!userId) return undefined;
    const controller = new AbortController();
    fetchBookings(userId, { signal: controller.signal })
      .then(setBookings)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [userId, reloadKey]);

  const retry = useCallback(() => {
    setLoading(true);
    setError("");
    setReloadKey((k) => k + 1);
  }, []);

  // Function 1 + 2: filter by tab, then by reference number or movie name
  const filteredBookings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bookings
      .filter((b) => getTab(b) === activeTab)
      .filter(
        (b) =>
          q === "" ||
          b.title.toLowerCase().includes(q) ||
          b.referenceNo.toLowerCase().includes(q)
      );
  }, [bookings, activeTab, query]);

  const handleSubmit = (e) => {
    e.preventDefault(); // list already filters live as you type
  };

  const handleKeyDownTabs = (e) => {
    // Arrow-key navigation between tabs (accessibility)
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const idx = TABS.findIndex((t) => t.key === activeTab);
    const next = e.key === "ArrowRight" ? (idx + 1) % TABS.length : (idx - 1 + TABS.length) % TABS.length;
    setActiveTab(TABS[next].key);
    document.getElementById(`tab-${TABS[next].key}`)?.focus();
  };

  return (
    <>
    <Navbar />
    <main className="tickets-page">
      <header className="tickets-header">
        <h1>My Bookings</h1>
        <p>Track your active tickets and past bookings.</p>
      </header>

      {/* Function 1: tab switch */}
      <div className="tickets-tabs" role="tablist" aria-label="Booking type" onKeyDown={handleKeyDownTabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            id={`tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls="bookings-panel"
            tabIndex={activeTab === tab.key ? 0 : -1}
            className={`tickets-tab ${activeTab === tab.key ? "is-active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Function 2: search */}
      <form className="tickets-search" role="search" onSubmit={handleSubmit}>
        <label htmlFor="booking-search" className="sr-only">
          Search bookings by reference number or movie name
        </label>
        <div className="tickets-search-field">
          <Search size={16} aria-hidden="true" />
          <input
            id="booking-search"
            type="search"
            placeholder="Type reference number, movie name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="submit" className="tickets-search-btn">
          Search
        </button>
      </form>

      {/* Function 3: bookings list */}
      <section
        id="bookings-panel"
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        aria-live="polite"
      >
        {!userId ? (
          <div className="bookings-empty">
            <p>Log in to see your bookings.</p>
            <Link className="booking-view-link" to="/login">
              Log in
            </Link>
          </div>
        ) : loading ? (
          <div className="bookings-empty" role="status">
            Loading your bookings…
          </div>
        ) : error ? (
          <div className="bookings-empty bookings-empty--error" role="alert">
            <p>We couldn't load your bookings. {error}</p>
            <button type="button" className="tickets-search-btn" onClick={retry}>
              Try again
            </button>
          </div>
        ) : filteredBookings.length > 0 ? (
          <ul className="bookings-list">
            {filteredBookings.map((b) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </ul>
        ) : (
          <div className="bookings-empty">
            {query
              ? `No bookings match "${query}".`
              : activeTab === "active"
              ? "You have no active reservations."
              : "You have no past reservations yet."}
          </div>
        )}
      </section>
    </main>
    <Footer />
    </>
  );
}

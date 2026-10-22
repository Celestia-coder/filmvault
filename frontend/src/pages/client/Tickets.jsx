import { useMemo, useState } from "react";
import { Search, Film } from "lucide-react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import "../../styles/Tickets.css";
import projectHailMary from "../../assets/images/movies/project-hailmary.jpg";
import wicked from "../../assets/images/movies/wicked.jpg";
import moana from "../../assets/images/movies/moana.jpg";
import toyStory5 from "../../assets/images/movies/toy-story-5.jpg";

/* ---------- Mock data ---------- */
// Mock booking data for the Tickets (My Bookings) page.
// Replace with an API call (e.g. GET /api/bookings) once the backend endpoint is ready.
// `poster` uses images from src/assets/images/movies — a placeholder shows if one is missing.

const mockBookings = [
  // ---- Active reservations ----
  {
    id: 1,
    referenceNo: "FV-20260610-0012",
    title: "Project Hail Mary",
    poster: projectHailMary,
    runtimeMins: 105,
    showDateTime: "2026-06-10T11:30:00",
    ticketCount: 2,
    seats: ["G1", "G2"],
    totalPrice: 1090,
    status: "active",
  },
  {
    id: 2,
    referenceNo: "FV-20260615-0047",
    title: "Wicked",
    poster: wicked,
    runtimeMins: 108,
    showDateTime: "2026-06-15T19:30:00",
    ticketCount: 1,
    seats: ["E5"],
    totalPrice: 540,
    status: "active",
  },

  // ---- Past reservations ----
  {
    id: 3,
    referenceNo: "FV-20260512-0103",
    title: "Moana",
    poster: moana,
    runtimeMins: 141,
    showDateTime: "2026-05-12T14:00:00",
    ticketCount: 2,
    seats: ["D7", "D8"],
    totalPrice: 1090,
    status: "past",
  },
  {
    id: 4,
    referenceNo: "FV-20260428-0088",
    title: "Toy Story 5",
    poster: toyStory5,
    runtimeMins: 108,
    showDateTime: "2026-04-28T19:30:00",
    ticketCount: 1,
    seats: ["E5"],
    totalPrice: 540,
    status: "past",
  },
];

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
  const { title, poster, runtimeMins, showDateTime, totalPrice, ticketCount, seats } =
    booking;

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
        </div>
      </div>

      <div className="booking-meta">
        <p className="booking-price">{formatPrice(totalPrice)}</p>
        <p>Total Ticket(s): {ticketCount}</p>
        <p>Seat Number: {seats.join(", ")}</p>
      </div>
    </li>
  );
}

/* ---------- Page ---------- */

export default function Tickets() {
  const [activeTab, setActiveTab] = useState("active");
  const [query, setQuery] = useState("");

  // Function 1 + 2: filter by tab, then by reference number or movie name
  const filteredBookings = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mockBookings
      .filter((b) => b.status === activeTab)
      .filter(
        (b) =>
          q === "" ||
          b.title.toLowerCase().includes(q) ||
          b.referenceNo.toLowerCase().includes(q)
      );
  }, [activeTab, query]);

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
        {filteredBookings.length > 0 ? (
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

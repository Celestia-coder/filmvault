// Route: "/checkout"
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import heroBg from "../../assets/images/hero-bg.png";
import moviePoster from "../../assets/images/movie-poster.webp";
import "../../styles/Checkout.css";

/* ---------------------------------------------------------------- */
/* Icons                                                            */
/* ---------------------------------------------------------------- */
const Icon = ({ children, size = 16, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    {children}
  </svg>
);
const IconMapPin = (p) => (<Icon {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></Icon>);
const IconMonitor = (p) => (<Icon {...p}><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></Icon>);
const IconCalendar = (p) => (<Icon {...p}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Icon>);
const IconClock = (p) => (<Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></Icon>);
const IconMail = (p) => (<Icon {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></Icon>);
const IconWarning = (p) => (<Icon {...p}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></Icon>);
const IconUpload = (p) => (<Icon {...p}><path d="M12 16V4M7 9l5-5 5 5M4 16v4h16v-4" /></Icon>);
const IconLock = (p) => (<Icon {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Icon>);
const IconShield = (p) => (<Icon {...p}><path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z" /></Icon>);
const IconChevronDown = (p) => (<Icon size={14} {...p}><path d="m6 9 6 6 6-6" /></Icon>);
const IconCheckCircle = (p) => (<Icon size={40} strokeWidth="1.8" {...p}><circle cx="12" cy="12" r="10" /><path d="m8 12.5 3 3 5-6" /></Icon>);

/* ---------------------------------------------------------------- */
/* Static data                                                      */
/* ---------------------------------------------------------------- */
const DISCOUNT_RATE = 0.2; // PWD + Senior Citizen

const TICKET_TYPES = {
  regular: { label: "Regular", discounted: false },
  senior: { label: "Senior Citizen", discounted: true },
  pwd: { label: "PWD", discounted: true },
};

const PAYMENT_METHODS = [
  { id: "gcash", logo: "GCash", name: "GCash", desc: "e-Wallet", color: "#0a73e8" },
  { id: "maya", logo: "Maya", name: "Maya", desc: "e-Wallet", color: "#1fc16b" },
  { id: "card", logo: "card", name: "Credit / Debit Card", desc: "Visa · Mastercard", color: "#23232e" },
  { id: "bpi", logo: "BPI", name: "BPI Online", desc: "Online Banking", color: "#a4161a" },
];

// TODO: replace with a real concessions API once the backend has one.
const INITIAL_FOOD = [
  { id: "popcorn", icon: "🍿", name: "Caramel Popcorn", size: "Large", price: 180, qty: 0 },
  { id: "cola", icon: "🥤", name: "Coca-Cola", size: "Regular", price: 90, qty: 0 },
  { id: "nachos", icon: "🧀", name: "Cheese Nachos", size: "Sharing", price: 160, qty: 0 },
  { id: "combo", icon: "🎬", name: "Movie Combo", size: "Popcorn + 2 Drinks", price: 320, qty: 0 },
];

const HOLD_SECONDS = 10 * 60;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

// Used only when the page is opened without booking state (direct URL / refresh).
const FALLBACK_BOOKING = {
  movieId: "1",
  movieTitle: "How To Train Your Dragon",
  genres: ["Adventure", "Fantasy", "Family"],
  rating: "PG",
  poster: null,
  branch: { name: "Vista Mall Taguig" },
  date: new Date(2026, 5, 14),
  showtime: { time: "7:30 PM", hall: "Cinema 4", format: "Digital 2D", price: 350 },
  seats: ["H7", "H8"],
};

/* ---------------------------------------------------------------- */
/* Helpers                                                          */
/* ---------------------------------------------------------------- */
const peso = (n) => `₱${Number(n).toLocaleString("en-PH")}`;

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatTimer = (secs) =>
  `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

/* ---------------------------------------------------------------- */
/* Page                                                             */
/* ---------------------------------------------------------------- */
function Checkout() {
  const navigate = useNavigate();
  const { state } = useLocation();

  const booking = useMemo(() => {
    const s = state || {};
    return {
      movieId: s.movieId ?? FALLBACK_BOOKING.movieId,
      movieTitle: s.movieTitle ?? FALLBACK_BOOKING.movieTitle,
      genres: s.genres ?? FALLBACK_BOOKING.genres,
      rating: s.rating ?? FALLBACK_BOOKING.rating,
      poster: s.poster ?? null,
      branch: s.branch ?? FALLBACK_BOOKING.branch,
      date: s.date ?? FALLBACK_BOOKING.date,
      showtime: s.showtime ?? FALLBACK_BOOKING.showtime,
      seats: s.seats?.length ? s.seats : FALLBACK_BOOKING.seats,
    };
  }, [state]);
  const { movieId, movieTitle, genres, rating, poster, branch, date, showtime, seats } = booking;
  const basePrice = showtime.price;

  /* ---- form state ---- */
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [ticketTypes, setTicketTypes] = useState(() =>
    Object.fromEntries(seats.map((seat) => [seat, "regular"]))
  );
  const [food, setFood] = useState(INITIAL_FOOD);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [idFile, setIdFile] = useState(null);
  const [idError, setIdError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(HOLD_SECONDS);
  const [paid, setPaid] = useState(false);
  const fileInputRef = useRef(null);

  const goToSeats = () =>
    navigate(`/booking/${movieId}/seats`, {
      state: {
        movieId,
        movieTitle,
        branch,
        date,
        showtime,
        ticketCount: seats.length,
        seats,
      },
    });

  /* ---- seat-hold countdown (stops once paid) ---- */
  useEffect(() => {
    if (paid) return undefined;
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [paid]);

  useEffect(() => {
    if (secondsLeft === 0 && !paid) {
      alert("Your seat hold has expired. Please select your seats again.");
      goToSeats();
    }
  }, [secondsLeft, paid]);

  const priceFor = (type) =>
    TICKET_TYPES[type].discounted ? Math.round(basePrice * (1 - DISCOUNT_RATE)) : basePrice;

  const hasDiscountedTicket = seats.some((s) => TICKET_TYPES[ticketTypes[s]].discounted);

  const ticketSummary = useMemo(() => {
    const groups = {};
    seats.forEach((seat) => {
      const type = ticketTypes[seat];
      groups[type] = (groups[type] || 0) + 1;
    });
    return Object.entries(groups).map(([type, count]) => ({ type, count }));
  }, [seats, ticketTypes]);

  const foodItems = food.filter((f) => f.qty > 0);
  const foodTotal = foodItems.reduce((sum, f) => sum + f.price * f.qty, 0);
  const ticketsTotal = seats.reduce((sum, s) => sum + priceFor(ticketTypes[s]), 0);
  const fullPriceTotal = seats.length * basePrice;
  const discountTotal = fullPriceTotal - ticketsTotal;
  const subtotal = fullPriceTotal + foodTotal; // before discounts
  const total = subtotal - discountTotal; // no booking fee

  const emailValid = EMAIL_REGEX.test(email.trim());
  const idOk = !hasDiscountedTicket || Boolean(idFile);
  const canPay = emailValid && idOk && Boolean(paymentMethod) && seats.length > 0 && !paid;

  /* ---- handlers ---- */
  const handleTicketType = (seat) => (e) =>
    setTicketTypes((prev) => ({ ...prev, [seat]: e.target.value }));

  const changeQty = (id, delta) =>
    setFood((prev) =>
      prev.map((f) => (f.id === id ? { ...f, qty: Math.max(0, Math.min(10, f.qty + delta)) } : f))
    );

  const handleFile = (file) => {
    if (!file) return;
    if (!/\.(jpe?g|png|pdf)$/i.test(file.name)) {
      setIdError("Only JPG, PNG or PDF files are allowed.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setIdError("File is too large. Max 5 MB.");
      return;
    }
    setIdError("");
    setIdFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handlePay = () => {
    if (!canPay) return;
    // TODO (backend): create the booking + process the payment here.
    const payload = {
      movieId,
      email: email.trim(),
      mobile: mobile.trim() || null,
      branch: branch.name,
      date,
      showtime,
      tickets: seats.map((seat) => ({ seat, type: ticketTypes[seat], price: priceFor(ticketTypes[seat]) })),
      food: foodItems.map(({ id, qty, price }) => ({ id, qty, price })),
      discountId: hasDiscountedTicket ? idFile?.name : null,
      paymentMethod,
      total,
    };
    console.log("Checkout payload:", payload);
    setPaid(true); // shows the "Payment Successful" pop-up
  };

  return (
    <div className="checkout-page">
      <div className="checkout-bg" style={{ backgroundImage: `url(${heroBg})` }}></div>

      <section className="checkout-hero">
        <Navbar />

        <div className="checkout-header">
          <div>
            <h1 className="checkout-heading">Checkout</h1>
            <p className="checkout-subtext">
              Review your booking, choose ticket types, and complete your payment securely.
            </p>
          </div>
          <button type="button" className="co-btn-back" onClick={goToSeats}>
            ← Back
          </button>
        </div>

        <div className="checkout-layout">
          {/* ============ LEFT COLUMN ============ */}
          <div className="checkout-main">
            {/* Contact */}
            <div className="co-card">
              <div className="co-card-header">
                <div>
                  <p className="co-card-title">Contact Details</p>
                  <p className="co-card-subtitle">
                    Your e-ticket with QR code &amp; booking confirmation are sent here
                  </p>
                </div>
              </div>
              <div className="co-card-body">
                <div className="co-form-row">
                  <div className="co-field">
                    <label className="co-label" htmlFor="co-email">
                      Email Address <span className="co-required">*</span>
                    </label>
                    <input
                      id="co-email"
                      type="email"
                      className={"co-input" + (emailTouched && !emailValid ? " invalid" : "")}
                      placeholder="you@example.com"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => setEmailTouched(true)}
                    />
                    {emailTouched && !emailValid && (
                      <p className="co-error">Enter a valid email address.</p>
                    )}
                  </div>
                  <div className="co-field">
                    <label className="co-label" htmlFor="co-mobile">
                      Mobile Number <span className="co-hint">(optional — SMS reminder)</span>
                    </label>
                    <input
                      id="co-mobile"
                      type="tel"
                      className="co-input"
                      placeholder="+63 9XX XXX XXXX"
                      autoComplete="tel"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/[^\d+\s]/g, ""))}
                    />
                  </div>
                </div>
                <div className="co-note co-note--green">
                  <IconMail />
                  <span>
                    We'll email your QR-coded ticket the moment payment is confirmed. Present it at
                    the cinema entrance — no printing needed.
                  </span>
                </div>
              </div>
            </div>

            {/* 1 — Ticket types */}
            <div className="co-card">
              <div className="co-card-header">
                <span className="co-step-number">1</span>
                <div>
                  <p className="co-card-title">Ticket Types &amp; Discounts</p>
                  <p className="co-card-subtitle">
                    Assign a customer type to each seat — discounts apply automatically
                  </p>
                </div>
              </div>
              <div className="co-card-body">
                {seats.map((seat) => {
                  const type = ticketTypes[seat];
                  const discounted = TICKET_TYPES[type].discounted;
                  const row = seat.charAt(0);
                  return (
                    <div className="co-seat-row" key={seat}>
                      <div className="co-seat-badge">
                        <span className="co-seat-badge-code">{seat}</span>
                        <span className="co-seat-badge-label">SEAT</span>
                      </div>
                      <div className="co-seat-info">
                        <span className="co-seat-name">Seat {seat} · Row {row}</span>
                        <span className={"co-seat-sub" + (discounted ? " discounted" : "")}>
                          {discounted ? (
                            <>
                              <strong>20% off</strong> · {peso(priceFor(type))} · ID required
                            </>
                          ) : (
                            peso(basePrice)
                          )}
                        </span>
                      </div>
                      <div className="co-select-wrap">
                        <select
                          className="co-select"
                          value={type}
                          onChange={handleTicketType(seat)}
                          aria-label={`Ticket type for seat ${seat}`}
                        >
                          {Object.entries(TICKET_TYPES).map(([key, t]) => (
                            <option key={key} value={key}>
                              {t.label} — {peso(priceFor(key))}
                            </option>
                          ))}
                        </select>
                        <IconChevronDown className="co-select-caret" />
                      </div>
                    </div>
                  );
                })}

                {hasDiscountedTicket && (
                  <div className="co-note co-note--amber">
                    <p className="co-id-title">
                      <IconWarning /> ID Verification Required
                    </p>
                    <p className="co-id-text">
                      You selected a discounted ticket type (Senior Citizen or PWD). Please upload a
                      valid government- or institution-issued ID for verification at the cinema.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      hidden
                      onChange={(e) => handleFile(e.target.files?.[0])}
                    />
                    <button
                      type="button"
                      className={
                        "co-id-drop" + (dragging ? " dragging" : "") + (idFile ? " uploaded" : "")
                      }
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={handleDrop}
                    >
                      <IconUpload size={24} />
                      <span className="co-id-drop-title">
                        {idFile ? `✓ ${idFile.name}` : "Click to upload or drag & drop"}
                      </span>
                      <span className="co-id-drop-desc">JPG, PNG or PDF · max 5 MB</span>
                    </button>
                    {idError && <p className="co-error">{idError}</p>}
                  </div>
                )}
              </div>
            </div>

            {/* 2 — Food */}
            <div className="co-card">
              <div className="co-card-header">
                <span className="co-step-number">2</span>
                <div>
                  <p className="co-card-title">Food &amp; Snacks</p>
                  <p className="co-card-subtitle">
                    Add concessions to your order — picked up at the counter
                  </p>
                </div>
              </div>
              <div className="co-card-body">
                {food.map((item) => (
                  <div className="co-food-row" key={item.id}>
                    <span className="co-food-icon">{item.icon}</span>
                    <div className="co-food-info">
                      <span className="co-food-name">{item.name}</span>
                      <span className="co-food-desc">
                        {item.size} · {peso(item.price)}
                      </span>
                    </div>
                    <div className="co-qty">
                      <button
                        type="button"
                        onClick={() => changeQty(item.id, -1)}
                        disabled={item.qty === 0}
                        aria-label={`Remove one ${item.name}`}
                      >
                        −
                      </button>
                      <span>{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => changeQty(item.id, 1)}
                        aria-label={`Add one ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3 — Payment */}
            <div className="co-card">
              <div className="co-card-header">
                <span className="co-step-number">3</span>
                <div>
                  <p className="co-card-title">Payment Method</p>
                  <p className="co-card-subtitle">Protected payment · encrypted and secure</p>
                </div>
              </div>
              <div className="co-card-body co-pay-grid">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    className={"co-pay-option" + (paymentMethod === m.id ? " selected" : "")}
                    onClick={() => setPaymentMethod(m.id)}
                    aria-pressed={paymentMethod === m.id}
                  >
                    <span className="co-pay-logo" style={{ background: m.color }}>
                      {m.logo}
                    </span>
                    <span className="co-pay-text">
                      <span className="co-pay-name">{m.name}</span>
                      <span className="co-pay-desc">{m.desc}</span>
                    </span>
                    <span className="co-radio" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ============ RIGHT COLUMN ============ */}
          <aside className="checkout-sidebar">
            <div className="co-card">
              <div className="co-summary-movie">
                <img
                  src={poster || moviePoster}
                  alt={`${movieTitle} poster`}
                  className="co-summary-poster"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = moviePoster;
                  }}
                />
                <div>
                  <h2 className="co-summary-title">{movieTitle}</h2>
                  <div className="co-summary-genres">
                    {genres.map((g) => (
                      <span className="co-summary-genre" key={g}>{g}</span>
                    ))}
                  </div>
                  {rating && (
                    <p className="co-summary-rating">
                      <span className="co-rating-badge">{rating}</span> MTRCB Rated
                    </p>
                  )}
                </div>
              </div>

              <div className="co-summary-section">
                <p className="co-eyebrow">Showtime</p>
                <div className="co-kv">
                  <span><IconMapPin /> Branch</span>
                  <strong>{branch.name}</strong>
                </div>
                <div className="co-kv">
                  <span><IconMonitor /> Cinema</span>
                  <strong>{showtime.hall}</strong>
                </div>
                <div className="co-kv">
                  <span><IconCalendar /> Date</span>
                  <strong>{formatDate(date)}</strong>
                </div>
                <div className="co-kv">
                  <span><IconClock /> Time</span>
                  <strong>{showtime.time}</strong>
                </div>
              </div>

              <div className="co-summary-section">
                <p className="co-eyebrow">Selected Seats · {seats.length}</p>
                <div className="co-chips">
                  {seats.map((seat) => (
                    <span className="co-chip" key={seat}>{seat}</span>
                  ))}
                </div>
              </div>

              <div className="co-summary-section">
                <p className="co-eyebrow">Tickets</p>
                {ticketSummary.map(({ type, count }) => {
                  const t = TICKET_TYPES[type];
                  return (
                    <div className="co-line" key={type}>
                      <div>
                        <p className="co-line-name">
                          {t.label} ×{count}
                          {t.discounted && <span className="co-discount-badge">−20%</span>}
                        </p>
                        <p className="co-line-sub">{peso(priceFor(type))} each</p>
                      </div>
                      <p className="co-line-price">
                        {t.discounted && (
                          <span className="co-line-old">{peso(basePrice * count)}</span>
                        )}
                        {peso(priceFor(type) * count)}
                      </p>
                    </div>
                  );
                })}
              </div>

              {foodItems.length > 0 && (
                <div className="co-summary-section">
                  <p className="co-eyebrow">Food &amp; Snacks</p>
                  {foodItems.map((f) => (
                    <div className="co-line" key={f.id}>
                      <div>
                        <p className="co-line-name">{f.name} ×{f.qty}</p>
                        <p className="co-line-sub">{f.size}</p>
                      </div>
                      <p className="co-line-price">{peso(f.price * f.qty)}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="co-summary-section">
                <div className="co-total-row">
                  <span>Subtotal</span>
                  <strong>{peso(subtotal)}</strong>
                </div>
                <div className="co-total-row">
                  <span>Discounts</span>
                  <strong className="co-text-green">
                    {discountTotal > 0 ? `-${peso(discountTotal)}` : peso(0)}
                  </strong>
                </div>
                <div className="co-grand">
                  <div>
                    <p className="co-grand-label">Total</p>
                    <p className="co-grand-note">VAT included</p>
                  </div>
                  <p className="co-grand-amount">{peso(total)}</p>
                </div>

                <button type="button" className="co-btn-pay" disabled={!canPay} onClick={handlePay}>
                  <IconLock /> Pay {peso(total)}
                </button>
                <p className="co-secure">
                  <IconShield size={13} /> Your payment information is securely protected
                </p>
              </div>
            </div>

            <div className="co-hold">
              <span className="co-hold-dot" />
              <p className="co-hold-text">
                Your seats are held for
                <br />
                <strong>10 minutes</strong> — complete payment in time
              </p>
              <p className="co-hold-clock">{formatTimer(secondsLeft)}</p>
            </div>
          </aside>
        </div>
      </section>

      <Footer />

      {/* ============ PAYMENT SUCCESSFUL POP-UP ============ */}
      {paid && (
        <div className="co-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="co-modal-title">
          <div className="co-modal">
            <div className="co-modal-head">
              <span className="co-modal-icon">
                <IconCheckCircle />
              </span>
              <h2 className="co-modal-title" id="co-modal-title">Payment Successful</h2>
            </div>
            <p className="co-modal-text">
              Booking confirmed — please check your email for your ticket details.
            </p>
            <button type="button" className="co-modal-btn" onClick={() => navigate("/tickets")}>
              View Tickets
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Checkout;
// ShowtimeSelection.jsx — Owner: [Your Name]
// Route: "/booking/:movieId" — this is where MoviePage's "Buy Tickets"
// link (/booking/${movie.id}) leads.

import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import heroBg from "../../assets/images/hero-bg.png";
import "../../styles/ShowtimeSelection.css";

/* ---------------------------------------------------------------- */
/* Icons — small inline SVGs, same approach as the other pages       */
/* ---------------------------------------------------------------- */

const IconMapPin = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

const IconChevronLeft = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="m15 18-6-6 6-6" />
    </svg>
);

const IconChevronRight = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="m9 18 6-6-6-6" />
    </svg>
);

const IconCalendar = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
);

const IconClock = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
    </svg>
);

const IconMonitor = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="2" y="4" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
    </svg>
);

const IconArrowRight = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
);

const IconInfo = (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
    </svg>
);

/* ---------------------------------------------------------------- */
/* Data — hardcoded for now                                          */
/* ---------------------------------------------------------------- */

// TODO: this duplicates title-only data also hardcoded in MoviePage.jsx.
// Once there's a real movies API, both pages should read from that
// instead of each keeping their own copy.
const MOVIE_TITLES = {
    1: "How To Train Your Dragon",
    2: "Starlight Voyage",
    3: "The Last Bloom",
};

const BRANCHES = [
    { id: "vista-mall-taguig", name: "Vista Mall Taguig", city: "Taguig City", hours: "Open until 12:00 AM" },
    { id: "market-market", name: "Market! Market!", city: "Taguig City", hours: "Open until 12:00 AM" },
    { id: "venice-mckinley", name: "Venice McKinley", city: "Taguig City", hours: "Open until 12:00 AM" },
];

// TODO: in a real app this would depend on the selected branch + date —
// hardcoded here since there's no backend yet.
const SCREENINGS = [
    {
        format: "Digital 2D",
        price: 350,
        hall: "Cinema 4",
        times: [
            { time: "1:30 PM", soldOut: false },
            { time: "4:15 PM", soldOut: false },
            { time: "7:30 PM", soldOut: false },
            { time: "10:15 PM", soldOut: false },
        ],
    },
    {
        format: "Digital 2D",
        price: 350,
        hall: "Cinema 1",
        times: [
            { time: "2:00 PM", soldOut: false },
            { time: "5:30 PM", soldOut: false },
            { time: "9:00 PM", soldOut: true },
        ],
    },
];

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

/* ---------------------------------------------------------------- */
/* Date helpers                                                       */
/* ---------------------------------------------------------------- */

// "Showtimes available for the next 14 days" — today through today+13,
// computed for real (not hardcoded), so this stays correct on whatever
// day it's actually loaded rather than freezing on one mockup date.
function buildAvailableDays() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        days.push(d);
    }
    return days;
}

function formatSidebarDate(date) {
    return `${DAY_NAMES[date.getDay()]}, ${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
}

/* ---------------------------------------------------------------- */
/* Page                                                               */
/* ---------------------------------------------------------------- */

function ShowtimeSelection() {
    const { movieId } = useParams();
    const navigate = useNavigate();
    const movieTitle = MOVIE_TITLES[movieId] || "Selected Movie";

    const availableDays = useMemo(() => buildAvailableDays(), []);
    const [page, setPage] = useState(0); // 0 = days 1-7, 1 = days 8-14
    const visibleDays = availableDays.slice(page * 7, page * 7 + 7);

    const [selectedBranch, setSelectedBranch] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedShowtime, setSelectedShowtime] = useState(null);

    // Changing branch or date invalidates whatever showtime was picked —
    // availability would differ per branch/date once this is real data.
    const handleSelectBranch = (branch) => {
        setSelectedBranch(branch);
        setSelectedShowtime(null);
    };

    const handleSelectDate = (date) => {
        setSelectedDate(date);
        setSelectedShowtime(null);
    };

    const handleSelectShowtime = (screening, slot) => {
        if (slot.soldOut) return;
        setSelectedShowtime({
            time: slot.time,
            format: screening.format,
            hall: screening.hall,
            price: screening.price,
        });
    };

    const canContinue = Boolean(selectedBranch && selectedDate && selectedShowtime);

    const handleContinue = () => {
        if (!canContinue) return;
        // TODO: seat selection isn't built yet — this is a placeholder
        // destination. Passing the picks forward via route state so
        // whatever gets built next doesn't have to re-derive them.
        navigate(`/booking/${movieId}/seats`, {
            state: {
                movieId,
                movieTitle,
                branch: selectedBranch,
                date: selectedDate,
                showtime: selectedShowtime,
            },
        });
    };

    return (
        <div className="showtime-page">
            <div className="showtime-bg" style={{ backgroundImage: `url(${heroBg})` }}></div>

            <section className="showtime-hero">
                <Navbar />

                <div className="showtime-page-header">
                    <div className="showtime-heading-block">
                        <h1 className="showtime-heading">Book Your Tickets</h1>
                        <p className="showtime-subtext">Choose where and when you'd like to watch.</p>
                    </div>

                    <button type="button" className="btn-back-top" onClick={() => navigate(-1)}>
                        ← Back
                    </button>
                </div>

                <div className="showtime-layout">
                    <div className="showtime-main">
                        {/* Step 1 — Cinema branch */}
                        <div className="step-card">
                            <div className="step-header">
                                <span className="step-number">1</span>
                                <div>
                                    <p className="step-title">Select Cinema Branch</p>
                                    <p className="step-subtitle">Where would you like to watch?</p>
                                </div>
                            </div>

                            <div className="branch-list">
                                {BRANCHES.map((branch) => (
                                    <button
                                        type="button"
                                        key={branch.id}
                                        className={"branch-option" + (selectedBranch?.id === branch.id ? " selected" : "")}
                                        onClick={() => handleSelectBranch(branch)}
                                    >
                                        <span className="branch-option-left">
                                            <span className="branch-icon">
                                                <IconMapPin />
                                            </span>
                                            <span className="branch-text">
                                                <span className="branch-name">{branch.name}</span>
                                                <span className="branch-city">{branch.city}</span>
                                            </span>
                                        </span>
                                        <span className="branch-option-right">
                                            <span className="branch-hours">{branch.hours}</span>
                                            <span className="radio-dot" />
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Step 2 — Date */}
                        <div className="step-card">
                            <div className="step-header">
                                <span className="step-number">2</span>
                                <div>
                                    <p className="step-title">Select Date</p>
                                    <p className="step-subtitle">Showtimes available for the next 14 days</p>
                                </div>
                            </div>

                            <div className="calendar-header">
                                <span className="calendar-month">
                                    {MONTH_FULL[visibleDays[0].getMonth()]} {visibleDays[0].getFullYear()}
                                </span>
                                <div className="calendar-nav">
                                    <button
                                        type="button"
                                        className="calendar-nav-btn"
                                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                                        disabled={page === 0}
                                        aria-label="Previous days"
                                    >
                                        <IconChevronLeft />
                                    </button>
                                    <button
                                        type="button"
                                        className="calendar-nav-btn"
                                        onClick={() => setPage((p) => Math.min(1, p + 1))}
                                        disabled={page === 1}
                                        aria-label="Next days"
                                    >
                                        <IconChevronRight />
                                    </button>
                                </div>
                            </div>

                            <div className="calendar-strip">
                                {visibleDays.map((day) => {
                                    const isToday = day.getTime() === availableDays[0].getTime();
                                    const isSelected = selectedDate && day.getTime() === selectedDate.getTime();

                                    return (
                                        <button
                                            type="button"
                                            key={day.getTime()}
                                            className={"calendar-day" + (isSelected ? " selected" : "")}
                                            onClick={() => handleSelectDate(day)}
                                        >
                                            <span className="calendar-day-name">{DAY_NAMES[day.getDay()]}</span>
                                            <span className="calendar-day-number">{day.getDate()}</span>
                                            {isToday && <span className="calendar-day-today">TODAY</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Step 3 — Showtime */}
                        <div className="step-card">
                            <div className="step-header">
                                <span className="step-number">3</span>
                                <div>
                                    <p className="step-title">Select Showtime</p>
                                    <p className="step-subtitle">Format and hall shown per screening</p>
                                </div>
                            </div>

                            {SCREENINGS.map((screening) => (
                                <div className="screening-group" key={screening.hall}>
                                    <div className="screening-header">
                                        <div className="screening-header-left">
                                            <span className="format-badge">{screening.format}</span>
                                            <span className="screening-price">₱{screening.price} / seat</span>
                                        </div>
                                        <span className="screening-hall">{screening.hall}</span>
                                    </div>

                                    <div className="time-slots">
                                        {screening.times.map((slot) => {
                                            const isSelected =
                                                selectedShowtime &&
                                                selectedShowtime.time === slot.time &&
                                                selectedShowtime.hall === screening.hall;

                                            return (
                                                <button
                                                    type="button"
                                                    key={slot.time}
                                                    className={"time-slot" + (isSelected ? " selected" : "")}
                                                    disabled={slot.soldOut}
                                                    onClick={() => handleSelectShowtime(screening, slot)}
                                                >
                                                    <span className="time-slot-time">{slot.time}</span>
                                                    <span className="time-slot-status">
                                                        {slot.soldOut ? "Sold out" : "Available"}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="showtime-sidebar">
                        <p className="sidebar-eyebrow">Your Selection</p>
                        <h2 className="sidebar-movie-title">{movieTitle}</h2>

                        <div className="summary-row">
                            <span className="summary-icon">
                                <IconMapPin />
                            </span>
                            <span className="summary-text">
                                <span className="summary-label">Cinema Branch</span>
                                <span className={"summary-value" + (selectedBranch ? "" : " unset")}>
                                    {selectedBranch ? selectedBranch.name : "Not selected"}
                                </span>
                            </span>
                        </div>

                        <div className="summary-row">
                            <span className="summary-icon">
                                <IconCalendar />
                            </span>
                            <span className="summary-text">
                                <span className="summary-label">Date</span>
                                <span className={"summary-value" + (selectedDate ? "" : " unset")}>
                                    {selectedDate ? formatSidebarDate(selectedDate) : "Not selected"}
                                </span>
                            </span>
                        </div>

                        <div className="summary-row">
                            <span className="summary-icon">
                                <IconClock />
                            </span>
                            <span className="summary-text">
                                <span className="summary-label">Showtime</span>
                                <span className={"summary-value" + (selectedShowtime ? "" : " unset")}>
                                    {selectedShowtime ? selectedShowtime.time : "Not selected"}
                                </span>
                            </span>
                        </div>

                        <div className="summary-row">
                            <span className="summary-icon">
                                <IconMonitor />
                            </span>
                            <span className="summary-text">
                                <span className="summary-label">Format &amp; Hall</span>
                                <span className={"summary-value" + (selectedShowtime ? "" : " unset")}>
                                    {selectedShowtime ? `${selectedShowtime.format} · ${selectedShowtime.hall}` : "Not selected"}
                                </span>
                            </span>
                        </div>

                        <button type="button" className="btn-continue" disabled={!canContinue} onClick={handleContinue}>
                            Continue to Seats <IconArrowRight />
                        </button>

                        <p className="continue-hint">
                            <IconInfo />
                            Seats are held for 10 minutes once selected.
                        </p>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}

export default ShowtimeSelection;
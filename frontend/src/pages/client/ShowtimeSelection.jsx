// ShowtimeSelection.jsx — Owner: [Your Name]
// Route: "/booking/:movieId" — this is where MoviePage's "Buy Tickets"
// link (/booking/${movie.id}) leads.
//
// Data: the movie comes from GET /api/movies/:id and its showtimes from
// GET /api/movies/:id/showtimes (via api/movies.js). Branches and the
// per-hall time slots are built from those showtimes, so nothing is hardcoded.

import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import heroBg from "../../assets/images/hero-bg.png";
import { fetchMovie, fetchShowtimes, formatTime } from "../../api/movies.js";
import "../../styles/ShowtimeSelection.css";
import "../../styles/BookingStates.css";

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
/* Constants                                                          */
/* ---------------------------------------------------------------- */

// All FilmVault branches are in Taguig City (project scope), and the schema has
// no city column, so this is a constant rather than API data.
const BRANCH_CITY = "Taguig City";

// The schema has no screening format. The project scope is regular halls only,
// so every showtime shows the same label.
const FORMAT_LABEL = "Digital 2D";

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_FULL = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

/* ---------------------------------------------------------------- */
/* Date helpers                                                       */
/* ---------------------------------------------------------------- */

const DAYS_PER_PAGE = 7;

// "2026-11-04" -> local midnight on that day (no timezone shift).
function fromDateKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function formatSidebarDate(date) {
    return `${DAY_NAMES[date.getDay()]}, ${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
}

// The API sends dates as "YYYY-MM-DD", so match on the same string (built from
// local date parts, which avoids any timezone shift).
function toDateKey(date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

// A showtime that already started today shouldn't be bookable.
function hasStarted(showtime) {
    return new Date(`${showtime.date}T${showtime.time}`) < new Date();
}

/* ---------------------------------------------------------------- */
/* Small state box — loading / empty / error / not found              */
/* ---------------------------------------------------------------- */

function StateBox({ tone = "info", title, children }) {
    return (
        <div
            className={`showtime-state showtime-state--${tone}`}
            role={tone === "error" ? "alert" : "status"}
        >
            <p className="showtime-state-title">{title}</p>
            {children}
        </div>
    );
}

/* ---------------------------------------------------------------- */
/* Page                                                               */
/* ---------------------------------------------------------------- */

function ShowtimeSelection() {
    const { movieId } = useParams();
    const navigate = useNavigate();

    const [movie, setMovie] = useState(null);
    const [showtimes, setShowtimes] = useState([]);
    const [loadState, setLoadState] = useState("loading"); // loading | ready | error | not-found
    const [errorMessage, setErrorMessage] = useState("");
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        setLoadState("loading");

        Promise.all([
            fetchMovie(movieId, controller.signal),
            fetchShowtimes(movieId, controller.signal),
        ])
            .then(([loadedMovie, loadedShowtimes]) => {
                setMovie(loadedMovie);
                setShowtimes(loadedShowtimes);
                setLoadState("ready");
            })
            .catch((error) => {
                if (error.name === "AbortError") return;
                // 400 = malformed id (e.g. /booking/abc), 404 = no such movie: both mean "not found"
                if (error.status === 400 || error.status === 404) {
                    setLoadState("not-found");
                    return;
                }
                setErrorMessage(error.message);
                setLoadState("error");
            });

        return () => controller.abort();
    }, [movieId, reloadKey]);

    const movieTitle = movie?.title ?? "Selected Movie";

    const [page, setPage] = useState(0); // which group of 7 dates is showing

    const [selectedBranch, setSelectedBranch] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedShowtime, setSelectedShowtime] = useState(null);

    // Only showtimes that are open for booking and haven't started yet.
    const bookable = useMemo(
        () => showtimes.filter((s) => s.status === "scheduled" && !hasStarted(s)),
        [showtimes]
    );

    // Branches come from the showtimes themselves: a branch with no bookable
    // showtime for this movie isn't offered.
    const branches = useMemo(() => {
        const byId = new Map();
        bookable.forEach((s) => {
            const entry = byId.get(s.branchId) ?? {
                id: s.branchId,
                name: s.branchName,
                city: BRANCH_CITY,
                count: 0,
            };
            entry.count += 1;
            byId.set(s.branchId, entry);
        });
        return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [bookable]);

    // Only the dates that actually have a bookable showtime at the chosen branch
    // (not every day of the next two weeks), earliest first.
    const datesForBranch = (branchId) =>
        [...new Set(bookable.filter((s) => s.branchId === branchId).map((s) => s.date))].sort();
    const availableDays = useMemo(
        () => (selectedBranch ? datesForBranch(selectedBranch.id).map(fromDateKey) : []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [bookable, selectedBranch]
    );
    const totalPages = Math.max(1, Math.ceil(availableDays.length / DAYS_PER_PAGE));
    const visibleDays = availableDays.slice(page * DAYS_PER_PAGE, page * DAYS_PER_PAGE + DAYS_PER_PAGE);
    const todayKey = toDateKey(new Date());

    // Time slots for the chosen branch + date, grouped by cinema hall.
    const screenings = useMemo(() => {
        if (!selectedBranch || !selectedDate) return [];
        const dateKey = toDateKey(selectedDate);
        const groups = new Map();

        bookable
            .filter((s) => s.branchId === selectedBranch.id && s.date === dateKey)
            .forEach((s) => {
                const group = groups.get(s.cinemaId) ?? {
                    cinemaId: s.cinemaId,
                    cinemaNum: s.cinemaNum,
                    hall: `Cinema ${s.cinemaNum}`,
                    times: [],
                };
                group.times.push({
                    id: s.id,
                    time: formatTime(s.time),
                    sortKey: s.time,
                    soldOut: s.seatsAvailable <= 0,
                });
                groups.set(s.cinemaId, group);
            });

        return [...groups.values()]
            .sort((a, b) => a.cinemaNum - b.cinemaNum)
            .map((group) => ({
                ...group,
                times: group.times.sort((a, b) => a.sortKey.localeCompare(b.sortKey)),
            }));
    }, [bookable, selectedBranch, selectedDate]);

    // Changing branch or date invalidates whatever showtime was picked —
    // availability differs per branch/date.
    const handleSelectBranch = (branch) => {
        setSelectedBranch(branch);
        setSelectedShowtime(null);
        setPage(0);
        // Keep the chosen date only if the new branch also has showtimes that day.
        if (selectedDate && !datesForBranch(branch.id).includes(toDateKey(selectedDate))) {
            setSelectedDate(null);
        }
    };

    const handleSelectDate = (date) => {
        setSelectedDate(date);
        setSelectedShowtime(null);
    };

    const handleSelectShowtime = (screening, slot) => {
        if (slot.soldOut) return;
        setSelectedShowtime({
            id: slot.id,
            time: slot.time,
            format: FORMAT_LABEL,
            hall: screening.hall,
            price: movie?.price ?? 0,
        });
    };

    const canContinue = Boolean(
        loadState === "ready" && selectedBranch && selectedDate && selectedShowtime
    );

    const handleContinue = () => {
        if (!canContinue) return;
        // Everything the next pages need rides along in route state:
        // SeatSelection loads the seat map with showtime.id, and Checkout reads
        // the movie/branch/date/showtime details for its summary.
        navigate(`/booking/${movieId}/seats`, {
            state: {
                movieId,
                movieTitle,
                genres: movie?.genres ?? [],
                rating: movie?.rating,
                poster: movie?.poster ?? null,
                branch: { id: selectedBranch.id, name: selectedBranch.name },
                date: selectedDate,
                showtime: selectedShowtime,
                showtimeId: selectedShowtime.id,
            },
        });
    };

    const renderMain = () => {
        if (loadState === "loading") {
            return <StateBox title="Loading showtimes…">Hang on while we check what's playing.</StateBox>;
        }

        if (loadState === "not-found") {
            return (
                <StateBox tone="error" title="We couldn't find that movie.">
                    <button type="button" className="btn-back-top" onClick={() => navigate("/movies")}>
                        ← Back to movies
                    </button>
                </StateBox>
            );
        }

        if (loadState === "error") {
            return (
                <StateBox tone="error" title="Couldn't load showtimes.">
                    <p>{errorMessage}</p>
                    <button type="button" className="btn-back-top" onClick={() => setReloadKey((k) => k + 1)}>
                        Try again
                    </button>
                </StateBox>
            );
        }

        if (bookable.length === 0) {
            return (
                <StateBox title="No showtimes available.">
                    <p>There are no upcoming showtimes for {movieTitle} yet. Please check back later.</p>
                </StateBox>
            );
        }

        return (
            <>
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
                        {branches.map((branch) => (
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
                                    <span className="branch-hours">
                                        {branch.count} showtime{branch.count === 1 ? "" : "s"}
                                    </span>
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
                            <p className="step-subtitle">
                                {selectedBranch
                                    ? `Dates with showtimes at ${selectedBranch.name}`
                                    : "Choose a branch to see its available dates"}
                            </p>
                        </div>
                    </div>

                    {!selectedBranch ? (
                        <p className="showtime-hint">Choose a branch first.</p>
                    ) : (
                        <>
                            <div className="calendar-header">
                                <span className="calendar-month">
                                    {(() => {
                                        const first = visibleDays[0];
                                        const last = visibleDays[visibleDays.length - 1];
                                        return first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()
                                            ? `${MONTH_FULL[first.getMonth()]} ${first.getFullYear()}`
                                            : `${MONTH_ABBR[first.getMonth()]} – ${MONTH_ABBR[last.getMonth()]} ${last.getFullYear()}`;
                                    })()}
                                </span>
                                {totalPages > 1 && (
                                    <div className="calendar-nav">
                                        <button
                                            type="button"
                                            className="calendar-nav-btn"
                                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                                            disabled={page === 0}
                                            aria-label="Previous dates"
                                        >
                                            <IconChevronLeft />
                                        </button>
                                        <button
                                            type="button"
                                            className="calendar-nav-btn"
                                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                            disabled={page >= totalPages - 1}
                                            aria-label="Next dates"
                                        >
                                            <IconChevronRight />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="calendar-strip">
                                {visibleDays.map((day) => {
                                    const isToday = toDateKey(day) === todayKey;
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
                                            <span className="calendar-day-month">{MONTH_ABBR[day.getMonth()]}</span>
                                            {isToday && <span className="calendar-day-today">TODAY</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
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

                    {!selectedBranch || !selectedDate ? (
                        <p className="showtime-hint">Choose a branch and a date to see the showtimes.</p>
                    ) : screenings.length === 0 ? (
                        <p className="showtime-hint">
                            No showtimes at {selectedBranch.name} on {formatSidebarDate(selectedDate)}. Try another date.
                        </p>
                    ) : (
                        screenings.map((screening) => (
                            <div className="screening-group" key={screening.cinemaId}>
                                <div className="screening-header">
                                    <div className="screening-header-left">
                                        <span className="format-badge">{FORMAT_LABEL}</span>
                                        <span className="screening-price">₱{movie?.price ?? 0} / seat</span>
                                    </div>
                                    <span className="screening-hall">{screening.hall}</span>
                                </div>

                                <div className="time-slots">
                                    {screening.times.map((slot) => {
                                        const isSelected = selectedShowtime && selectedShowtime.id === slot.id;

                                        return (
                                            <button
                                                type="button"
                                                key={slot.id}
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
                        ))
                    )}
                </div>
            </>
        );
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
                    
                    <button
                        type="button"
                        className="btn-back-top"
                        onClick={() => navigate(`/movies/${movieId}`)}>
                        ← Back
                    </button>
                </div>

                <div className="showtime-layout">
                    <div className="showtime-main">{renderMain()}</div>

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

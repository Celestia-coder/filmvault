import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import heroBg from "../../assets/images/hero-bg.png";
import moviePoster from "../../assets/images/movie-poster.webp";
import "../../styles/MovieDetails.css";

const API_URL = "http://localhost:5000";

/* ---------------------------------------------------------------- */
/* Icons                                                              */
/* ---------------------------------------------------------------- */

const IconClock = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
    </svg>
);

const IconCalendar = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
);

const IconFilm = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="2" y="3" width="20" height="18" rx="2" />
        <path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5" />
    </svg>
);

const IconShield = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z" />
    </svg>
);

const IconTicket = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M2 9a3 3 0 1 0 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 1 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2Z" />
        <path d="M9 5v14" strokeDasharray="3 3" />
    </svg>
);

/* ---------------------------------------------------------------- */
/* Helpers                                                            */
/* ---------------------------------------------------------------- */

const RATING_LABELS = {
    G: "General Audiences",
    PG: "Parental Guidance",
    "PG-13": "Parents Strongly Cautioned",
    R: "Restricted",
};

const STATUS_LABELS = {
    upcoming: "Coming Soon",
    "now-showing": "Now Showing",
    ended: "Ended",
};

// 135 -> "2h 15m"
const formatRuntime = (mins) => {
    if (!mins) return "TBA";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
};

// "2026-07-30" -> "Jul 30, 2026" (parsed as UTC so it never shifts a day)
const formatDate = (value) => {
    if (!value) return "TBA";
    const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
};

/* ---------------------------------------------------------------- */
/* Small subcomponent                                                 */
/* ---------------------------------------------------------------- */

function MetaItem({ icon, label, value }) {
    return (
        <div className="meta-item">
            <span className="meta-icon">{icon}</span>
            <span className="meta-text">
                <span className="meta-label">{label}</span>
                <span className="meta-value">{value}</span>
            </span>
        </div>
    );
}

/* ---------------------------------------------------------------- */
/* Page                                                               */
/* ---------------------------------------------------------------- */

function MovieDetails() {
    const { movieId } = useParams();
    const navigate = useNavigate();

    const [movie, setMovie] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null); // "not-found" | "failed" | null

    useEffect(() => {
        const controller = new AbortController();

        async function loadMovie() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`${API_URL}/api/movies/${movieId}`, {
                    signal: controller.signal,
                });

                if (res.status === 404 || res.status === 400) {
                    setMovie(null);
                    setError("not-found");
                    return;
                }
                if (!res.ok) throw new Error(`Request failed: ${res.status}`);

                const data = await res.json();
                setMovie(data.movie);
            } catch (err) {
                if (err.name === "AbortError") return;
                console.error("Failed to load movie:", err);
                setMovie(null);
                setError("failed");
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        loadMovie();
        return () => controller.abort();
    }, [movieId]);

    // Loading / not found / server error
    if (loading || error) {
        const label = loading ? "Loading" : error === "not-found" ? "Not Found" : "Error";
        const heading = loading
            ? "Loading movie..."
            : error === "not-found"
                ? "We couldn't find that movie"
                : "Something went wrong";
        const message = loading
            ? ""
            : error === "not-found"
                ? `There's no movie with ID "${movieId}" in the catalog yet.`
                : "We couldn't reach the server. Please try again in a moment.";

        return (
            <div className="movie-page">
                <div className="movie-bg" style={{ backgroundImage: `url(${heroBg})` }}></div>

                <section className="movie-hero">
                    <Navbar />

                    <div className="movie-not-found">
                        <p className="movie-status">
                            <span className="status-dot" />
                            {label}
                        </p>
                        <h1 className="movie-title">{heading}</h1>
                        {message && <p className="movie-synopsis">{message}</p>}
                        {!loading && (
                            <button type="button" className="btn-back" onClick={() => navigate(-1)}>
                                ← Back
                            </button>
                        )}
                    </div>
                </section>

                <Footer />
            </div>
        );
    }

    // Loaded
    return (
        <div className="movie-page">
            <div className="movie-bg" style={{ backgroundImage: `url(${heroBg})` }}></div>

            <section className="movie-hero">
                <Navbar />

                <div className="movie-layout">
                    <div className="movie-poster-wrap">
                        <img
                            src={movie.poster || moviePoster}
                            alt={`${movie.title} poster`}
                            className="movie-poster"
                            onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = moviePoster;
                            }}
                        />
                    </div>

                    <div className="movie-details">
                        <p className="movie-status">
                            <span className="status-dot" />
                            {STATUS_LABELS[movie.status] || movie.status}
                        </p>

                        <h1 className="movie-title">{movie.title}</h1>

                        <div className="genre-tags">
                            {movie.genres.map((genre) => (
                                <span className="genre-tag" key={genre}>
                                    {genre}
                                </span>
                            ))}
                        </div>

                        <div className="movie-meta-grid">
                            <MetaItem icon={<IconClock />} label="Runtime" value={formatRuntime(movie.duration)} />
                            <MetaItem icon={<IconCalendar />} label="Release Date" value={formatDate(movie.release_date)} />
                            <MetaItem icon={<IconFilm />} label="Director" value={movie.director || "TBA"} />

                            {movie.age_rating && (
                                <div className="meta-item">
                                    <span className="meta-icon">
                                        <IconShield />
                                    </span>
                                    <span className="meta-text">
                                        <span className="meta-label">Restriction</span>
                                        <span className="meta-value restriction-value">
                                            <span className="restriction-badge">{movie.age_rating}</span>
                                            {RATING_LABELS[movie.age_rating] || ""}
                                        </span>
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="movie-section">
                            <h2 className="section-label">Synopsis</h2>
                            <p className="movie-synopsis">{movie.synopsis || "No synopsis available."}</p>
                        </div>

                        {/* The API doesn't return cast yet, so this stays hidden until it does */}
                        {movie.cast?.length > 0 && (
                            <div className="movie-section">
                                <h2 className="section-label">Cast</h2>
                                <div className="cast-list">
                                    {movie.cast.map((member) => (
                                        <div className="cast-member" key={member.actor}>
                                            <span className="cast-avatar">{member.initials}</span>
                                            <span className="cast-info">
                                                <span className="cast-actor">{member.actor}</span>
                                                <span className="cast-character">{member.character}</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="movie-actions">
                            {/* Placeholder destination — no booking flow built yet */}
                            <Link to={`/booking/${movie.movie_id}`} className="btn-buy-tickets">
                                <IconTicket />
                                Buy Tickets
                            </Link>

                            <button type="button" className="btn-back" onClick={() => navigate(-1)}>
                                ← Back
                            </button>

                            <p className="movie-actions-hint">
                                Select a branch, date, and showtime below to continue.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}

export default MovieDetails;


import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import heroBg from "../../assets/images/hero-bg.png";
import { fetchMovie, STATUS_LABELS } from "../../api/movies.js";
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
/* Small subcomponents                                                */
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

// Same background / navbar / footer for every state of the page
function PageShell({ children }) {
    return (
        <div className="movie-page">
            <div className="movie-bg" style={{ backgroundImage: `url(${heroBg})` }}></div>

            <section className="movie-hero">
                <Navbar />
                {children}
            </section>

            <Footer />
        </div>
    );
}

// Loading / error / not-found all share this centered block
function StateMessage({ label, title, text, isLoading, children }) {
    return (
        <div className={`movie-not-found${isLoading ? " is-loading" : ""}`} role={isLoading ? "status" : undefined}>
            <p className="movie-status">
                <span className="status-dot" />
                {label}
            </p>
            <h1 className="movie-title">{title}</h1>
            {text && <p className="movie-synopsis">{text}</p>}
            {children && <div className="movie-actions">{children}</div>}
        </div>
    );
}

function initialsOf(name) {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word[0])
        .join("")
        .toUpperCase();
}

/* ---------------------------------------------------------------- */
/* Page                                                               */
/* ---------------------------------------------------------------- */

function MovieDetails() {
    const { movieId } = useParams();
    const navigate = useNavigate();

    const [reloadKey, setReloadKey] = useState(0);
    // { key, movie | error } — "key" ties a result to the request that produced
    // it, so a previous movie's data never shows up while the next one loads.
    const [movieResult, setMovieResult] = useState(null);

    // Only positive whole numbers can be real IDs; skip the request for "abc", "0", etc.
    const isValidId = /^[1-9]\d*$/.test(movieId);
    const requestKey = `${movieId}:${reloadKey}`;

    useEffect(() => {
        if (!isValidId) return undefined;
        const controller = new AbortController();

        fetchMovie(movieId, controller.signal)
            .then((movie) => setMovieResult({ key: requestKey, movie }))
            .catch((error) => {
                if (error.name === "AbortError") return;
                setMovieResult({ key: requestKey, error });
            });

        return () => controller.abort();
    }, [movieId, isValidId, requestKey]);

    const backButton = (
        <button type="button" className="btn-back" onClick={() => navigate(-1)}>
            ← Back
        </button>
    );

    const notFound = (
        <StateMessage
            label="Not Found"
            title="We couldn't find that movie"
            text={`There's no movie with ID "${movieId}" in the catalog.`}
        >
            {backButton}
            <Link to="/movies" className="btn-buy-tickets">
                Browse movies
            </Link>
        </StateMessage>
    );

    if (!isValidId) return <PageShell>{notFound}</PageShell>;

    const current = movieResult?.key === requestKey ? movieResult : null;

    if (!current) {
        return (
            <PageShell>
                <StateMessage label="Loading" title="Loading movie…" isLoading />
            </PageShell>
        );
    }

    if (current.error) {
        // 400/404 = no such movie; anything else (500, network) is a real error worth retrying
        if (current.error.status === 400 || current.error.status === 404) {
            return <PageShell>{notFound}</PageShell>;
        }
        return (
            <PageShell>
                <StateMessage label="Error" title="Couldn't load this movie" text={current.error.message}>
                    <button type="button" className="btn-buy-tickets" onClick={() => setReloadKey((n) => n + 1)}>
                        Try again
                    </button>
                    {backButton}
                </StateMessage>
            </PageShell>
        );
    }

    const { movie } = current;

    return (
        <PageShell>
            <div className="movie-layout">
                <div className="movie-poster-wrap">
                    <img
                        src={movie.poster}
                        alt={`${movie.title} poster`}
                        className="movie-poster"
                    />
                </div>

                <div className="movie-details">
                    <p className="movie-status">
                        <span className="status-dot" />
                        {STATUS_LABELS[movie.status] ?? movie.status}
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
                        <MetaItem icon={<IconClock />} label="Runtime" value={movie.runtime} />
                        <MetaItem icon={<IconCalendar />} label="Release Date" value={movie.releaseDate} />
                        <MetaItem icon={<IconFilm />} label="Director" value={movie.director} />

                        <div className="meta-item">
                            <span className="meta-icon">
                                <IconShield />
                            </span>
                            <span className="meta-text">
                                <span className="meta-label">Restriction</span>
                                <span className="meta-value restriction-value">
                                    <span className="restriction-badge">{movie.restriction.code}</span>
                                    {movie.restriction.label}
                                </span>
                            </span>
                        </div>
                    </div>

                    {movie.synopsis && (
                        <div className="movie-section">
                            <h2 className="section-label">Synopsis</h2>
                            <p className="movie-synopsis">{movie.synopsis || "No synopsis available."}</p>
                        </div>
                    )}

                    {movie.cast.length > 0 && (
                        <div className="movie-section">
                            <h2 className="section-label">Cast</h2>
                            <div className="cast-list">
                                {movie.cast.map((name) => (
                                    <div className="cast-member" key={name}>
                                        <span className="cast-avatar">{initialsOf(name)}</span>
                                        <span className="cast-info">
                                            <span className="cast-actor">{name}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="movie-actions">
                        {/* Tickets only make sense for movies that are showing */}
                        {movie.status === "now-showing" && (
                            <Link to={`/booking/${movie.id}`} className="btn-buy-tickets">
                                <IconTicket />
                                Buy Tickets
                            </Link>
                        )}

                        {backButton}
                    </div>
                </div>
            </div>
        </PageShell>
    );
}

export default MovieDetails;

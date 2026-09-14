

import { useParams, useNavigate, Link } from "react-router";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import heroBg from "../../assets/images/hero-bg.png";
import moviePoster from "../../assets/images/movie-poster.webp";
import "../../styles/MovieDetails.css";


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

const MOVIES = [
    {
        id: "1",
        title: "How To Train Your Dragon",
        poster: moviePoster,
        genres: ["Adventure", "Fantasy", "Family", "Action"],
        runtime: "2h 5m",
        releaseDate: "Jun 13, 2025",
        director: "Dean DeBlois",
        restriction: { code: "PG", label: "Parental Guidance" },
        synopsis:
            "On the rugged isle of Berk, a young Viking named Hiccup defies generations of tradition when he befriends Toothless, a feared Night Fury dragon. Their unlikely bond challenges everything his people believe — and forges a path that could end the war between Vikings and dragons forever.",
        cast: [
            { initials: "MT", actor: "Mason Thames", character: "Hiccup" },
            { initials: "NP", actor: "Nico Parker", character: "Astrid" },
            { initials: "GB", actor: "Gerard Butler", character: "Stoick" },
            { initials: "NF", actor: "Nick Frost", character: "Gobber" },
        ],
    },
    {
        id: "2",
        title: "Starlight Voyage",
        poster: moviePoster,
        genres: ["Sci-Fi", "Adventure"],
        runtime: "1h 58m",
        releaseDate: "Jul 4, 2025",
        director: "Elena Cruz",
        restriction: { code: "PG-13", label: "Parents Strongly Cautioned" },
        synopsis:
            "When a young engineer picks up a signal from beyond the solar system, she has to convince a skeptical crew to chase it across the galaxy before a rival nation gets there first.",
        cast: [
            { initials: "MC", actor: "Maya Chen", character: "Dr. Alex Rivera" },
            { initials: "JO", actor: "Jonah Okafor", character: "Captain Reyes" },
            { initials: "SL", actor: "Sofia Lindqvist", character: "Nadia" },
        ],
    },
    {
        id: "3",
        title: "The Last Bloom",
        poster: moviePoster,
        genres: ["Drama", "Family"],
        runtime: "1h 47m",
        releaseDate: "Aug 22, 2025",
        director: "Thomas Reyes",
        restriction: { code: "G", label: "General Audiences" },
        synopsis:
            "A florist returning to her hometown after years away has to reconnect with her estranged sister to save their late mother's shop before the season's last bloom fades.",
        cast: [
            { initials: "AW", actor: "Amara Whitfield", character: "Iris" },
            { initials: "DK", actor: "Daniel Kessler", character: "Owen" },
        ],
    },
];

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

    const movie = MOVIES.find((m) => m.id === movieId);

    if (!movie) {
        return (
            <div className="movie-page">
                <div className="movie-bg" style={{ backgroundImage: `url(${heroBg})` }}></div>

                <section className="movie-hero">
                    <Navbar />

                    <div className="movie-not-found">
                        <p className="movie-status">
                            <span className="status-dot" />
                            Not Found
                        </p>
                        <h1 className="movie-title">We couldn't find that movie</h1>
                        <p className="movie-synopsis">
                            There's no movie with ID "{movieId}" in the catalog yet.
                        </p>
                        <button type="button" className="btn-back" onClick={() => navigate(-1)}>
                            ← Back
                        </button>
                    </div>
                </section>

                <Footer />
            </div>
        );
    }

    return (
        <div className="movie-page">
            <div className="movie-bg" style={{ backgroundImage: `url(${heroBg})` }}></div>

            <section className="movie-hero">
                <Navbar />

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
                            Now Showing
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

                        <div className="movie-section">
                            <h2 className="section-label">Synopsis</h2>
                            <p className="movie-synopsis">{movie.synopsis}</p>
                        </div>

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

                        <div className="movie-actions">
                            {/* Placeholder destination — no booking flow built yet */}
                            <Link to={`/booking/${movie.id}`} className="btn-buy-tickets">
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
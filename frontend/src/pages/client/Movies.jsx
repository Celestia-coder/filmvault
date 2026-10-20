// Movies.jsx — Owner: [Your Name]
// Route: "/movies"
// Data: GET /api/movies, or GET /api/movies/search when ?title= is set (from the navbar search)

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import heroBg from "../../assets/images/hero-bg.png";
import { fetchMovies } from "../../api/movies.js";
import "../../styles/Movies.css";

const SKELETON_COUNT = 8;

function MovieCard({ movie, showSoonBadge }) {
  return (
    <Link to={`/movies/${movie.id}`} className="movie-card">
      <div className="movie-poster">
        <img src={movie.poster} alt={movie.title} />
        {showSoonBadge && <span className="soon-badge">SOON</span>}
      </div>
      <div className="movie-info">
        <h3>
          <span className="movie-title-text">{movie.title}</span>
          <span className="rating-badge">{movie.rating}</span>
        </h3>
        <p className="movie-genre">{movie.genres.join(" / ")}</p>
      </div>
    </Link>
  );
}

function MovieSection({ label, title, movies, showSoonBadge, isRefreshing }) {
  if (movies.length === 0) return null;
  return (
    <section className="movies-section">
      <p className="section-label">{label}</p>
      <h2 className="section-title">{title}</h2>
      <div className={`movie-grid${isRefreshing ? " is-refreshing" : ""}`}>
        {movies.map((movie) => (
          <MovieCard key={movie.id} movie={movie} showSoonBadge={showSoonBadge} />
        ))}
      </div>
    </section>
  );
}

function Movies() {
  const [searchParams, setSearchParams] = useSearchParams();
  const title = (searchParams.get("title") ?? "").trim();
  const [reloadKey, setReloadKey] = useState(0);

  // { key, movies, error } — "key" says which request the result belongs to,
  // so a result is only treated as current while its key matches the search.
  const [result, setResult] = useState(null);

  const requestKey = JSON.stringify({ title, reloadKey });

  useEffect(() => {
    const controller = new AbortController();

    fetchMovies({ title }, controller.signal)
      .then((movies) => setResult({ key: requestKey, movies, error: null }))
      .catch((error) => {
        if (error.name === "AbortError") return;
        setResult({ key: requestKey, movies: [], error: error.message });
      });

    return () => controller.abort();
  }, [requestKey, title]);

  const isLoading = !result || result.key !== requestKey;
  const movies = result?.movies ?? [];
  const nowShowing = movies.filter((movie) => movie.status === "now-showing");
  const comingSoon = movies.filter((movie) => movie.status === "upcoming");

  let content;
  if (isLoading && movies.length === 0) {
    content = (
      <section className="movies-section" aria-busy="true" aria-label="Loading movies">
        <div className="movie-grid">
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <div className="movie-card-skeleton" key={index}>
              <div className="skeleton-poster" />
              <div className="skeleton-line" />
            </div>
          ))}
        </div>
      </section>
    );
  } else if (!isLoading && result.error) {
    content = (
      <section className="movies-section movies-message" role="alert">
        <h2 className="section-title">Couldn't load movies</h2>
        <p>{result.error}</p>
        <button type="button" className="movies-btn" onClick={() => setReloadKey((n) => n + 1)}>
          Try again
        </button>
      </section>
    );
  } else if (!isLoading && movies.length === 0) {
    content = (
      <section className="movies-section movies-message">
        <h2 className="section-title">{title ? `No movies match "${title}"` : "No movies yet"}</h2>
        <p>
          {title
            ? "Try a different title."
            : "Nothing is showing or coming soon right now. Check back later."}
        </p>
        {title && (
          <button type="button" className="movies-btn" onClick={() => setSearchParams({})}>
            Show all movies
          </button>
        )}
      </section>
    );
  } else {
    content = (
      <>
        <MovieSection
          label="IN THEATERS"
          title="NOW SHOWING"
          movies={nowShowing}
          isRefreshing={isLoading}
        />
        <MovieSection
          label="ON THE HORIZON"
          title="COMING SOON"
          movies={comingSoon}
          showSoonBadge
          isRefreshing={isLoading}
        />
      </>
    );
  }

  return (
    <div className="movies-page">
      <div className="movies-bg" style={{ backgroundImage: `url(${heroBg})` }}></div>

      <Navbar />

      {content}

      <Footer />
    </div>
  );
}

export default Movies;

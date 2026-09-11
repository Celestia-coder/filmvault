// Movies.jsx — Owner: [Your Name]
// Route: "/movies"
import { Link } from "react-router";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import heroBg from "../../assets/images/hero-bg.png";
import "../../styles/Movies.css";

// Now Showing posters
import cars2 from "../../assets/images/movies/cars-2.jpg";
import htyd from "../../assets/images/movies/how-to-train-your-dragon.jpg";
import demonSlayer from "../../assets/images/movies/demon-slayer.jpg";
import readyOrNot2 from "../../assets/images/movies/ready-or-not-2.jpg"; // TODO: confirm actual filename
import anyoneButYou from "../../assets/images/movies/anyone-but-you.jpg";
import wicked from "../../assets/images/movies/wicked.jpg";
import jumanji from "../../assets/images/movies/jumanji.jpg";
import wonderWoman from "../../assets/images/movies/wonderwoman.jpg";

// Coming Soon posters
import toyStory5 from "../../assets/images/movies/toy-story-5.jpg";
import odyssey from "../../assets/images/movies/odyssey.jpg";
import supergirl from "../../assets/images/movies/supergirl.jpg";
import spiderman from "../../assets/images/movies/spiderman.jpg";
import doomsday from "../../assets/images/movies/doomsday.jpg";
import moana from "../../assets/images/movies/moana.jpg";
import projectHailMary from "../../assets/images/movies/project-hailmary.jpg";
import huwagKangTitingin from "../../assets/images/movies/huwag-kang-titingin.jpg";

// Hardcoded movie list — placeholder data so QA can check layout
const NOW_SHOWING = [
  { id: 1, title: "Cars 2", rating: "PG", genre: "ANIMATION", poster: cars2 },
  { id: 2, title: "How to Train Your Dragon", rating: "PG-13", genre: "FANTASY", poster: htyd },
  { id: 3, title: "Demon Slayer: Infinity Castle", rating: "PG-13", genre: "ACTION", poster: demonSlayer },
  { id: 4, title: "Ready or Not 2", rating: "R", genre: "THRILLER", poster: readyOrNot2 },
  { id: 5, title: "Anyone But You", rating: "R", genre: "ROMANCE", poster: anyoneButYou },
  { id: 6, title: "Wicked", rating: "PG", genre: "FANTASY", poster: wicked },
  { id: 7, title: "Jumanji: Welcome to the Jungle", rating: "PG-13", genre: "ACTION", poster: jumanji },
  { id: 8, title: "Wonder Woman", rating: "PG-13", genre: "ACTION", poster: wonderWoman },
];

const COMING_SOON = [
  { id: 9, title: "Toy Story 5", rating: "PG", genre: "ANIMATION", poster: toyStory5 },
  { id: 10, title: "The Odyssey", rating: "R", genre: "EPIC FANTASY", poster: odyssey },
  { id: 11, title: "Supergirl", rating: "PG-13", genre: "SUPERHERO", poster: supergirl },
  { id: 12, title: "Spiderman: Brand New Day", rating: "PG-13", genre: "ACTION", poster: spiderman },
  { id: 13, title: "Avengers: Doomsday", rating: "PG-13", genre: "SUPERHERO", poster: doomsday },
  { id: 14, title: "Moana", rating: "PG", genre: "FANTASY ADVENTURE", poster: moana },
  { id: 15, title: "Project Hail Mary", rating: "PG-13", genre: "SCI-FI", poster: projectHailMary },
  { id: 16, title: "Huwag Kang Titingin", rating: "R-13", genre: "HORROR", poster: huwagKangTitingin },
];

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
        <p className="movie-genre">{movie.genre}</p>
      </div>
    </Link>
  );
}

function Movies() {
  return (
    <div className="movies-page">
      <div
        className="movies-bg"
        style={{ backgroundImage: `url(${heroBg})` }}
      ></div>

      <Navbar />

      <section className="movies-section">
        <p className="section-label">IN THEATERS</p>
        <h2 className="section-title">NOW SHOWING</h2>
        <div className="movie-grid">
          {NOW_SHOWING.map((movie) => (
            <MovieCard key={movie.id} movie={movie} />
          ))}
        </div>
      </section>

      <section className="movies-section">
        <p className="section-label">ON THE HORIZON</p>
        <h2 className="section-title">COMING SOON</h2>
        <div className="movie-grid">
          {COMING_SOON.map((movie) => (
            <MovieCard key={movie.id} movie={movie} showSoonBadge />
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default Movies;
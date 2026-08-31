// Home.jsx — Owner: [Your Name]
// Route: "/"

import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import heroBg from "../../assets/images/hero-bg.png";
import logo from "../../assets/images/logo.png";
import "../../styles/Home.css";

function Home() {
	return (
		<div className="home-page">
			<div
				className="hero-bg"
				style={{ backgroundImage: `url(${heroBg})` }}
			></div>

			<section className="hero">
				<Navbar />

				<div className="hero-content">
					<img src={logo} alt="FilmVault" className="hero-logo" />
					<h1>Your Gateway to the Big Screen</h1>
					<p>
						FilmVault is a modern and convenient movie ticketing
						system designed to make booking cinema tickets fast,
						easy, and hassle-free. Browse the latest movies, check
						showtimes, view available seats, and reserve your
						tickets in just a few clicks. With an intuitive
						interface and real-time seat selection, FilmVault
						provides a seamless booking experience for moviegoers.
						Whether you're planning a solo movie night or a group
						outing, FilmVault helps you secure the best seats and
						enjoy your favorite films without the long lines.
						Experience smarter movie ticket booking with
						FilmVault—where every great movie journey begins.
					</p>

					<div className="hero-buttons">
						{/* TODO: wrap with <Link to="/login"> once React Router is used here */}
						<a href="/login" className="btn-primary">
							Login
						</a>
						<a href="/signup" className="btn-secondary">
							Sign Up
						</a>
					</div>
				</div>
			</section>

			<Footer />
		</div>
	);
}

export default Home;

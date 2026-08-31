// Navbar.jsx
// Shared top navigation bar used across all CLIENT pages.
// Import wherever needed: import Navbar from '../../components/Navbar';

import logo from "../assets/images/logo.png";
import searchIcon from "../assets/images/icons/search-icon.png";
import profileIcon from "../assets/images/icons/profile-icon.png";
import "../styles/Navbar.css";

function Navbar() {
	return (
		<nav className="navbar">
			<div className="navbar-logo">
				FILMVAULT
			</div>

			<div className="navbar-links">
				<a href="/movies">Movies</a>
				<a href="/cinemas">Cinemas</a>
				<a href="/tickets">Tickets</a>
			</div>

			<div className="navbar-icons">
				<button className="icon-btn" aria-label="Search">
					<img src={searchIcon} alt="Search" className="icon-img" />
				</button>
				<button className="icon-btn" aria-label="Account">
					<img src={profileIcon} alt="Account" className="icon-img" />
				</button>
			</div>
		</nav>
	);
}

export default Navbar;

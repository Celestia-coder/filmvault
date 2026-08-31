// Footer.jsx
// Shared footer used across all CLIENT pages.
// Import wherever needed: import Footer from '../../components/Footer';

import "../styles/Footer.css";

function Footer() {
	return (
		<footer className="footer">
			<div className="footer-top">
				<div className="footer-brand">
					<h3>FILMVAULT</h3>
					<p>
						Your trusted movie ticketing platform for quick, secure,
						and hassle-free cinema reservations. Discover movies,
						choose your seats, and book your tickets anytime,
						anywhere.
					</p>
				</div>

				<div className="footer-column">
					<h4>Home</h4>
					<a href="/now-showing">Now Showing</a>
					<a href="/coming-soon">Coming Soon</a>
				</div>

				<div className="footer-column">
					<h4>Cinemas</h4>
					<a href="/cinemas">Search Branches</a>
				</div>

				<div className="footer-column">
					<h4>Tickets</h4>
					<a href="/tickets/active">Active Tickets</a>
					<a href="/tickets/past">Past Transactions</a>
				</div>

				<div className="footer-column">
					<h4>Support</h4>
					<a href="/contact">Contact Us</a>
				</div>
			</div>

			<div className="footer-bottom">
				<span>@2026 FilmVault, All Rights Reserved</span>
				<div className="footer-legal">
					<a href="/terms">Terms of Use</a>
					<a href="/privacy">Privacy Policy</a>
					<a href="/cookies">Cookie Policy</a>
				</div>
			</div>
		</footer>
	);
}

export default Footer;

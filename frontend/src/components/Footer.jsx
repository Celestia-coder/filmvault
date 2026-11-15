// Footer.jsx
// Shared footer used across all CLIENT pages.
// Import wherever needed: import Footer from '../../components/Footer';

import { Link } from "react-router";
import "../styles/Footer.css";

// Footer links open the new page at the top instead of where the footer was
function FooterLink({ to, children }) {
	return (
		<Link to={to} onClick={() => window.scrollTo(0, 0)}>
			{children}
		</Link>
	);
}

function Footer() {
	const year = new Date().getFullYear();

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
					<FooterLink to="/movies">Now Showing</FooterLink>
					<FooterLink to="/movies">Coming Soon</FooterLink>
				</div>

				<div className="footer-column">
					<h4>Cinemas</h4>
					<FooterLink to="/cinemas">Search Branches</FooterLink>
				</div>

				<div className="footer-column">
					<h4>Tickets</h4>
					<FooterLink to="/tickets">Active Tickets</FooterLink>
					<FooterLink to="/tickets">Past Transactions</FooterLink>
				</div>

				<div className="footer-column">
					<h4>Support</h4>
					<FooterLink to="/profile">My Account</FooterLink>
					<FooterLink to="/terms">Terms &amp; Conditions</FooterLink>
				</div>
			</div>

			<div className="footer-bottom">
				<span>© {year} FilmVault. All Rights Reserved.</span>
				<div className="footer-legal">
					<FooterLink to="/terms">Terms of Use</FooterLink>
					<FooterLink to="/privacy">Privacy Policy</FooterLink>
					<FooterLink to="/cookies">Cookie Policy</FooterLink>
				</div>
			</div>
		</footer>
	);
}

export default Footer;

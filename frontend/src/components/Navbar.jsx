// Navbar.jsx
// '../../components/Navbar';

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import searchIcon from "../assets/images/icons/search-icon.png";
import profileIcon from "../assets/images/icons/profile-icon.png";
import "../styles/Navbar.css";

// Placeholder auth check — swap this out once real Auth endpoints exist
// (Week 2 backend work). For now, presence of a token means "logged in".
function isLoggedIn() {
	return Boolean(localStorage.getItem("filmvault_token"));
}

function Navbar() {
	const navigate = useNavigate();
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchValue, setSearchValue] = useState("");
	const searchInputRef = useRef(null);
	const searchWrapperRef = useRef(null);

	const closeSearch = () => {
		setSearchOpen(false);
		setSearchValue("");
	};

	const handleSearchToggle = () => {
		if (searchOpen) {
			closeSearch();
		} else {
			setSearchOpen(true);
		}
	};

	const handleLogoClick = (event) => {
		event.preventDefault();
		navigate(isLoggedIn() ? "/movies" : "/");
	};

	// Autofocus the input the moment the search pill opens
	useEffect(() => {
		if (searchOpen) {
			searchInputRef.current?.focus();
		}
	}, [searchOpen]);

	// Click-outside-to-close — only listens for clicks, so scrolling
	// (up or down) never affects the open search bar.
	useEffect(() => {
		if (!searchOpen) return undefined;

		const handleClickOutside = (event) => {
			if (
				searchWrapperRef.current &&
				!searchWrapperRef.current.contains(event.target)
			) {
				closeSearch();
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [searchOpen]);

	return (
		<nav className="navbar">
			<a href="/" className="navbar-logo" onClick={handleLogoClick}>
				FILMVAULT
			</a>

			<div className="navbar-links">
				<Link to="/movies">Movies</Link>
				<Link to="/cinemas">Cinemas</Link>
				<Link to="/tickets">Tickets</Link>
			</div>

			<div className="navbar-icons">
				<div className="navbar-search-wrapper" ref={searchWrapperRef}>
					{searchOpen ? (
						<div className="navbar-search navbar-search--open">
							<button
								type="button"
								className="navbar-search-icon-btn"
								aria-label="Close search"
								onClick={handleSearchToggle}
							>
								<img src={searchIcon} alt="" className="navbar-search-icon-img" />
							</button>
							<input
								ref={searchInputRef}
								type="text"
								className="navbar-search-input"
								placeholder="Search"
								value={searchValue}
								onChange={(event) => setSearchValue(event.target.value)}
							/>
							<button
								type="button"
								className="navbar-search-clear"
								aria-label="Clear search"
								onClick={closeSearch}
							>
								×
							</button>
						</div>
					) : (
						<button
							type="button"
							className="icon-btn"
							aria-label="Search"
							onClick={handleSearchToggle}
						>
							<img src={searchIcon} alt="" className="icon-img" />
						</button>
					)}
				</div>

				<Link to="/profile" className="icon-btn" aria-label="Account">
					<img src={profileIcon} alt="" className="icon-img" />
				</Link>
			</div>
		</nav>
	);
}

export default Navbar;
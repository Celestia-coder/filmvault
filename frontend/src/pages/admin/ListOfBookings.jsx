// ListOfBookings.jsx — Admin list of bookings
// Route: "/admin/bookings"
//
// All data is placeholder client-side state until the backend exists.
// Filters (status tabs, search, movie, date) all combine; pagination runs
// over the filtered result. Clicking a row opens a read-only detail view.

import { useEffect, useState } from "react";
import { Link } from "react-router";
import "../../styles/ListOfBookings.css";

import AdminSidebar from "../../components/AdminSidebar.jsx";
import Dropdown from "../../components/Dropdown.jsx";
import navBookings from "../../assets/images/dashboard/nav-bookings.svg";

import posterWhiteChicks from "../../assets/images/dashboard/white-chicks.png";
import posterMeanGirls from "../../assets/images/dashboard/mean-girls.png";
import posterDisclosureDay from "../../assets/images/dashboard/disclosure-day.png";
import posterToyStory from "../../assets/images/dashboard/toy-story-5.png";
import posterDevilWearsPrada from "../../assets/images/dashboard/devil-wears-prada-2.png";

const PAGE_SIZE = 10;

// Same catalog and ticket prices as the admin dashboard.
const MOVIES = [
	{ id: "white-chicks", title: "White Chicks", price: 550, poster: posterWhiteChicks },
	{ id: "mean-girls", title: "Mean Girls", price: 500, poster: posterMeanGirls },
	{ id: "disclosure-day", title: "Disclosure Day", price: 600, poster: posterDisclosureDay },
	{ id: "toy-story-5", title: "Toy Story 5", price: 350, poster: posterToyStory },
	{ id: "devil-wears-prada-2", title: "The Devil Wears Prada 2", price: 800, poster: posterDevilWearsPrada },
];

const SHOWTIMES = [
	{ movieId: "devil-wears-prada-2", datetime: "2026-06-05T10:00", cinema: "Cinema 1", branch: "Vista Mall Taguig" },
	{ movieId: "toy-story-5", datetime: "2026-06-05T13:00", cinema: "Cinema 2", branch: "Vista Mall Taguig" },
	{ movieId: "mean-girls", datetime: "2026-06-06T10:30", cinema: "Cinema 1", branch: "Market! Market!" },
	{ movieId: "disclosure-day", datetime: "2026-06-06T15:00", cinema: "Cinema 3", branch: "Market! Market!" },
	{ movieId: "white-chicks", datetime: "2026-06-06T19:30", cinema: "Cinema 2", branch: "Venice McKinley" },
	{ movieId: "toy-story-5", datetime: "2026-06-07T12:00", cinema: "Cinema 1", branch: "Venice McKinley" },
	{ movieId: "devil-wears-prada-2", datetime: "2026-06-07T18:30", cinema: "Cinema 3", branch: "Vista Mall Taguig" },
	{ movieId: "mean-girls", datetime: "2026-06-08T16:00", cinema: "Cinema 2", branch: "Market! Market!" },
];

const FIRST_NAMES = ["Ralph", "Jose", "Trisha", "Juan", "Christine", "Gabriel", "Juliana", "Ben", "Maria", "Angelo", "Patricia", "Miguel", "Andrea", "Carlo", "Bea"];
const LAST_NAMES = ["Tomas", "Reyes", "Esguerra", "Rivera", "Dela Cruz", "Santos", "Bernabe", "Domingo", "Garcia", "Mendoza", "Villanueva", "Ramos", "Aquino", "Castillo", "Navarro"];
const SEAT_ROWS = "ABCDEFGHJ";
const PAYMENT_METHODS = ["GCash", "Credit Card", "Maya"];
const CANCELLED_AT = new Set([6, 17, 29, 38, 51]);
const PENDING_AT = new Set([9, 23, 44]);

function findMovie(movieId) {
	return MOVIES.find((movie) => movie.id === movieId);
}

// 55 placeholder bookings built from the seed lists above, so there's
// enough data to paginate without hand-writing every row. Deterministic:
// the same input always produces the same rows.
const BOOKINGS = Array.from({ length: 55 }, (_, index) => {
	const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
	const lastName = LAST_NAMES[(index * 7 + Math.floor(index / FIRST_NAMES.length)) % LAST_NAMES.length];
	const showtime = SHOWTIMES[(index * 3) % SHOWTIMES.length];
	const movie = findMovie(showtime.movieId);

	const seatRow = SEAT_ROWS[(index * 5) % SEAT_ROWS.length];
	const firstSeat = 1 + ((index * 3) % 9);
	const seats = Array.from({ length: 1 + (index % 4) }, (_, offset) => `${seatRow}${firstSeat + offset}`);

	let status = "Confirmed";
	if (CANCELLED_AT.has(index)) status = "Cancelled";
	if (PENDING_AT.has(index)) status = "Pending";

	return {
		id: index + 1,
		reference: `FV-2026-${String(index + 1).padStart(5, "0")}`,
		customer: {
			name: `${firstName} ${lastName}`,
			email: `${firstName}.${lastName}`.toLowerCase().replace(/\s+/g, "") + "@gmail.com",
		},
		movieId: movie.id,
		datetime: showtime.datetime,
		cinema: showtime.cinema,
		branch: showtime.branch,
		seats,
		amount: seats.length * movie.price,
		status,
		paymentMethod: PAYMENT_METHODS[index % PAYMENT_METHODS.length],
		bookedOn: `2026-06-0${1 + (index % 4)}`,
	};
});

const STATUS_TABS = ["All", "Confirmed", "Pending", "Cancelled"];

const MOVIE_FILTER_OPTIONS = [
	{ value: "all", label: "All Movies" },
	...MOVIES.map((movie) => ({ value: movie.id, label: movie.title, thumbnail: movie.poster })),
];

// "2026-06-06T10:30" -> "Jun 6, 2026 10:30 AM"
function formatDatetime(value) {
	const date = new Date(value);
	const datePart = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
	const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
	return `${datePart} ${timePart}`;
}

// "2026-06-06" -> "Jun 6, 2026"
function formatDateOnly(value) {
	return new Date(`${value}T00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatPeso(amount) {
	return `₱${amount.toLocaleString("en-US")}`;
}

function getInitials(name) {
	const parts = name.split(" ");
	return `${parts[0][0]}${parts[parts.length - 1][0]}`;
}

// Every distinct showtime date in the data, oldest first.
const DATE_FILTER_OPTIONS = [
	{ value: "all", label: "All Dates" },
	...[...new Set(BOOKINGS.map((booking) => booking.datetime.slice(0, 10)))]
		.sort()
		.map((date) => ({ value: date, label: formatDateOnly(date) })),
];

const IconSearch = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<circle cx="11" cy="11" r="7" />
		<path d="M20 20l-3.5-3.5" />
	</svg>
);

const IconChevronLeft = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M15 18l-6-6 6-6" />
	</svg>
);

const IconChevronRight = () => (
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M9 18l6-6-6-6" />
	</svg>
);

function StatusPill({ status }) {
	return <span className={`status-pill status-pill--${status.toLowerCase()}`}>{status}</span>;
}

function ListOfBookings() {
	const [statusFilter, setStatusFilter] = useState("All");
	const [query, setQuery] = useState("");
	const [movieFilter, setMovieFilter] = useState("all");
	const [dateFilter, setDateFilter] = useState("all");
	const [page, setPage] = useState(1);
	const [selectedId, setSelectedId] = useState(null);

	// Any filter change goes back to page 1 — otherwise you can land on a
	// page that no longer exists for the smaller result set.
	const updateFilter = (setter) => (value) => {
		setter(value);
		setPage(1);
	};

	const normalizedQuery = query.trim().toLowerCase();
	const matchesQuery = (booking) =>
		!normalizedQuery ||
		booking.reference.toLowerCase().includes(normalizedQuery) ||
		booking.customer.name.toLowerCase().includes(normalizedQuery) ||
		booking.customer.email.toLowerCase().includes(normalizedQuery) ||
		booking.seats.some((seat) => seat.toLowerCase().includes(normalizedQuery));

	// Everything except the status tab, so each tab's count shows how many
	// rows it would give you under the current search/movie/date.
	const matchingOtherFilters = BOOKINGS.filter(
		(booking) =>
			matchesQuery(booking) &&
			(movieFilter === "all" || booking.movieId === movieFilter) &&
			(dateFilter === "all" || booking.datetime.startsWith(dateFilter))
	);

	const tabCounts = { All: matchingOtherFilters.length, Confirmed: 0, Pending: 0, Cancelled: 0 };
	matchingOtherFilters.forEach((booking) => {
		tabCounts[booking.status] += 1;
	});

	const filtered =
		statusFilter === "All" ? matchingOtherFilters : matchingOtherFilters.filter((booking) => booking.status === statusFilter);

	const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const currentPage = Math.min(page, totalPages);
	const pageStart = (currentPage - 1) * PAGE_SIZE;
	const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

	// Summary cards describe all bookings, not the current filter.
	const confirmedTotal = BOOKINGS.filter((booking) => booking.status === "Confirmed").length;
	const cancelledTotal = BOOKINGS.filter((booking) => booking.status === "Cancelled").length;

	const selectedBooking = selectedId !== null ? BOOKINGS.find((booking) => booking.id === selectedId) : null;

	// Escape closes the detail view.
	useEffect(() => {
		if (!selectedBooking) return undefined;
		const handleKeyDown = (event) => {
			if (event.key === "Escape") setSelectedId(null);
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [selectedBooking]);

	return (
		<div className="admin-dashboard">
			<AdminSidebar />

			<div className="admin-main">
				<header className="admin-header">
					<h1 className="admin-title">
						<img src={navBookings} alt="" />
						<span>
							List of <em>Bookings</em>
						</span>
					</h1>
					<Link to="/" className="admin-logout">
						Log Out
					</Link>
				</header>

				<section className="bookings-intro">
					<div>
						<h2>List of Bookings</h2>
						<p>Review, search, and manage every ticket booking across branches and showtimes.</p>
					</div>

					<div className="bookings-filters">
						<div className="filter-field">
							<span>Movie</span>
							<Dropdown
								options={MOVIE_FILTER_OPTIONS}
								value={movieFilter}
								onChange={updateFilter(setMovieFilter)}
								ariaLabel="Filter by movie"
							/>
						</div>
						<div className="filter-field">
							<span>Date</span>
							<Dropdown
								options={DATE_FILTER_OPTIONS}
								value={dateFilter}
								onChange={updateFilter(setDateFilter)}
								ariaLabel="Filter by date"
							/>
						</div>
					</div>
				</section>

				<section className="bookings-summary" aria-label="Summary">
					<article className="summary-card">
						<p className="summary-label">Confirmed</p>
						<p className="summary-value summary-value--confirmed">{confirmedTotal}</p>
					</article>
					<article className="summary-card">
						<p className="summary-label">Cancelled</p>
						<p className="summary-value summary-value--cancelled">{cancelledTotal}</p>
					</article>
				</section>

				<section className="bookings-panel">
					<div className="bookings-toolbar">
						<label className="bookings-search">
							<IconSearch />
							<input
								type="search"
								placeholder="Search reference, customer, email, seat..."
								aria-label="Search bookings"
								value={query}
								onChange={(event) => updateFilter(setQuery)(event.target.value)}
							/>
						</label>

						<div className="status-tabs" role="group" aria-label="Filter by status">
							{STATUS_TABS.map((tab) => (
								<button
									key={tab}
									type="button"
									className={`status-tab status-tab--${tab.toLowerCase()}${statusFilter === tab ? " active" : ""}`}
									aria-pressed={statusFilter === tab}
									onClick={() => updateFilter(setStatusFilter)(tab)}
								>
									{tab !== "All" && <span className="status-tab-dot" aria-hidden="true" />}
									{tab}
									<span className="status-tab-count">{tabCounts[tab]}</span>
								</button>
							))}
						</div>
					</div>

					<div className="bookings-meta">
						<p>
							{filtered.length === 0
								? "Showing 0 bookings"
								: `Showing ${pageStart + 1}–${pageStart + pageRows.length} of ${filtered.length} ${
										filtered.length === 1 ? "booking" : "bookings"
									}`}
						</p>

						<nav className="pagination" aria-label="Pagination">
							<button
								type="button"
								className="pagination-btn"
								onClick={() => setPage(currentPage - 1)}
								disabled={currentPage === 1}
								aria-label="Previous page"
							>
								<IconChevronLeft />
							</button>
							{Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
								<button
									key={pageNumber}
									type="button"
									className={`pagination-btn${pageNumber === currentPage ? " active" : ""}`}
									onClick={() => setPage(pageNumber)}
									aria-current={pageNumber === currentPage ? "page" : undefined}
								>
									{pageNumber}
								</button>
							))}
							<button
								type="button"
								className="pagination-btn"
								onClick={() => setPage(currentPage + 1)}
								disabled={currentPage === totalPages}
								aria-label="Next page"
							>
								<IconChevronRight />
							</button>
						</nav>
					</div>

					{pageRows.length === 0 ? (
						<p className="bookings-empty">No bookings match these filters.</p>
					) : (
						<div className="bookings-table-wrap">
							<table className="bookings-table">
								<thead>
									<tr>
										<th>Reference</th>
										<th>Customer</th>
										<th>Movie &amp; Showtime</th>
										<th>Cinema</th>
										<th>Seats</th>
										<th>Amount</th>
										<th>Status</th>
										<th>
											<span className="visually-hidden">Details</span>
										</th>
									</tr>
								</thead>
								<tbody>
									{pageRows.map((booking) => (
										<tr key={booking.id} onClick={() => setSelectedId(booking.id)}>
											<td data-label="Reference" className="booking-reference">
												{booking.reference}
											</td>
											<td data-label="Customer">
												<div className="booking-customer">
													<span className="booking-avatar" aria-hidden="true">
														{getInitials(booking.customer.name)}
													</span>
													<div>
														<p className="booking-primary">{booking.customer.name}</p>
														<p className="booking-secondary">{booking.customer.email}</p>
													</div>
												</div>
											</td>
											<td data-label="Movie & Showtime">
												<p className="booking-primary">{findMovie(booking.movieId).title}</p>
												<p className="booking-secondary">{formatDatetime(booking.datetime)}</p>
											</td>
											<td data-label="Cinema">
												<p className="booking-primary">{booking.cinema}</p>
												<p className="booking-secondary">{booking.branch}</p>
											</td>
											<td data-label="Seats">{booking.seats.join(", ")}</td>
											<td data-label="Amount" className="booking-amount">
												{formatPeso(booking.amount)}
											</td>
											<td data-label="Status">
												<StatusPill status={booking.status} />
											</td>
											<td data-label="Details">
												<button
													type="button"
													className="booking-view-btn"
													onClick={() => setSelectedId(booking.id)}
													aria-label={`View booking ${booking.reference}`}
												>
													<IconChevronRight />
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</section>
			</div>

			{selectedBooking && (
				<div
					className="modal-overlay"
					role="dialog"
					aria-modal="true"
					aria-labelledby="booking-detail-title"
					onClick={(event) => {
						// Only a click on the dimmed backdrop itself closes it.
						if (event.target === event.currentTarget) setSelectedId(null);
					}}
				>
					<div className="modal-card">
						<div className="booking-detail-header">
							<div>
								<p className="booking-reference">{selectedBooking.reference}</p>
								<h2 id="booking-detail-title">{selectedBooking.customer.name}</h2>
								<p className="modal-subtitle">{selectedBooking.customer.email}</p>
							</div>
							<StatusPill status={selectedBooking.status} />
						</div>

						<div className="booking-detail-movie">
							<img src={findMovie(selectedBooking.movieId).poster} alt="" />
							<div>
								<p className="booking-primary">{findMovie(selectedBooking.movieId).title}</p>
								<p className="booking-secondary">{formatDatetime(selectedBooking.datetime)}</p>
							</div>
						</div>

						<dl className="booking-detail-list">
							<div>
								<dt>Cinema</dt>
								<dd>
									{selectedBooking.cinema} · {selectedBooking.branch}
								</dd>
							</div>
							<div>
								<dt>Seats</dt>
								<dd>{selectedBooking.seats.join(", ")}</dd>
							</div>
							<div>
								<dt>Tickets</dt>
								<dd>
									{selectedBooking.seats.length} × {formatPeso(findMovie(selectedBooking.movieId).price)}
								</dd>
							</div>
							<div>
								<dt>Amount</dt>
								<dd className="booking-amount">{formatPeso(selectedBooking.amount)}</dd>
							</div>
							<div>
								<dt>Payment</dt>
								<dd>{selectedBooking.paymentMethod}</dd>
							</div>
							<div>
								<dt>Booked on</dt>
								<dd>{formatDateOnly(selectedBooking.bookedOn)}</dd>
							</div>
						</dl>

						<div className="modal-actions">
							<button type="button" className="modal-btn modal-btn--ghost" onClick={() => setSelectedId(null)}>
								Close
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default ListOfBookings;

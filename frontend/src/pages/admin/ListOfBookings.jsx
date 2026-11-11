// ListOfBookings.jsx — Admin list of bookings
// Route: "/admin/bookings"
//
// Real data:
//   bookings            -> GET /api/admin/bookings?branchId=&date=&movieId=
//   cancel + free seats -> PATCH /api/admin/bookings/:id?branchId=
//   movie/date options  -> GET /api/showtimes + GET /api/movies (this branch only)
//
// The movie and date filters run on the server. The status tabs and the search
// box filter that result in the browser, so every tab can show its count from
// one response. Pagination runs over the filtered result.

import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import "../../styles/ListOfBookings.css";
import "../../styles/AdminLive.css";

import AdminSidebar from "../../components/AdminSidebar.jsx";
import Dropdown from "../../components/Dropdown.jsx";
import navBookings from "../../assets/images/dashboard/nav-bookings.svg";

import { clearUser } from "../../api/session.js";
import { formatDate } from "../../api/movies.js";
import {
	getAdminSession,
	fetchBranchShowtimes,
	fetchAdminBookings,
	cancelBooking,
} from "../../api/admin.js";

const PAGE_SIZE = 10;
const STATUS_TABS = ["All", "Confirmed", "Pending", "Cancelled"];

// "2026-06-06T10:30" -> "Jun 6, 2026 10:30 AM"
function formatDatetime(value) {
	const date = new Date(value);
	const datePart = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
	const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
	return `${datePart} ${timePart}`;
}

// When the purchase was made (an ISO timestamp from the server).
function formatBookedAt(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "—";
	return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatPeso(amount) {
	return `₱${Number(amount).toLocaleString("en-US")}`;
}

function getInitials(name) {
	const parts = name.split(" ").filter(Boolean);
	if (parts.length === 0) return "?";
	return `${parts[0][0]}${parts[parts.length - 1][0]}`;
}

const idStatusText = (booking) => booking.idStatus ?? "Not recorded";

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

function StateBox({ title, text, loading, error, onRetry }) {
	return (
		<div className={`adm-state${error ? " adm-state--error" : ""}`} role={error ? "alert" : "status"}>
			{loading && <span className="adm-spinner" aria-hidden="true" />}
			<p className="adm-state-title">{title}</p>
			{text && <p className="adm-state-text">{text}</p>}
			{onRetry && (
				<button type="button" className="adm-btn" onClick={onRetry}>
					Try again
				</button>
			)}
		</div>
	);
}

function ListOfBookings({ branchId }) {
	const [statusFilter, setStatusFilter] = useState("All");
	const [query, setQuery] = useState("");
	const [movieFilter, setMovieFilter] = useState("all"); // "all" or a movie id
	const [dateFilter, setDateFilter] = useState("all"); // "all" or "YYYY-MM-DD"
	const [page, setPage] = useState(1);
	const [selectedId, setSelectedId] = useState(null);

	const [confirmingCancel, setConfirmingCancel] = useState(false);
	const [cancelling, setCancelling] = useState(false);
	const [cancelError, setCancelError] = useState("");
	const [notice, setNotice] = useState("");

	// Any filter change goes back to page 1 — otherwise you can land on a
	// page that no longer exists for the smaller result set.
	const updateFilter = (setter) => (value) => {
		setter(value);
		setPage(1);
	};

	/* ---------- Filter options (this branch's movies and show dates) ---------- */

	const [optionsResult, setOptionsResult] = useState(null);

	useEffect(() => {
		const controller = new AbortController();
		fetchBranchShowtimes(branchId, controller.signal)
			.then(({ showtimes }) => {
				const movies = new Map();
				showtimes.forEach((showtime) => {
					if (!movies.has(showtime.movieId)) {
						movies.set(showtime.movieId, {
							value: showtime.movieId,
							label: showtime.movieTitle,
							thumbnail: showtime.poster ?? undefined,
						});
					}
				});
				const dates = [...new Set(showtimes.map((showtime) => showtime.date))].sort();
				setOptionsResult({
					movies: [...movies.values()].sort((a, b) => a.label.localeCompare(b.label)),
					dates: dates.map((date) => ({ value: date, label: formatDate(date) })),
				});
			})
			.catch((error) => {
				// Filters just stay on "All"; the bookings list reports its own errors.
				if (error.name !== "AbortError") setOptionsResult({ movies: [], dates: [] });
			});
		return () => controller.abort();
	}, [branchId]);

	const movieOptions = [{ value: "all", label: "All Movies" }, ...(optionsResult?.movies ?? [])];
	const dateOptions = [{ value: "all", label: "All Dates" }, ...(optionsResult?.dates ?? [])];

	/* ---------- Bookings (movie + date are filtered by the server) ---------- */

	const [reloadKey, setReloadKey] = useState(0);
	const [bookingsResult, setBookingsResult] = useState(null);
	const requestKey = `${branchId}:${movieFilter}:${dateFilter}:${reloadKey}`;

	useEffect(() => {
		const controller = new AbortController();
		fetchAdminBookings(
			{
				branchId,
				movieId: movieFilter === "all" ? undefined : movieFilter,
				date: dateFilter === "all" ? undefined : dateFilter,
			},
			controller.signal,
		)
			.then((bookings) => setBookingsResult({ key: requestKey, bookings }))
			.catch((error) => {
				if (error.name === "AbortError") return;
				setBookingsResult({ key: requestKey, error });
			});
		return () => controller.abort();
	}, [branchId, movieFilter, dateFilter, requestKey]);

	const current = bookingsResult?.key === requestKey ? bookingsResult : null;
	const bookings = current?.bookings ?? [];

	/* ---------- Search, status tabs, pagination (in the browser) ---------- */

	const normalizedQuery = query.trim().toLowerCase();
	const matchesSearch = bookings.filter(
		(booking) =>
			!normalizedQuery ||
			booking.reference.toLowerCase().includes(normalizedQuery) ||
			booking.customer.name.toLowerCase().includes(normalizedQuery) ||
			booking.customer.email.toLowerCase().includes(normalizedQuery) ||
			booking.seats.some((seat) => seat.toLowerCase().includes(normalizedQuery)),
	);

	// Each tab's count = how many rows it would show under the current search.
	const tabCounts = { All: matchesSearch.length, Confirmed: 0, Pending: 0, Cancelled: 0 };
	matchesSearch.forEach((booking) => {
		if (booking.status in tabCounts) tabCounts[booking.status] += 1;
	});

	const filtered =
		statusFilter === "All" ? matchesSearch : matchesSearch.filter((booking) => booking.status === statusFilter);

	const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const currentPage = Math.min(page, totalPages);
	const pageStart = (currentPage - 1) * PAGE_SIZE;
	const pageRows = filtered.slice(pageStart, pageStart + PAGE_SIZE);

	// Summary cards follow the movie/date filters (not search or status tab).
	const confirmedTotal = bookings.filter((booking) => booking.status === "Confirmed").length;
	const cancelledTotal = bookings.filter((booking) => booking.status === "Cancelled").length;

	const selectedBooking = selectedId !== null ? bookings.find((booking) => booking.id === selectedId) : null;

	function closeDetail() {
		setSelectedId(null);
		setConfirmingCancel(false);
		setCancelError("");
	}

	// Escape closes the detail view.
	useEffect(() => {
		if (!selectedBooking) return undefined;
		const handleKeyDown = (event) => {
			if (event.key === "Escape" && !cancelling) {
				setSelectedId(null);
				setConfirmingCancel(false);
				setCancelError("");
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [selectedBooking, cancelling]);

	async function handleCancelBooking() {
		setCancelling(true);
		setCancelError("");
		try {
			const { seatsReleased } = await cancelBooking({ bookingId: selectedBooking.id, branchId });
			setNotice(
				`Booking ${selectedBooking.reference} cancelled. ${seatsReleased} ${seatsReleased === 1 ? "seat is" : "seats are"} available again.`,
			);
			closeDetail();
			setReloadKey((n) => n + 1);
		} catch (error) {
			setCancelError(error.message);
		} finally {
			setCancelling(false);
		}
	}

	const hasServerFilter = movieFilter !== "all" || dateFilter !== "all";

	let content;
	if (!current) {
		content = <StateBox loading title="Loading bookings…" />;
	} else if (current.error) {
		content = (
			<StateBox
				error
				title="Couldn't load bookings"
				text={current.error.message}
				onRetry={() => setReloadKey((n) => n + 1)}
			/>
		);
	} else if (bookings.length === 0) {
		content = (
			<StateBox
				title="No bookings yet"
				text={
					hasServerFilter
						? "No bookings match this movie and date. Try All Movies or All Dates."
						: "Bookings for this branch will show up here once customers check out."
				}
			/>
		);
	} else {
		content = (
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
									<th>Discount</th>
									<th>Amount</th>
									<th>Status</th>
									<th>
										<span className="visually-hidden">Details</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{pageRows.map((booking) => (
									<tr key={`${booking.id}-${booking.showtimeId}`} onClick={() => setSelectedId(booking.id)}>
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
											<p className="booking-primary">{booking.movieTitle}</p>
											<p className="booking-secondary">{formatDatetime(booking.datetime)}</p>
										</td>
										<td data-label="Cinema">
											<p className="booking-primary">{booking.cinema}</p>
											<p className="booking-secondary">{booking.branch}</p>
										</td>
										<td data-label="Seats">{booking.seats.join(", ")}</td>
										<td data-label="Discount">
											<p className="booking-primary">{booking.discountLabel || "—"}</p>
											<p className="booking-secondary">ID: {idStatusText(booking)}</p>
										</td>
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
		);
	}

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
					<Link to="/" className="admin-logout" onClick={clearUser}>
						Log Out
					</Link>
				</header>

				<section className="bookings-intro">
					<div>
						<h2>List of Bookings</h2>
						<p>Review, search, and manage every ticket booking for your branch.</p>
					</div>

					<div className="bookings-filters">
						<div className="filter-field">
							<span>Movie</span>
							<Dropdown
								options={movieOptions}
								value={movieFilter}
								onChange={updateFilter(setMovieFilter)}
								ariaLabel="Filter by movie"
							/>
						</div>
						<div className="filter-field">
							<span>Date</span>
							<Dropdown
								options={dateOptions}
								value={dateFilter}
								onChange={updateFilter(setDateFilter)}
								ariaLabel="Filter by date"
							/>
						</div>
					</div>
				</section>

				{notice && (
					<p className="adm-notice" role="status">
						{notice}
					</p>
				)}

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

				{content}
			</div>

			{selectedBooking && (
				<div
					className="modal-overlay"
					role="dialog"
					aria-modal="true"
					aria-labelledby="booking-detail-title"
					onClick={(event) => {
						// Only a click on the dimmed backdrop itself closes it.
						if (event.target === event.currentTarget && !cancelling) closeDetail();
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
							<div>
								<p className="booking-primary">{selectedBooking.movieTitle}</p>
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
								<dd>
									{selectedBooking.ticketTypes.length === selectedBooking.seats.length
										? selectedBooking.seats
												.map((seat, index) => `${seat} (${selectedBooking.ticketTypes[index]})`)
												.join(", ")
										: selectedBooking.seats.join(", ")}
								</dd>
							</div>
							<div>
								<dt>Discount type</dt>
								<dd>{selectedBooking.discountLabel || "—"}</dd>
							</div>
							<div>
								<dt>ID status</dt>
								<dd>
									<span className="adm-detail-id">{idStatusText(selectedBooking)}</span>
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
								<dd>{formatBookedAt(selectedBooking.bookedAt)}</dd>
							</div>
						</dl>

						{confirmingCancel && (
							<div className="adm-cancel-confirm" role="alert">
								<p>
									Cancel booking {selectedBooking.reference}? Its{" "}
									{selectedBooking.seats.length === 1 ? "seat becomes" : `${selectedBooking.seats.length} seats become`}{" "}
									available again. This can't be undone.
								</p>
								{cancelError && <p>{cancelError}</p>}
							</div>
						)}

						<div className="modal-actions">
							<button type="button" className="modal-btn modal-btn--ghost" onClick={closeDetail} disabled={cancelling}>
								Close
							</button>

							{selectedBooking.status !== "Cancelled" && !confirmingCancel && (
								<button
									type="button"
									className="modal-btn adm-btn-danger"
									onClick={() => setConfirmingCancel(true)}
								>
									Cancel booking
								</button>
							)}

							{confirmingCancel && (
								<>
									<button
										type="button"
										className="modal-btn modal-btn--ghost"
										onClick={() => {
											setConfirmingCancel(false);
											setCancelError("");
										}}
										disabled={cancelling}
									>
										Keep booking
									</button>
									<button
										type="button"
										className="modal-btn adm-btn-danger"
										onClick={handleCancelBooking}
										disabled={cancelling}
									>
										{cancelling ? "Cancelling…" : "Yes, cancel booking"}
									</button>
								</>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

// Only a logged-in admin gets the page; everyone else goes to the admin login.
function ListOfBookingsPage() {
	const admin = getAdminSession();
	if (!admin) return <Navigate to="/admin/login" replace />;
	return <ListOfBookings branchId={admin.branchId} />;
}

export default ListOfBookingsPage;

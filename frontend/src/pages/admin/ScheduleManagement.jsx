// ScheduleManagement.jsx — Admin schedule management
// Route: "/admin/schedule"

// Each admin owns one branch, so this page only shows (and only lets the
// admin pick) cinemas that belong to that branch.

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import "../../styles/ScheduleManagement.css";

import AdminSidebar from "../../components/AdminSidebar";

import navSchedule from "../../assets/images/dashboard/nav-schedule.svg";

// Set this to wherever your backend actually runs.
const API_BASE = "http://localhost:5000/api";

// TEMP: the branch this admin owns. Replace with the logged-in admin's
// branch_id (USER.branch_id) once the login session is available here.
// 1 = Vista Mall Taguig, 2 = Market! Market!, 3 = Venice McKinley.
const ADMIN_BRANCH_ID = 1;

// Placeholder cinema list until a real /api/cinemas (or /api/branches)
// endpoint exists — that's the Week 3 Search & Filter ticket, not this one.
// IDs and branch IDs match database/seed.sql exactly, so Add/Reschedule work
// correctly against a freshly seeded DB.
const CINEMA_OPTIONS = [
	{ value: 1, branchId: 1, label: "Cinema 1" },
	{ value: 2, branchId: 1, label: "Cinema 2" },
	{ value: 3, branchId: 1, label: "Cinema 3" },
	{ value: 4, branchId: 2, label: "Cinema 1" },
	{ value: 5, branchId: 2, label: "Cinema 2" },
	{ value: 6, branchId: 2, label: "Cinema 3" },
	{ value: 7, branchId: 3, label: "Cinema 1" },
	{ value: 8, branchId: 3, label: "Cinema 2" },
	{ value: 9, branchId: 3, label: "Cinema 3" },
];

// Only the cinemas of the admin's own branch.
const BRANCH_CINEMAS = CINEMA_OPTIONS.filter(
	(cinema) => cinema.branchId === ADMIN_BRANCH_ID,
);

// Seat count for newly-added showtimes. Real per-cinema capacity (from the
// SEAT table) isn't wired up yet — that's a separate ticket — so every new
// showtime is created with this placeholder capacity for now.
const DEFAULT_TOTAL_SEATS = 50;

const IconPlus = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2.5"
		strokeLinecap="round"
		aria-hidden="true"
	>
		<path d="M12 5v14M5 12h14" />
	</svg>
);

const IconCalendar = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.8"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<rect x="3" y="4" width="18" height="18" rx="2" />
		<path d="M16 2v4M8 2v4M3 10h18" />
	</svg>
);

const IconEdit = () => (
	<svg
		width="18"
		height="18"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.8"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M12 20h9" />
		<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
	</svg>
);

const IconTrash = () => (
	<svg
		width="18"
		height="18"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.8"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M3 6h18" />
		<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
		<path d="M10 11v6M14 11v6" />
	</svg>
);

const IconChevron = ({ open }) => (
	<svg
		width="14"
		height="14"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2.5"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
		className={
			open
				? "dropdown-chevron dropdown-chevron--open"
				: "dropdown-chevron"
		}
	>
		<path d="M6 9l6 6 6-6" />
	</svg>
);

const IconCheck = () => (
	<svg
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2.5"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M20 6L9 17l-5-5" />
	</svg>
);

const IconWarning = () => (
	<svg
		width="18"
		height="18"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
		<line x1="12" y1="9" x2="12" y2="13" />
		<line x1="12" y1="17" x2="12.01" y2="17" />
	</svg>
);

const IconSearch = () => (
	<svg
		width="18"
		height="18"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.8"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<circle cx="11" cy="11" r="7" />
		<path d="m20 20-3.5-3.5" />
	</svg>
);

function Dropdown({ options, value, onChange, ariaLabel, searchable = false }) {
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState("");
	const containerRef = useRef(null);

	useEffect(() => {
		if (!isOpen) return undefined;

		const handleClickOutside = (event) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(event.target)
			) {
				setIsOpen(false);
			}
		};
		const handleKeyDown = (event) => {
			if (event.key === "Escape") setIsOpen(false);
		};

		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen]);

	const selected =
		options.find((option) => option.value === value) ?? options[0];

	const trimmedQuery = query.trim().toLowerCase();
	const visibleOptions =
		searchable && trimmedQuery
			? options.filter((option) =>
					option.label.toLowerCase().includes(trimmedQuery),
				)
			: options;

	return (
		<div className="dropdown" ref={containerRef}>
			<button
				type="button"
				className="dropdown-trigger"
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				aria-label={ariaLabel}
				onClick={() => {
					setQuery("");
					setIsOpen((open) => !open);
				}}
			>
				<span className="dropdown-trigger-label">
					{selected?.thumbnail && (
						<img
							className="dropdown-thumb"
							src={selected.thumbnail}
							alt=""
						/>
					)}
					{selected?.label ?? "Loading…"}
				</span>
				<IconChevron open={isOpen} />
			</button>

			{isOpen && (
				<ul className="dropdown-menu" role="listbox">
					{searchable && (
						<li
							className="dropdown-search-wrap"
							role="presentation"
						>
							<div className="schedule-search schedule-search--compact">
								<IconSearch />
								<input
									type="text"
									className="schedule-search-input"
									placeholder="Search movies….."
									value={query}
									onChange={(event) =>
										setQuery(event.target.value)
									}
									autoFocus
								/>
							</div>
						</li>
					)}

					{visibleOptions.map((option) => (
						<li
							key={option.value}
							role="option"
							aria-selected={option.value === value}
						>
							<button
								type="button"
								className="dropdown-option"
								onClick={() => {
									onChange(option.value);
									setIsOpen(false);
								}}
							>
								{option.thumbnail && (
									<img
										className="dropdown-thumb"
										src={option.thumbnail}
										alt=""
									/>
								)}
								<span>{option.label}</span>
								{option.value === value && <IconCheck />}
							</button>
						</li>
					))}

					{visibleOptions.length === 0 && (
						<li className="dropdown-empty" role="presentation">
							No movies found
						</li>
					)}
				</ul>
			)}
		</div>
	);
}

// Ended movies can't be scheduled, so they're left out of "Add Showtime".
function isEnded(movie) {
	return String(movie?.status ?? "").toLowerCase() === "ended";
}

function findMovie(movies, movieId) {
	return movies.find((movie) => movie.movie_id === movieId);
}

// Backend gives us show_date ("2026-06-06") and show_time ("10:00:00")
// separately; <input type="datetime-local"> wants one combined string.
function toDatetimeLocal(showDate, showTime) {
	if (!showDate || !showTime) return "";
	return `${showDate}T${showTime.slice(0, 5)}`;
}

// ...and the reverse, for sending a reschedule/create request back.
function splitDatetimeLocal(value) {
	return {
		showDate: value.slice(0, 10),
		showTime: `${value.slice(11, 16)}:00`,
	};
}

function mapShowtime(row) {
	return {
		id: row.showtime_id,
		movieId: row.movie_id,
		cinemaId: row.cinema_id,
		cinemaLabel: `Cinema ${row.cinema_num}`,
		datetime: toDatetimeLocal(row.show_date, row.show_time),
		seatsTotal: row.total_seats,
		seatsBooked: row.booked_seats,
	};
}

// "2026-06-06T10:00" -> "Jun 6, 2026 10:00 AM"
function formatDatetime(value) {
	if (!value) return "";
	const date = new Date(value);
	const datePart = date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
	const timePart = date.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});
	return `${datePart} ${timePart}`;
}

// "2026-06-06" -> "Jun 6, 2026"
function formatDateOnly(value) {
	if (!value) return "";
	const date = new Date(`${value}T00:00`);
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function getStatus(row) {
	return row.seatsBooked >= row.seatsTotal ? "Full" : "Active";
}

function getOccupancyPercent(row) {
	return Math.min(100, Math.round((row.seatsBooked / row.seatsTotal) * 100));
}

// Small fetch helper: parses JSON either way, and throws the backend's own
// message on a non-2xx response, so every caller can just `await` and
// `catch`.
async function apiRequest(path, options = {}) {
	const response = await fetch(`${API_BASE}${path}`, {
		headers: { "Content-Type": "application/json" },
		...options,
	});
	let body = null;
	try {
		body = await response.json();
	} catch {
		// no JSON body — leave body as null
	}
	if (!response.ok) {
		throw new Error(
			body?.message || `Request failed with status ${response.status}`,
		);
	}
	return body;
}

function ScheduleManagement() {
	const [movies, setMovies] = useState([]);
	const [schedule, setSchedule] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [formError, setFormError] = useState("");

	const [searchQuery, setSearchQuery] = useState("");
	const [movieFilter, setMovieFilter] = useState("all");
	const [dateFilter, setDateFilter] = useState("");

	const [isAddOpen, setIsAddOpen] = useState(false);
	const [addForm, setAddForm] = useState({
		movieId: null,
		datetime: "",
		cinemaId: BRANCH_CINEMAS[0].value,
	});

	const [editingId, setEditingId] = useState(null);
	const [editForm, setEditForm] = useState({
		datetime: "",
		cinemaId: BRANCH_CINEMAS[0].value,
	});

	const [deletingId, setDeletingId] = useState(null);

	// Initial load: movies (for the dropdown/labels) + showtimes, in parallel.
	useEffect(() => {
		let cancelled = false;

		async function load() {
			setIsLoading(true);
			setLoadError("");
			try {
				const [moviesData, showtimesData] = await Promise.all([
					apiRequest("/movies"),
					apiRequest("/showtimes"),
				]);
				if (cancelled) return;
				setMovies(moviesData.movies);
				setSchedule(showtimesData.showtimes.map(mapShowtime));
				setAddForm((form) => ({
					...form,
					movieId:
						form.movieId ??
						moviesData.movies.find((movie) => !isEnded(movie))
							?.movie_id ??
						null,
				}));
			} catch (error) {
				if (!cancelled) setLoadError(error.message);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		}

		load();
		return () => {
			cancelled = true;
		};
	}, []);

	async function reloadShowtimes() {
		const data = await apiRequest("/showtimes");
		setSchedule(data.showtimes.map(mapShowtime));
	}

	const movieOptions = useMemo(
		() =>
			movies.map((movie) => ({
				value: movie.movie_id,
				label: movie.title,
				thumbnail: movie.poster,
				ended: isEnded(movie),
			})),
		[movies],
	);
	const addMovieOptions = useMemo(
		() => movieOptions.filter((option) => !option.ended),
		[movieOptions],
	);
	const movieFilterOptions = useMemo(
		() => [{ value: "all", label: "All Movies" }, ...movieOptions],
		[movieOptions],
	);

	const openAddModal = () => {
		setFormError("");
		setAddForm({
			movieId: addMovieOptions[0]?.value ?? null,
			datetime: "",
			cinemaId: BRANCH_CINEMAS[0].value,
		});
		setIsAddOpen(true);
	};

	const handleAddSubmit = async (event) => {
		event.preventDefault();
		if (!addForm.datetime || !addForm.movieId) return;

		setFormError("");
		setIsSubmitting(true);
		try {
			const { showDate, showTime } = splitDatetimeLocal(addForm.datetime);
			await apiRequest("/admin/showtimes", {
				method: "POST",
				body: JSON.stringify({
					movieId: addForm.movieId,
					cinemaId: addForm.cinemaId,
					showDate,
					showTime,
					totalSeats: DEFAULT_TOTAL_SEATS,
					status: "scheduled",
				}),
			});
			await reloadShowtimes();
			setIsAddOpen(false);
		} catch (error) {
			setFormError(error.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const openRescheduleModal = (row) => {
		setFormError("");
		setEditForm({ datetime: row.datetime, cinemaId: row.cinemaId });
		setEditingId(row.id);
	};

	const handleRescheduleSubmit = async (event) => {
		event.preventDefault();
		if (!editForm.datetime) return;

		setFormError("");
		setIsSubmitting(true);
		try {
			const { showDate, showTime } = splitDatetimeLocal(
				editForm.datetime,
			);
			await apiRequest(`/admin/showtimes/${editingId}`, {
				method: "PUT",
				body: JSON.stringify({
					cinemaId: editForm.cinemaId,
					showDate,
					showTime,
				}),
			});
			await reloadShowtimes();
			setEditingId(null);
		} catch (error) {
			setFormError(error.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const editingRow =
		editingId !== null
			? schedule.find((row) => row.id === editingId)
			: null;

	const handleDeleteConfirm = async () => {
		setFormError("");
		setIsSubmitting(true);
		try {
			await apiRequest(`/admin/showtimes/${deletingId}`, {
				method: "DELETE",
			});
			await reloadShowtimes();
			setDeletingId(null);
		} catch (error) {
			setFormError(error.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	const deletingRow =
		deletingId !== null
			? schedule.find((row) => row.id === deletingId)
			: null;

	// Only this admin's branch, then the Search/Movie/Date filters on top.
	const searchTerm = searchQuery.trim().toLowerCase();
	const filteredSchedule = schedule.filter((row) => {
		const inBranch = BRANCH_CINEMAS.some(
			(cinema) => cinema.value === row.cinemaId,
		);
		const matchesMovie =
			movieFilter === "all" || row.movieId === movieFilter;
		const matchesDate = !dateFilter || row.datetime.startsWith(dateFilter);
		const title = findMovie(movies, row.movieId)?.title ?? "";
		const matchesSearch =
			!searchTerm || title.toLowerCase().includes(searchTerm);
		return inBranch && matchesMovie && matchesDate && matchesSearch;
	});

	const filterSummaryParts = [];
	if (searchTerm) filterSummaryParts.push(`"${searchQuery.trim()}"`);
	if (movieFilter !== "all") {
		const filterMovie = findMovie(movies, movieFilter);
		if (filterMovie) filterSummaryParts.push(filterMovie.title);
	}
	if (dateFilter) filterSummaryParts.push(formatDateOnly(dateFilter));
	const filterSummary = filterSummaryParts.length
		? filterSummaryParts.join(", ")
		: "All schedules";

	return (
		<div className="admin-dashboard">
			<AdminSidebar />

			<div className="admin-main">
				<header className="admin-header">
					<h1 className="admin-title">
						<img src={navSchedule} alt="" />
						<span>
							Schedule <em>Management</em>
						</span>
					</h1>
					<Link to="/" className="admin-logout">
						Log Out
					</Link>
				</header>

				{loadError && (
					<p className="schedule-empty" role="alert">
						Couldn't load the schedule: {loadError}
					</p>
				)}

				<section className="schedule-filters" aria-label="Filters">
					<div className="filter-field filter-field--search">
						<span>Search</span>
						<div className="schedule-search">
							<IconSearch />
							<input
								type="text"
								className="schedule-search-input"
								placeholder="Search by movie title....."
								value={searchQuery}
								onChange={(event) =>
									setSearchQuery(event.target.value)
								}
							/>
						</div>
					</div>

					<div className="filter-field">
						<span>Movie</span>
						<Dropdown
							options={movieFilterOptions}
							value={movieFilter}
							onChange={setMovieFilter}
							ariaLabel="Filter by movie"
						/>
					</div>

					<label className="filter-field">
						<span>Date</span>
						<input
							type="date"
							value={dateFilter}
							onChange={(event) =>
								setDateFilter(event.target.value)
							}
						/>
					</label>

					<button
						type="button"
						className="add-showtime-btn"
						onClick={openAddModal}
						disabled={isLoading || addMovieOptions.length === 0}
					>
						<IconPlus />
						Add Showtime
					</button>
				</section>

				<p className="schedule-filter-note">
					Filter: {filterSummary}
					{filterSummaryParts.length > 0 && (
						<button
							type="button"
							className="schedule-filter-clear"
							onClick={() => {
								setSearchQuery("");
								setMovieFilter("all");
								setDateFilter("");
							}}
						>
							Clear
						</button>
					)}
				</p>

				{isLoading ? (
					<p className="schedule-empty">Loading schedule…</p>
				) : filteredSchedule.length === 0 ? (
					<p className="schedule-empty">
						No showtimes match this filter.
					</p>
				) : (
					<div className="schedule-table-wrap">
						<table className="schedule-table">
							<thead>
								<tr>
									<th>Movie</th>
									<th>Showtime</th>
									<th>Cinema</th>
									<th>Seats</th>
									<th>Status</th>
									<th>Edit</th>
								</tr>
							</thead>
							<tbody>
								{filteredSchedule.map((row) => {
									const movie = findMovie(
										movies,
										row.movieId,
									);
									const status = getStatus(row);
									const percent = getOccupancyPercent(row);
									return (
										<tr key={row.id}>
											<td data-label="Movie">
												<div className="schedule-movie">
													{movie?.poster && (
														<img
															className="schedule-poster"
															src={movie.poster}
															alt=""
														/>
													)}
													<div>
														<p className="schedule-movie-title">
															{movie?.title ??
																`Movie #${row.movieId}`}
														</p>
														<p className="schedule-movie-genre">
															{(
																movie?.genres ||
																[]
															).join(", ")}
														</p>
													</div>
												</div>
											</td>
											<td data-label="Showtime">
												<span className="schedule-showtime">
													<IconCalendar />
													{formatDatetime(
														row.datetime,
													)}
												</span>
											</td>
											<td data-label="Cinema">
												{row.cinemaLabel}
											</td>
											<td data-label="Seats">
												<div
													className="seat-bar"
													title={`${row.seatsBooked}/${row.seatsTotal} seats booked`}
												>
													<div
														className="seat-bar-fill"
														style={{
															width: `${percent}%`,
														}}
													/>
												</div>
											</td>
											<td data-label="Status">
												<span
													className={`status-pill status-pill--${status.toLowerCase()}`}
												>
													{status}
												</span>
											</td>
											<td data-label="Edit">
												<div className="schedule-row-actions">
													<button
														type="button"
														className="schedule-edit-btn"
														onClick={() =>
															openRescheduleModal(
																row,
															)
														}
														aria-label={`Reschedule ${movie?.title ?? "showtime"}`}
													>
														<IconEdit />
													</button>
													<button
														type="button"
														className="schedule-edit-btn schedule-edit-btn--danger"
														onClick={() => {
															setFormError("");
															setDeletingId(
																row.id,
															);
														}}
														aria-label={`Delete ${movie?.title ?? "showtime"} showtime`}
													>
														<IconTrash />
													</button>
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}

				{isAddOpen && (
					<div
						className="modal-overlay"
						role="dialog"
						aria-modal="true"
						aria-labelledby="add-showtime-title"
					>
						<form className="modal-card" onSubmit={handleAddSubmit}>
							<h2 id="add-showtime-title">Add showtime</h2>
							<p className="modal-subtitle">
								Fill in details for the new schedule entry.
							</p>

							<div className="modal-field">
								<span>Movie</span>
								<Dropdown
									options={addMovieOptions}
									searchable
									value={addForm.movieId}
									onChange={(movieId) =>
										setAddForm((form) => ({
											...form,
											movieId,
										}))
									}
									ariaLabel="Movie"
								/>
							</div>

							<label className="modal-field">
								<span>Date &amp; Time</span>
								<input
									type="datetime-local"
									required
									value={addForm.datetime}
									onChange={(event) =>
										setAddForm((form) => ({
											...form,
											datetime: event.target.value,
										}))
									}
								/>
							</label>

							<div className="modal-field">
								<span>Cinema</span>
								<Dropdown
									options={BRANCH_CINEMAS}
									value={addForm.cinemaId}
									onChange={(cinemaId) =>
										setAddForm((form) => ({
											...form,
											cinemaId,
										}))
									}
									ariaLabel="Cinema"
								/>
							</div>

							{formError && (
								<p className="modal-notice" role="alert">
									<IconWarning />
									<span>{formError}</span>
								</p>
							)}

							<div className="modal-actions">
								<button
									type="button"
									className="modal-btn modal-btn--ghost"
									onClick={() => setIsAddOpen(false)}
									disabled={isSubmitting}
								>
									Cancel
								</button>
								<button
									type="submit"
									className="modal-btn modal-btn--primary"
									disabled={isSubmitting}
								>
									{isSubmitting ? "Saving…" : "Save showtime"}
								</button>
							</div>
						</form>
					</div>
				)}

				{editingRow && (
					<div
						className="modal-overlay"
						role="dialog"
						aria-modal="true"
						aria-labelledby="reschedule-title"
					>
						<form
							className="modal-card"
							onSubmit={handleRescheduleSubmit}
						>
							<h2 id="reschedule-title">Reschedule showtime</h2>
							<p className="modal-subtitle">
								Update the date, time, or cinema for{" "}
								<strong>
									{findMovie(movies, editingRow.movieId)
										?.title ??
										`Movie #${editingRow.movieId}`}
								</strong>
								.
							</p>

							<label className="modal-field">
								<span>Date &amp; Time</span>
								<input
									type="datetime-local"
									required
									value={editForm.datetime}
									onChange={(event) =>
										setEditForm((form) => ({
											...form,
											datetime: event.target.value,
										}))
									}
								/>
							</label>

							<div className="modal-field">
								<span>Cinema</span>
								<Dropdown
									options={BRANCH_CINEMAS}
									value={editForm.cinemaId}
									onChange={(cinemaId) =>
										setEditForm((form) => ({
											...form,
											cinemaId,
										}))
									}
									ariaLabel="Cinema"
								/>
							</div>

							<p className="modal-notice">
								<IconWarning />
								<span>
									Rescheduling this will automatically update
									all reserved tickets. Ticket holders will be
									notified via email.
								</span>
							</p>

							{formError && (
								<p className="modal-notice" role="alert">
									<IconWarning />
									<span>{formError}</span>
								</p>
							)}

							<div className="modal-actions">
								<button
									type="button"
									className="modal-btn modal-btn--ghost"
									onClick={() => setEditingId(null)}
									disabled={isSubmitting}
								>
									Cancel
								</button>
								<button
									type="submit"
									className="modal-btn modal-btn--primary"
									disabled={isSubmitting}
								>
									{isSubmitting ? "Saving…" : "Save changes"}
								</button>
							</div>
						</form>
					</div>
				)}

				{deletingRow && (
					<div
						className="modal-overlay"
						role="dialog"
						aria-modal="true"
						aria-labelledby="delete-title"
					>
						<div className="modal-card">
							<h2 id="delete-title">Delete showtime?</h2>
							<p className="modal-subtitle">
								You're about to delete{" "}
								<strong>
									{findMovie(movies, deletingRow.movieId)
										?.title ??
										`Movie #${deletingRow.movieId}`}
								</strong>{" "}
								on {formatDatetime(deletingRow.datetime)}.
							</p>

							<p className="modal-warning">
								This action cannot be undone. Any bookings for
								this showtime may also be affected.
							</p>

							{formError && (
								<p className="modal-notice" role="alert">
									<IconWarning />
									<span>{formError}</span>
								</p>
							)}

							<div className="modal-actions">
								<button
									type="button"
									className="modal-btn modal-btn--ghost"
									onClick={() => setDeletingId(null)}
									disabled={isSubmitting}
								>
									Cancel
								</button>
								<button
									type="button"
									className="modal-btn modal-btn--primary"
									onClick={handleDeleteConfirm}
									disabled={isSubmitting}
								>
									{isSubmitting
										? "Deleting…"
										: "Delete showtime"}
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export default ScheduleManagement;

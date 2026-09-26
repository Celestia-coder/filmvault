// ScheduleManagement.jsx — Admin schedule management
// Route: "/admin/schedule"
//
// Data is all client-side state (no backend yet). "Add showtime" appends a
// row; the pencil icon on a row opens "Reschedule", which updates that row's
// date/time/cinema in place; the trash icon opens a confirmation before
// removing the row. The Movie/Date filter controls at the top are hardcoded
// display only — no filtering logic (per spec, optional/skipped).

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import "../../styles/ScheduleManagement.css";

import AdminSidebar from "../../components/AdminSidebar";

import navSchedule from "../../assets/images/dashboard/nav-schedule.svg";

import posterWhiteChicks from "../../assets/images/dashboard/white-chicks.png";
import posterMeanGirls from "../../assets/images/dashboard/mean-girls.png";
import posterDisclosureDay from "../../assets/images/dashboard/disclosure-day.png";
import posterToyStory from "../../assets/images/dashboard/toy-story-5.png";
import posterDevilWearsPrada from "../../assets/images/dashboard/devil-wears-prada-2.png";

// Placeholder catalog until real movie data is available. Reuses the same
// posters as the admin dashboard so both pages agree on what's showing.
const MOVIES = [
	{
		id: "white-chicks",
		title: "White Chicks",
		genre: "Comedy",
		poster: posterWhiteChicks,
	},
	{
		id: "mean-girls",
		title: "Mean Girls",
		genre: "Comedy/Drama",
		poster: posterMeanGirls,
	},
	{
		id: "disclosure-day",
		title: "Disclosure Day",
		genre: "Sci-Fi/Thriller",
		poster: posterDisclosureDay,
	},
	{
		id: "toy-story-5",
		title: "Toy Story 5",
		genre: "Animation/Family",
		poster: posterToyStory,
	},
	{
		id: "devil-wears-prada-2",
		title: "The Devil Wears Prada 2",
		genre: "Comedy/Drama",
		poster: posterDevilWearsPrada,
	},
];

const CINEMAS = ["Cinema 1", "Cinema 2", "Cinema 3"];
const CINEMA_OPTIONS = CINEMAS.map((cinema) => ({
	value: cinema,
	label: cinema,
}));
const MOVIE_OPTIONS = MOVIES.map((movie) => ({
	value: movie.id,
	label: movie.title,
	thumbnail: movie.poster,
}));
const MOVIE_FILTER_OPTIONS = [
	{ value: "all", label: "All Movies" },
	...MOVIE_OPTIONS,
];

// Placeholder schedule until the backend exists. `datetime` is kept in the
// same "YYYY-MM-DDTHH:mm" shape a <input type="datetime-local"> produces, so
// rows load straight into the reschedule form with no conversion.
const INITIAL_SCHEDULE = [
	{
		id: 1,
		movieId: "devil-wears-prada-2",
		datetime: "2026-06-06T10:00",
		cinema: "Cinema 1",
		seatsTotal: 50,
		seatsBooked: 18,
	},
	{
		id: 2,
		movieId: "mean-girls",
		datetime: "2026-06-06T10:30",
		cinema: "Cinema 1",
		seatsTotal: 50,
		seatsBooked: 30,
	},
	{
		id: 3,
		movieId: "mean-girls",
		datetime: "2026-06-06T19:30",
		cinema: "Cinema 3",
		seatsTotal: 50,
		seatsBooked: 50,
	},
	{
		id: 4,
		movieId: "toy-story-5",
		datetime: "2026-06-07T18:30",
		cinema: "Cinema 1",
		seatsTotal: 50,
		seatsBooked: 22,
	},
];

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

// Custom dropdown used in place of a native <select> so the menu always
// opens directly below the field (a native <select>'s popup position and
// style are drawn by the OS, not by our CSS — on macOS it centers on the
// current value instead) and, for movies, can show a poster per option.
function Dropdown({ options, value, onChange, ariaLabel }) {
	const [isOpen, setIsOpen] = useState(false);
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

	return (
		<div className="dropdown" ref={containerRef}>
			<button
				type="button"
				className="dropdown-trigger"
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				aria-label={ariaLabel}
				onClick={() => setIsOpen((open) => !open)}
			>
				<span className="dropdown-trigger-label">
					{selected.thumbnail && (
						<img
							className="dropdown-thumb"
							src={selected.thumbnail}
							alt=""
						/>
					)}
					{selected.label}
				</span>
				<IconChevron open={isOpen} />
			</button>

			{isOpen && (
				<ul className="dropdown-menu" role="listbox">
					{options.map((option) => (
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
				</ul>
			)}
		</div>
	);
}

function findMovie(movieId) {
	return MOVIES.find((movie) => movie.id === movieId);
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

function ScheduleManagement() {
	const [schedule, setSchedule] = useState(INITIAL_SCHEDULE);
	const [movieFilter, setMovieFilter] = useState("all");
	const [dateFilter, setDateFilter] = useState("");

	const [isAddOpen, setIsAddOpen] = useState(false);
	const [addForm, setAddForm] = useState({
		movieId: MOVIES[0].id,
		datetime: "",
		cinema: CINEMAS[0],
	});

	const [editingId, setEditingId] = useState(null);
	const [editForm, setEditForm] = useState({
		datetime: "",
		cinema: CINEMAS[0],
	});

	const [deletingId, setDeletingId] = useState(null);

	const openAddModal = () => {
		setAddForm({ movieId: MOVIES[0].id, datetime: "", cinema: CINEMAS[0] });
		setIsAddOpen(true);
	};

	const handleAddSubmit = (event) => {
		event.preventDefault();
		if (!addForm.datetime) return;
		setSchedule((prev) => [
			...prev,
			{
				id: Date.now(),
				movieId: addForm.movieId,
				datetime: addForm.datetime,
				cinema: addForm.cinema,
				seatsTotal: 50,
				seatsBooked: 0,
			},
		]);
		setIsAddOpen(false);
	};

	const openRescheduleModal = (row) => {
		setEditForm({ datetime: row.datetime, cinema: row.cinema });
		setEditingId(row.id);
	};

	const handleRescheduleSubmit = (event) => {
		event.preventDefault();
		if (!editForm.datetime) return;
		setSchedule((prev) =>
			prev.map((row) =>
				row.id === editingId
					? {
							...row,
							datetime: editForm.datetime,
							cinema: editForm.cinema,
						}
					: row,
			),
		);
		setEditingId(null);
	};

	const editingRow =
		editingId !== null
			? schedule.find((row) => row.id === editingId)
			: null;

	const handleDeleteConfirm = () => {
		setSchedule((prev) => prev.filter((row) => row.id !== deletingId));
		setDeletingId(null);
	};

	const deletingRow =
		deletingId !== null
			? schedule.find((row) => row.id === deletingId)
			: null;

	const filteredSchedule = schedule.filter((row) => {
		const matchesMovie =
			movieFilter === "all" || row.movieId === movieFilter;
		const matchesDate = !dateFilter || row.datetime.startsWith(dateFilter);
		return matchesMovie && matchesDate;
	});

	const filterSummaryParts = [];
	if (movieFilter !== "all")
		filterSummaryParts.push(findMovie(movieFilter).title);
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

				<section className="schedule-filters" aria-label="Filters">
					<div className="filter-field">
						<span>Movie</span>
						<Dropdown
							options={MOVIE_FILTER_OPTIONS}
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
								setMovieFilter("all");
								setDateFilter("");
							}}
						>
							Clear
						</button>
					)}
				</p>

				{filteredSchedule.length === 0 ? (
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
									const movie = findMovie(row.movieId);
									const status = getStatus(row);
									const percent = getOccupancyPercent(row);
									return (
										<tr key={row.id}>
											<td data-label="Movie">
												<div className="schedule-movie">
													<img
														className="schedule-poster"
														src={movie.poster}
														alt=""
													/>
													<div>
														<p className="schedule-movie-title">
															{movie.title}
														</p>
														<p className="schedule-movie-genre">
															{movie.genre}
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
												{row.cinema}
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
														aria-label={`Reschedule ${movie.title}`}
													>
														<IconEdit />
													</button>
													<button
														type="button"
														className="schedule-edit-btn schedule-edit-btn--danger"
														onClick={() =>
															setDeletingId(
																row.id,
															)
														}
														aria-label={`Delete ${movie.title} showtime`}
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
			</div>

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
								options={MOVIE_OPTIONS}
								value={addForm.movieId}
								onChange={(movieId) =>
									setAddForm((form) => ({ ...form, movieId }))
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
								options={CINEMA_OPTIONS}
								value={addForm.cinema}
								onChange={(cinema) =>
									setAddForm((form) => ({ ...form, cinema }))
								}
								ariaLabel="Cinema"
							/>
						</div>

						<div className="modal-actions">
							<button
								type="button"
								className="modal-btn modal-btn--ghost"
								onClick={() => setIsAddOpen(false)}
							>
								Cancel
							</button>
							<button
								type="submit"
								className="modal-btn modal-btn--primary"
							>
								Save showtime
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
								{findMovie(editingRow.movieId).title}
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
								options={CINEMA_OPTIONS}
								value={editForm.cinema}
								onChange={(cinema) =>
									setEditForm((form) => ({ ...form, cinema }))
								}
								ariaLabel="Cinema"
							/>
						</div>

						<p className="modal-notice">
							<IconWarning />
							<span>
								Rescheduling this will automatically update all
								reserved tickets. Ticket holders will be
								notified via email.
							</span>
						</p>

						<div className="modal-actions">
							<button
								type="button"
								className="modal-btn modal-btn--ghost"
								onClick={() => setEditingId(null)}
							>
								Cancel
							</button>
							<button
								type="submit"
								className="modal-btn modal-btn--primary"
							>
								Save changes
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
								{findMovie(deletingRow.movieId).title}
							</strong>{" "}
							on {formatDatetime(deletingRow.datetime)}.
						</p>

						<p className="modal-warning">
							This action cannot be undone. Any bookings for this
							showtime may also be affected.
						</p>

						<div className="modal-actions">
							<button
								type="button"
								className="modal-btn modal-btn--ghost"
								onClick={() => setDeletingId(null)}
							>
								Cancel
							</button>
							<button
								type="button"
								className="modal-btn modal-btn--primary"
								onClick={handleDeleteConfirm}
							>
								Delete showtime
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default ScheduleManagement;

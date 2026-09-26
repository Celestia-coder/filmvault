// MovieManagement.jsx — Admin movie management
// Route: "/admin/movies"


import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import "../../styles/MovieManagement.css";

import AdminSidebar from "../../components/AdminSidebar";

import navMovie from "../../assets/images/dashboard/nav-movie.svg";

import posterWhiteChicks from "../../assets/images/dashboard/white-chicks.png";
import posterMeanGirls from "../../assets/images/dashboard/mean-girls.png";
import posterDisclosureDay from "../../assets/images/dashboard/disclosure-day.png";
import posterToyStory from "../../assets/images/dashboard/toy-story-5.png";
import posterDevilWearsPrada from "../../assets/images/dashboard/devil-wears-prada-2.png";

// Fixed lists — genres are shown as toggle chips and language as a
// dropdown since both are constrained sets in the real database, not
// freeform text.
const GENRE_OPTIONS = [
	"Action",
	"Comedy",
	"Drama",
	"Romance",
	"Horror",
	"Sci-Fi",
	"Thriller",
	"Animation",
	"Family",
];
const LANGUAGE_OPTIONS = ["English", "Filipino", "Korean", "Japanese"];

// Placeholder catalog until the backend exists. Statuses: "now-showing",
// "upcoming", "ended".
const INITIAL_MOVIES = [
	{
		id: 1,
		title: "The Devil Wears Prada 2",
		synopsis:
			"Twenty years later, Andy Sachs returns to Runway as Miranda Priestly fights to keep her empire alive — this time against her former assistant Emily Charlton, now a powerful rival with the money to save or sink the magazine.",
		director: "David Frankel",
		releaseDate: "2026-05-01",
		rating: "PG",
		durationMinutes: 110,
		language: "English",
		genres: ["Comedy", "Drama"],
		price: 350,
		status: "now-showing",
		trailerUrl: "https://youtube.com/watch?v=...",
		poster: posterDevilWearsPrada,
	},
	{
		id: 2,
		title: "The Loved One",
		synopsis: "",
		director: "Irene Emma Villamor",
		releaseDate: "",
		rating: "R-13",
		durationMinutes: 98,
		language: "Filipino",
		genres: ["Romance", "Drama"],
		price: 300,
		status: "now-showing",
		trailerUrl: "",
		poster: posterMeanGirls,
	},
	{
		id: 3,
		title: "Un/Happy For You",
		synopsis: "",
		director: "Petersen Vargas",
		releaseDate: "",
		rating: "R-13",
		durationMinutes: 105,
		language: "Filipino",
		genres: ["Romance", "Drama"],
		price: 300,
		status: "now-showing",
		trailerUrl: "",
		poster: posterDisclosureDay,
	},
	{
		id: 4,
		title: "Disclosure Day",
		synopsis: "",
		director: "David Frankel",
		releaseDate: "",
		rating: "PG",
		durationMinutes: 110,
		language: "English",
		genres: ["Comedy", "Drama"],
		price: 350,
		status: "now-showing",
		trailerUrl: "",
		poster: posterDisclosureDay,
	},
	{
		id: 5,
		title: "Toy Story 5",
		synopsis: "",
		director: "David Frankel",
		releaseDate: "",
		rating: "PG",
		durationMinutes: 110,
		language: "English",
		genres: ["Comedy", "Drama"],
		price: 390,
		status: "upcoming",
		trailerUrl: "",
		poster: posterToyStory,
	},
	{
		id: 6,
		title: "Mean Girls",
		synopsis: "",
		director: "David Frankel",
		releaseDate: "",
		rating: "PG",
		durationMinutes: 110,
		language: "English",
		genres: ["Comedy", "Drama"],
		price: 350,
		status: "ended",
		trailerUrl: "",
		poster: posterMeanGirls,
	},
];

const STATUS_LABELS = {
	"now-showing": "Now Showing",
	upcoming: "Upcoming",
	ended: "Ended",
};

const STATUS_OPTIONS = [
	{ value: "all", label: "All Statuses" },
	{ value: "now-showing", label: "Now Showing" },
	{ value: "upcoming", label: "Upcoming" },
	{ value: "ended", label: "Ended" },
];

const RATING_OPTIONS = ["G", "PG", "PG-13", "R-13", "R-18"];

const MAX_POSTER_BYTES = 4 * 1024 * 1024;

const EMPTY_FORM = {
	posterPreview: null,
	posterFile: null,
	title: "",
	synopsis: "",
	director: "",
	releaseDate: "",
	genres: [],
	language: LANGUAGE_OPTIONS[0],
	rating: "PG",
	durationMinutes: "",
	status: "now-showing",
	price: "",
	trailerUrl: "",
};

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
		<path d="m21 21-4.3-4.3" />
	</svg>
);

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

const IconClock = () => (
	<svg
		width="14"
		height="14"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.8"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<circle cx="12" cy="12" r="9" />
		<path d="M12 7v5l3 3" />
	</svg>
);

const IconLanguage = () => (
	<svg
		width="14"
		height="14"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.8"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<circle cx="12" cy="12" r="9" />
		<path d="M3 12h18M12 3c2.5 2.6 3.8 5.8 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.8-3.8-9s1.3-6.4 3.8-9Z" />
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

const IconImagePlaceholder = () => (
	<svg
		width="28"
		height="28"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.6"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<rect x="3" y="3" width="18" height="18" rx="2" />
		<circle cx="9" cy="9" r="2" />
		<path d="m21 15-5-5L5 21" />
	</svg>
);

const IconUpload = () => (
	<svg
		width="14"
		height="14"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M12 3v12" />
		<path d="m7 8 5-5 5 5" />
		<path d="M5 21h14" />
	</svg>
);

const IconAlertTriangle = () => (
	<svg
		width="40"
		height="40"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="1.8"
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
	>
		<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
		<line x1="12" y1="9" x2="12" y2="13" />
		<line x1="12" y1="17" x2="12.01" y2="17" />
	</svg>
);

// Same lightweight custom dropdown pattern used on Schedule Management —
// kept local to this file rather than shared, since each admin page owns
// its own markup/styles for now (see team note on ScheduleManagement.jsx).
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
				<span className="dropdown-trigger-label">{selected.label}</span>
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

function toggleGenre(list, genre) {
	return list.includes(genre)
		? list.filter((g) => g !== genre)
		: [...list, genre];
}

function MovieManagement() {
	const [movies, setMovies] = useState(INITIAL_MOVIES);
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [genreFilter, setGenreFilter] = useState("all");

	// "list" shows the toolbar + grid. "form" shows the Add/Edit Movie view
	// in place of them, reusing the same header and sidebar.
	const [view, setView] = useState("list");
	const [formMode, setFormMode] = useState("add"); // "add" | "edit"
	const [editingId, setEditingId] = useState(null);
	const [form, setForm] = useState(EMPTY_FORM);

	const [posterError, setPosterError] = useState(""); // wrong file type / too large
	const [posterRequiredError, setPosterRequiredError] = useState(""); // no poster at all
	const [genreError, setGenreError] = useState("");
	const posterInputRef = useRef(null);

	const [deletingId, setDeletingId] = useState(null);

	const genreOptions = useMemo(() => {
		const unique = new Set();
		movies.forEach((movie) =>
			movie.genres.forEach((genre) => unique.add(genre)),
		);
		return [
			{ value: "all", label: "All Genres" },
			...Array.from(unique).map((genre) => ({
				value: genre,
				label: genre,
			})),
		];
	}, [movies]);

	const filteredMovies = movies.filter((movie) => {
		const query = search.trim().toLowerCase();
		const matchesSearch =
			!query ||
			movie.title.toLowerCase().includes(query) ||
			movie.director.toLowerCase().includes(query);
		const matchesStatus =
			statusFilter === "all" || movie.status === statusFilter;
		const matchesGenre =
			genreFilter === "all" || movie.genres.includes(genreFilter);
		return matchesSearch && matchesStatus && matchesGenre;
	});

	const openAddForm = () => {
		setForm(EMPTY_FORM);
		setPosterError("");
		setPosterRequiredError("");
		setGenreError("");
		setFormMode("add");
		setEditingId(null);
		setView("form");
	};

	const openEditForm = (movie) => {
		setForm({
			posterPreview: movie.poster,
			posterFile: null,
			title: movie.title,
			synopsis: movie.synopsis,
			director: movie.director,
			releaseDate: movie.releaseDate,
			genres: movie.genres,
			language: movie.language,
			rating: movie.rating,
			durationMinutes: String(movie.durationMinutes),
			status: movie.status,
			price: String(movie.price),
			trailerUrl: movie.trailerUrl,
		});
		setPosterError("");
		setPosterRequiredError("");
		setGenreError("");
		setFormMode("edit");
		setEditingId(movie.id);
		setView("form");
	};

	const closeForm = () => {
		setView("list");
		setEditingId(null);
	};

	const handlePosterChange = (event) => {
		const file = event.target.files?.[0];
		event.target.value = ""; // allow re-selecting the same file later
		if (!file) return;

		if (!["image/jpeg", "image/png"].includes(file.type)) {
			setPosterError("Poster must be a JPG or PNG file.");
			return;
		}
		if (file.size > MAX_POSTER_BYTES) {
			setPosterError("Poster must be 4MB or smaller.");
			return;
		}

		setPosterError("");
		setPosterRequiredError("");
		setForm((prev) => ({
			...prev,
			posterFile: file,
			posterPreview: URL.createObjectURL(file),
		}));
	};

	const handlePosterRemove = () => {
		setForm((prev) => ({ ...prev, posterFile: null, posterPreview: null }));
		setPosterError("");
	};

	const handleFormSubmit = (event) => {
		event.preventDefault();

		if (!form.posterPreview) {
			setPosterRequiredError("Poster image is required.");
			return;
		}
		setPosterRequiredError("");

		if (form.genres.length === 0) {
			setGenreError("Select at least one genre.");
			return;
		}
		setGenreError("");

		if (
			!form.title ||
			!form.director ||
			!form.durationMinutes ||
			!form.price
		)
			return;

		const shared = {
			title: form.title,
			synopsis: form.synopsis,
			director: form.director,
			releaseDate: form.releaseDate,
			genres: form.genres,
			language: form.language,
			rating: form.rating,
			durationMinutes: Number(form.durationMinutes),
			status: form.status,
			price: Number(form.price),
			trailerUrl: form.trailerUrl,
			poster: form.posterPreview,
		};

		if (formMode === "add") {
			setMovies((prev) => [...prev, { id: Date.now(), ...shared }]);
		} else {
			setMovies((prev) =>
				prev.map((movie) =>
					movie.id === editingId ? { ...movie, ...shared } : movie,
				),
			);
		}

		closeForm();
	};

	const handleDeleteConfirm = () => {
		setMovies((prev) => prev.filter((movie) => movie.id !== deletingId));
		setDeletingId(null);
	};

	const deletingMovie =
		deletingId !== null
			? movies.find((movie) => movie.id === deletingId)
			: null;

	return (
		<div className="admin-dashboard">
			<AdminSidebar />

			<div className="admin-main">
				<header className="admin-header">
					<h1 className="admin-title">
						<img src={navMovie} alt="" />
						<span>
							Movie <em>Management</em>
						</span>
					</h1>
					<Link to="/" className="admin-logout">
						Log Out
					</Link>
				</header>

				{view === "list" ? (
					<>
						<section className="movie-toolbar" aria-label="Filters">
							<div className="movie-search">
								<IconSearch />
								<input
									type="text"
									placeholder="Search by title or director....."
									value={search}
									onChange={(event) =>
										setSearch(event.target.value)
									}
								/>
							</div>

							<Dropdown
								options={STATUS_OPTIONS}
								value={statusFilter}
								onChange={setStatusFilter}
								ariaLabel="Filter by status"
							/>
							<Dropdown
								options={genreOptions}
								value={genreFilter}
								onChange={setGenreFilter}
								ariaLabel="Filter by genre"
							/>

							<button
								type="button"
								className="add-movie-btn"
								onClick={openAddForm}
							>
								<IconPlus />
								Add New Movie
							</button>
						</section>

						<p className="movie-count">
							{filteredMovies.length} of {movies.length}
						</p>

						{filteredMovies.length === 0 ? (
							<p className="movie-empty">
								No movies match this filter.
							</p>
						) : (
							<div className="admin-movie-grid">
								{filteredMovies.map((movie) => (
									<article
										className="admin-movie-card"
										key={movie.id}
									>
										<span
											className={`status-badge status-badge--${movie.status}`}
										>
											{STATUS_LABELS[movie.status]}
										</span>

										<div className="admin-movie-card-body">
											<img
												className="admin-movie-poster"
												src={movie.poster}
												alt={`${movie.title} poster`}
											/>

											<div className="admin-movie-info">
												<p className="admin-movie-title">
													{movie.title}{" "}
													<span className="admin-rating-badge">
														{movie.rating}
													</span>
												</p>
												<p className="movie-director">
													Dir. {movie.director}
												</p>

												<div className="movie-meta">
													<span>
														<IconClock />
														{movie.durationMinutes}m
													</span>
													<span>
														<IconLanguage />
														{movie.language}
													</span>
												</div>

												<div className="movie-genres">
													{movie.genres.map(
														(genre) => (
															<span
																className="genre-tag"
																key={genre}
															>
																{genre}
															</span>
														),
													)}
												</div>
											</div>
										</div>

										<div className="admin-movie-card-footer">
											<p className="movie-price">
												₱ {movie.price}
											</p>
											<div className="movie-row-actions">
												<button
													type="button"
													className="movie-edit-btn"
													onClick={() =>
														openEditForm(movie)
													}
													aria-label={`Edit ${movie.title}`}
												>
													<IconEdit />
												</button>
												<button
													type="button"
													className="movie-edit-btn movie-edit-btn--danger"
													onClick={() =>
														setDeletingId(movie.id)
													}
													aria-label={`Delete ${movie.title}`}
												>
													<IconTrash />
												</button>
											</div>
										</div>
									</article>
								))}
							</div>
						)}
					</>
				) : (
					<form className="movie-form" onSubmit={handleFormSubmit}>
						<div className="movie-form-header">
							<div>
								<h2>
									{formMode === "add"
										? "Add Movie"
										: "Edit Movie"}
								</h2>
								<p className="movie-form-subtitle">
									{formMode === "add"
										? "Fill in film details to add it to the catalog"
										: "Update the details of this film"}
								</p>
							</div>
							<div className="movie-form-actions">
								<button
									type="button"
									className="form-btn form-btn--ghost"
									onClick={closeForm}
								>
									Cancel
								</button>
								<button
									type="submit"
									className="form-btn form-btn--primary"
								>
									{formMode === "add"
										? "Add Movie"
										: "Save Changes"}
								</button>
							</div>
						</div>

						<div className="poster-upload">
							<div className="poster-box">
								{form.posterPreview ? (
									<img src={form.posterPreview} alt="" />
								) : (
									<div className="poster-placeholder">
										<IconImagePlaceholder />
										<span>No poster</span>
									</div>
								)}
							</div>

							<div className="poster-controls">
								<div className="label-container">
									<p className="poster-label">Poster Image</p>
									<span className="red-asterisk">*</span>
								</div>
								<div className="poster-buttons">
									<button
										type="button"
										className="poster-replace-btn"
										onClick={() =>
											posterInputRef.current?.click()
										}
									>
										<IconUpload />
										Replace
									</button>
									<button
										type="button"
										className="poster-remove-btn"
										onClick={handlePosterRemove}
									>
										Remove
									</button>
								</div>
								<input
									ref={posterInputRef}
									type="file"
									accept="image/png, image/jpeg"
									className="poster-file-input"
									onChange={handlePosterChange}
								/>
								<p className="poster-hint">
									JPG or PNG, max 4MB.
								</p>
								{posterError && (
									<p className="poster-error">
										{posterError}
									</p>
								)}
								{posterRequiredError && (
									<p className="poster-error">
										{posterRequiredError}
									</p>
								)}
							</div>
						</div>

						<div className="form-grid">
							<div className="form-col">
								<label className="form-field">
									<div className="label-container">
										<p>Title</p>
										<span className="red-asterisk">*</span>
									</div>
									<input
										type="text"
										required
										value={form.title}
										onChange={(event) =>
											setForm((prev) => ({
												...prev,
												title: event.target.value,
											}))
										}
									/>
								</label>

								<label className="form-field">
									<div className="label-container">
										<p>Synopsis</p>
										<span className="red-asterisk">*</span>
									</div>
									<textarea
										required
										rows={4}
										value={form.synopsis}
										onChange={(event) =>
											setForm((prev) => ({
												...prev,
												synopsis: event.target.value,
											}))
										}
									/>
								</label>

								<div className="form-field-row">
									<label className="form-field">
										<div className="label-container">
											<p>Director</p>
											<span className="red-asterisk">
												*
											</span>
										</div>
										<input
											type="text"
											required
											value={form.director}
											onChange={(event) =>
												setForm((prev) => ({
													...prev,
													director:
														event.target.value,
												}))
											}
										/>
									</label>

									<label className="form-field">
										<div className="label-container">
											<p>Release Date</p>
											<span className="red-asterisk">
												*
											</span>
										</div>
										<input
											required
											type="date"
											value={form.releaseDate}
											onChange={(event) =>
												setForm((prev) => ({
													...prev,
													releaseDate:
														event.target.value,
												}))
											}
										/>
									</label>
								</div>

								<div className="form-field-row">
									<div className="form-field">
										<div className="label-container">
											<p>Genres</p>
											<span className="red-asterisk">
												*
											</span>
										</div>
										<div className="genre-picker">
											{GENRE_OPTIONS.map((genre) => {
												const isSelected =
													form.genres.includes(genre);
												return (
													<button
														key={genre}
														type="button"
														className={`genre-chip${isSelected ? " genre-chip--selected" : ""}`}
														onClick={() => {
															setForm((prev) => ({
																...prev,
																genres: toggleGenre(
																	prev.genres,
																	genre,
																),
															}));
															setGenreError("");
														}}
													>
														{genre}
													</button>
												);
											})}
										</div>
										{genreError && (
											<p className="genre-error">
												{genreError}
											</p>
										)}
									</div>

									<div className="form-field">
										<span>Language</span>
										<Dropdown
											options={LANGUAGE_OPTIONS.map(
												(lang) => ({
													value: lang,
													label: lang,
												}),
											)}
											value={form.language}
											onChange={(language) =>
												setForm((prev) => ({
													...prev,
													language,
												}))
											}
											ariaLabel="Language"
										/>
									</div>
								</div>
							</div>

							<div className="form-col">
								<div className="form-field-row">
									<div className="form-field">
										<span>MTRCB Rating</span>
										<Dropdown
											options={RATING_OPTIONS.map(
												(rating) => ({
													value: rating,
													label: rating,
												}),
											)}
											value={form.rating}
											onChange={(rating) =>
												setForm((prev) => ({
													...prev,
													rating,
												}))
											}
											ariaLabel="MTRCB Rating"
										/>
									</div>

									<label className="form-field">
										<div className="label-container">
											<p>Duration (min.)</p>
											<span className="red-asterisk">
												*
											</span>
										</div>
										<input
											type="number"
											min="1"
											required
											value={form.durationMinutes}
											onChange={(event) =>
												setForm((prev) => ({
													...prev,
													durationMinutes:
														event.target.value,
												}))
											}
										/>
									</label>
								</div>

								<div className="form-field-row">
									<div className="form-field">
										<span>Status</span>
										<Dropdown
											options={STATUS_OPTIONS.filter(
												(option) =>
													option.value !== "all",
											)}
											value={form.status}
											onChange={(status) =>
												setForm((prev) => ({
													...prev,
													status,
												}))
											}
											ariaLabel="Status"
										/>
									</div>

									<label className="form-field">
										<div className="label-container">
											<p>Base Price (₱)</p>
											<span className="red-asterisk">
												*
											</span>
										</div>
										<input
											type="number"
											min="0"
											required
											value={form.price}
											onChange={(event) =>
												setForm((prev) => ({
													...prev,
													price: event.target.value,
												}))
											}
										/>
									</label>
								</div>

								<label className="form-field">
									<span>Trailer URL</span>
									<input
										type="url"
										placeholder="https://youtube.com/watch?v=..."
										value={form.trailerUrl}
										onChange={(event) =>
											setForm((prev) => ({
												...prev,
												trailerUrl: event.target.value,
											}))
										}
									/>
								</label>
							</div>
						</div>
					</form>
				)}
			</div>

			{deletingMovie && (
				<div
					className="delete-modal-overlay"
					role="dialog"
					aria-modal="true"
					aria-labelledby="delete-movie-title"
				>
					<div className="delete-modal-card">
						<div className="delete-modal-icon">
							<IconAlertTriangle />
						</div>
						<p
							id="delete-movie-title"
							className="delete-modal-question"
						>
							Are you sure you want to delete this movie?
						</p>
						<div className="delete-modal-actions">
							<button
								type="button"
								className="delete-modal-btn delete-modal-btn--yes"
								onClick={handleDeleteConfirm}
							>
								Yes
							</button>
							<button
								type="button"
								className="delete-modal-btn delete-modal-btn--no"
								onClick={() => setDeletingId(null)}
							>
								No
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default MovieManagement;

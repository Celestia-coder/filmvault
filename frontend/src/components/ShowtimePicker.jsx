// ShowtimePicker.jsx — compact showtime chooser for Seat Selection Management.
//
// The bar shows the chosen showtime. ‹ › step to the previous / next showtime
// (the open popover follows along). Click the bar to browse: pick a day from
// the week strip, then a time. Typing in the search lists matches on ALL dates.
//
// Put this file in src/components/ and its styles in styles/SeatShowtimePicker.css.

import { useEffect, useMemo, useRef, useState } from "react";
import { formatTime } from "../api/movies.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

const STATE_LABEL = {
	upcoming: "Upcoming",
	started: "Started",
	completed: "Completed",
	cancelled: "Cancelled",
};

/* ---------- Date helpers (dates are plain "YYYY-MM-DD" strings) ---------- */

function toKey(date) {
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

function fromKey(key) {
	const [year, month, day] = key.split("-").map(Number);
	return new Date(year, month - 1, day);
}

function addDays(key, amount) {
	const date = fromKey(key);
	date.setDate(date.getDate() + amount);
	return toKey(date);
}

// Sunday that starts the week containing this date.
function weekStartOf(key) {
	return addDays(key, -fromKey(key).getDay());
}

function shortDate(key) {
	const date = fromKey(key);
	return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

// "Today" / "Fri, Dec 25" — used in the bar and in search results.
function longDate(key, today) {
	if (key === today) return "Today";
	return `${WEEKDAYS[fromKey(key).getDay()]}, ${shortDate(key)}`;
}

// "Fri, Dec 25 (today)" — used in the list heading.
function dayTitle(key, today) {
	const base = `${WEEKDAYS[fromKey(key).getDay()]}, ${shortDate(key)}`;
	return key === today ? `${base} (today)` : base;
}

function startsAt(showtime) {
	return new Date(`${showtime.date}T${showtime.time}`);
}

function stateOf(showtime, now) {
	if (showtime.status === "cancelled") return "cancelled";
	if (showtime.status === "completed") return "completed";
	return startsAt(showtime) < now ? "started" : "upcoming";
}

function isPast(showtime, now) {
	return startsAt(showtime) < now;
}

// [{ id, title, dates: [{ date, list }] }] — one entry per movie, in order of first show.
function groupByMovie(list) {
	const movies = new Map();
	list.forEach((showtime) => {
		if (!movies.has(showtime.movieId)) {
			movies.set(showtime.movieId, {
				title: showtime.movieTitle,
				byDate: new Map(),
			});
		}
		const { byDate } = movies.get(showtime.movieId);
		if (!byDate.has(showtime.date)) byDate.set(showtime.date, []);
		byDate.get(showtime.date).push(showtime);
	});
	return [...movies.entries()].map(([id, movie]) => ({
		id,
		title: movie.title,
		dates: [...movie.byDate.entries()].map(([date, items]) => ({
			date,
			list: items,
		})),
	}));
}

/* ---------- Small icons ---------- */

const GLYPHS = {
	down: "m6 9 6 6 6-6",
	left: "m15 6-6 6 6 6",
	right: "m9 6 6 6-6 6",
	check: "m5 12.5 4.5 4.5L19 7.5",
	close: "M6 6l12 12M18 6 6 18",
};

function Glyph({ name, size = 16 }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d={GLYPHS[name]} />
		</svg>
	);
}

/* ---------- Component ---------- */

function ShowtimePicker({ showtimes, current, now, cinemaName, onSelect }) {
	const rootRef = useRef(null);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [showPast, setShowPast] = useState(false);
	const [browseDate, setBrowseDate] = useState(null);
	const [weekStart, setWeekStart] = useState(null);

	const today = toKey(now);
	const nowMinute = Math.floor(now.getTime() / 60000);

	/* ---------- Which showtimes are listed ---------- */

	// Past showtimes are hidden unless asked for, so old data doesn't pile up.
	const visible = useMemo(
		() => (showPast ? showtimes : showtimes.filter((s) => !isPast(s, now))),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[showtimes, showPast, nowMinute],
	);
	const pastCount = showtimes.filter((s) => isPast(s, now)).length;

	// How many showtimes each date has (drives the numbers on the week strip).
	const countByDate = useMemo(() => {
		const counts = new Map();
		visible.forEach((s) =>
			counts.set(s.date, (counts.get(s.date) ?? 0) + 1),
		);
		return counts;
	}, [visible]);

	const needle = query.trim().toLowerCase();
	const listed = needle
		? visible.filter((s) => s.movieTitle.toLowerCase().includes(needle))
		: visible.filter((s) => s.date === browseDate);
	const movies = groupByMovie(listed);

	const weekDays = weekStart
		? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
		: [];
	const weekEnd = weekStart ? addDays(weekStart, 6) : null;

	/* ---------- Step to previous / next showtime ---------- */

	const index = showtimes.findIndex((s) => s.id === current.id);
	const previous = index > 0 ? showtimes[index - 1] : null;
	const next = index < showtimes.length - 1 ? showtimes[index + 1] : null;

	// Move the popover's week + day to a showtime (so it follows the arrows).
	function syncTo(target) {
		setQuery("");
		setBrowseDate(target.date);
		setWeekStart(weekStartOf(target.date));
		if (isPast(target, now)) setShowPast(true); // never hide the selected showtime
	}

	function step(target) {
		if (!target) return;
		if (open) syncTo(target);
		onSelect(target.id);
	}

	/* ---------- Open / close ---------- */

	function openPicker() {
		setShowPast(isPast(current, now));
		syncTo(current);
		setOpen(true);
	}

	useEffect(() => {
		if (!open) return undefined;

		function handleKey(event) {
			if (event.key === "Escape") setOpen(false);
		}
		function handlePointer(event) {
			if (rootRef.current && !rootRef.current.contains(event.target))
				setOpen(false);
		}

		window.addEventListener("keydown", handleKey);
		window.addEventListener("mousedown", handlePointer);
		return () => {
			window.removeEventListener("keydown", handleKey);
			window.removeEventListener("mousedown", handlePointer);
		};
	}, [open]);

	function handlePick(id) {
		onSelect(id);
		setOpen(false);
	}

	function goToToday() {
		setWeekStart(weekStartOf(today));
		if (countByDate.has(today)) setBrowseDate(today);
	}

	/* ---------- Render ---------- */

	const currentState = stateOf(current, now);

	let heading;
	let hint;
	if (needle) {
		heading = `${listed.length} ${listed.length === 1 ? "match" : "matches"} for “${query.trim()}”`;
		hint = "All dates";
	} else {
		heading = `Showtimes on ${dayTitle(browseDate ?? current.date, today)}`;
		hint = "Pick a time to open its seat map";
	}

	return (
		<div className="stp" ref={rootRef}>
			<div className={`stp-bar${open ? " is-open" : ""}`}>
				<button
					type="button"
					className="stp-step"
					aria-label="Previous showtime"
					title="Previous showtime"
					disabled={!previous}
					onClick={() => step(previous)}
				>
					<Glyph name="left" />
				</button>

				<button
					type="button"
					className="stp-current"
					aria-haspopup="dialog"
					aria-expanded={open}
					onClick={open ? () => setOpen(false) : openPicker}
				>
					<span className="stp-current-when">
						{longDate(current.date, today)} ·{" "}
						{formatTime(current.time)}
					</span>
					<span className="stp-current-title">
						{current.movieTitle}
					</span>
					{currentState !== "upcoming" && (
						<span className={`stp-tag stp-tag--${currentState}`}>
							{STATE_LABEL[currentState]}
						</span>
					)}
					<span className="stp-current-pos">
						{index + 1} of {showtimes.length}
					</span>
					{/* <span className="stp-current-change">
						Change
						<Glyph name="down" />
					</span> */}
				</button>

				<button
					type="button"
					className="stp-step"
					aria-label="Next showtime"
					title="Next showtime"
					disabled={!next}
					onClick={() => step(next)}
				>
					<Glyph name="right" />
				</button>
			</div>

			{open && (
				<div
					className="stp-pop"
					role="dialog"
					aria-label="Choose showtime"
				>
					<div className="stp-search">
						<input
							type="search"
							placeholder="Search a movie (all dates)…"
							aria-label="Search a movie"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							autoFocus
						/>
						{query && (
							<button
								type="button"
								className="stp-search-clear"
								aria-label="Clear search"
								onClick={() => setQuery("")}
							>
								<Glyph name="close" size={14} />
							</button>
						)}
					</div>

					{!needle && (
						<div className="stp-week">
							<div className="stp-week-head">
								<button
									type="button"
									className="stp-icon-btn"
									aria-label="Previous week"
									title="Previous week"
									onClick={() =>
										setWeekStart(addDays(weekStart, -7))
									}
								>
									<Glyph name="left" />
								</button>
								<span className="stp-week-range">
									{shortDate(weekStart)} –{" "}
									{shortDate(weekEnd)},{" "}
									{fromKey(weekEnd).getFullYear()}
								</span>
								<button
									type="button"
									className="stp-icon-btn"
									aria-label="Next week"
									title="Next week"
									onClick={() =>
										setWeekStart(addDays(weekStart, 7))
									}
								>
									<Glyph name="right" />
								</button>
								<button
									type="button"
									className="stp-today"
									onClick={goToToday}
								>
									Today
								</button>
							</div>

							<div
								className="stp-days"
								role="group"
								aria-label="Show date"
							>
								{weekDays.map((key) => {
									const count = countByDate.get(key) ?? 0;
									const classes = [
										"stp-day",
										count > 0 ? "has-shows" : "",
										key === browseDate ? "is-selected" : "",
										key === today ? "is-today" : "",
									]
										.filter(Boolean)
										.join(" ");

									return (
										<button
											key={key}
											type="button"
											className={classes}
											disabled={count === 0}
											aria-pressed={key === browseDate}
											aria-label={`${dayTitle(key, today)}, ${
												count === 0
													? "no showtimes"
													: `${count} ${count === 1 ? "showtime" : "showtimes"}`
											}`}
											onClick={() => setBrowseDate(key)}
										>
											<span className="stp-day-weekday">
												{
													WEEKDAYS[
														fromKey(key).getDay()
													]
												}
											</span>
											<span className="stp-day-num">
												{fromKey(key).getDate()}
											</span>
											<span
												className={`stp-day-count${count === 0 ? " is-empty" : ""}`}
											>
												{count || 0}
											</span>
										</button>
									);
								})}
							</div>
							<p className="stp-legend">
								The number under each day is how many showtimes
								it has.
							</p>
						</div>
					)}

					<div className="stp-list-head">
						<h4>{heading}</h4>
						<span>{hint}</span>
					</div>

					<div className="stp-body">
						{movies.length === 0 ? (
							<p className="stp-empty">
								{needle
									? `No showtimes match “${query.trim()}” in ${cinemaName}.`
									: "No showtimes on this day."}
							</p>
						) : (
							movies.map((movie) => (
								<div className="stp-movie" key={movie.id}>
									<h5 className="stp-movie-title">
										{movie.title}
									</h5>

									{movie.dates.map((group) => (
										<div
											className="stp-row"
											key={group.date}
										>
											{needle && (
												<span className="stp-row-date">
													{longDate(
														group.date,
														today,
													)}
												</span>
											)}
											<div className="stp-chips">
												{group.list.map((showtime) => {
													const state = stateOf(
														showtime,
														now,
													);
													const selected =
														showtime.id ===
														current.id;

													return (
														<button
															key={showtime.id}
															type="button"
															className={`stp-chip${selected ? " is-selected" : ""}`}
															aria-pressed={
																selected
															}
															title={
																state ===
																"upcoming"
																	? undefined
																	: STATE_LABEL[
																			state
																		]
															}
															onClick={() =>
																handlePick(
																	showtime.id,
																)
															}
														>
															{selected && (
																<Glyph
																	name="check"
																	size={14}
																/>
															)}
															{formatTime(
																showtime.time,
															)}
															{state !==
																"upcoming" && (
																<span
																	className={`stp-dot stp-dot--${state}`}
																	aria-label={
																		STATE_LABEL[
																			state
																		]
																	}
																/>
															)}
														</button>
													);
												})}
											</div>
										</div>
									))}
								</div>
							))
						)}
					</div>

					<footer className="stp-foot">
						<button
							type="button"
							className="stp-switch"
							role="switch"
							aria-checked={showPast}
							onClick={() => setShowPast((value) => !value)}
						>
							<span
								className="stp-switch-track"
								aria-hidden="true"
							/>
							Show past showtimes
							{pastCount > 0 ? ` (${pastCount})` : ""}
						</button>
						<span>
							{showtimes.length}{" "}
							{showtimes.length === 1 ? "showtime" : "showtimes"}{" "}
							in {cinemaName}
						</span>
					</footer>
				</div>
			)}
		</div>
	);
}

export default ShowtimePicker;

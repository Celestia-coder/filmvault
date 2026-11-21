// SeatSelectionManagement.jsx — Admin seat map (one branch per admin account)
// Route: "/admin/seats"
//
// Real data:
//   showtimes + movie titles -> GET /api/showtimes, GET /api/movies
//   seat map + stats         -> GET /api/admin/cinemas/:id/seat-map?showtimeId=&branchId=
//   block / release          -> PUT /api/admin/showtimes/:id/seats/:seatId?branchId=
//   customer for a sold seat -> GET /api/admin/bookings?branchId=&date=&movieId=
//   cancel a booking         -> PATCH /api/admin/bookings/:id?branchId=

import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router";
import "../../styles/SeatSelectionManagement.css";
import "../../styles/AdminLive.css";

import AdminSidebar from "../../components/AdminSidebar.jsx";

import iconSeat from "../../assets/images/seatSelection/icon-seat.svg";
import iconAvailable from "../../assets/images/seatSelection/icon-available.svg";
import iconBooked from "../../assets/images/seatSelection/icon-booked.svg";
import iconMoney from "../../assets/images/seatSelection/icon-money.svg";

import { clearUser } from "../../api/session.js";
import { formatDate, formatTime } from "../../api/movies.js";
import {
	getAdminSession,
	fetchBranchShowtimes,
	fetchAdminSeatMap,
	fetchAdminBookings,
	setSeatStatus,
	cancelBooking,
} from "../../api/admin.js";

const STATUS_LABEL = {
	available: "Available",
	booked: "Reserved",
	blocked: "Blocked",
	held: "Held",
};

const EMPTY_ROWS = [];

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatPeso(amount) {
	return `₱${Number(amount).toLocaleString("en-PH")}`;
}

function plural(count, word) {
	return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function showtimeLabel(showtime) {
	const suffix = showtime.status === "scheduled" ? "" : ` (${showtime.status})`;
	return `${showtime.movieTitle} · ${formatDate(showtime.date)}, ${formatTime(showtime.time)}${suffix}`;
}

/* ------------------------------------------------------------------ */
/* Icons (inline so this page has no extra asset imports)              */
/* ------------------------------------------------------------------ */

function Icon({ children, size = 20, className }) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{children}
		</svg>
	);
}

const IconSeat = ({ size }) => (
	<Icon size={size}>
		<path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3" />
		<path d="M3 13a2 2 0 0 1 4 0v3h10v-3a2 2 0 0 1 4 0v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
		<path d="M6 19v2M18 19v2" />
	</Icon>
);

const IconCursor = ({ size }) => (
	<Icon size={size}>
		<path d="m5 4 14 6.5-6 2-2 6z" />
	</Icon>
);

const IconWarning = ({ size }) => (
	<Icon size={size}>
		<path d="M12 4 2.5 20h19z" />
		<path d="M12 10v4.5M12 17.5h.01" />
	</Icon>
);

/* ------------------------------------------------------------------ */
/* Shared pieces: page frame + loading / empty / error boxes           */
/* ------------------------------------------------------------------ */

function PageFrame({ children, overlay }) {
	return (
		<div className="admin-dashboard">
			<AdminSidebar />

			<div className="admin-main">
				<header className="admin-header">
					<h1 className="admin-title">
						<IconSeat size={32} />
						<span>
							Seat Selection <em>Management</em>
						</span>
					</h1>
					<Link to="/" className="admin-logout" onClick={clearUser}>
						Log Out
					</Link>
				</header>

				{children}
			</div>

			{overlay}
		</div>
	);
}

function StateBox({ title, text, loading, error, onRetry }) {
	return (
		<div
			className={`adm-state${error ? " adm-state--error" : ""}`}
			role={error ? "alert" : "status"}
		>
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

/* ------------------------------------------------------------------ */
/* Confirm modal for cancelling a booking                              */
/* ------------------------------------------------------------------ */

function CancelBookingModal({ booking, busy, onKeep, onConfirm }) {
	useEffect(() => {
		function handleKey(event) {
			if (event.key === "Escape" && !busy) onKeep();
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onKeep, busy]);

	return (
		<div className="ssm-overlay" onClick={busy ? undefined : onKeep}>
			<div
				className="ssm-modal"
				role="dialog"
				aria-modal="true"
				aria-labelledby="ssm-modal-title"
				onClick={(event) => event.stopPropagation()}
			>
				<span className="ssm-modal-icon">
					<IconWarning size={30} />
				</span>
				<h3 id="ssm-modal-title">Cancel booking {booking.ref}?</h3>
				<p>
					{booking.customer}'s {plural(booking.seatIds.length, "seat")} (
					{booking.seatIds.join(", ")}) will become available again. This
					can't be undone.
				</p>
				<div className="ssm-modal-actions">
					<button
						type="button"
						className="ssm-btn ssm-btn--ghost"
						onClick={onKeep}
						disabled={busy}
					>
						Keep booking
					</button>
					<button
						type="button"
						className="ssm-btn ssm-btn--danger"
						onClick={onConfirm}
						disabled={busy}
					>
						{busy ? "Cancelling…" : "Cancel booking"}
					</button>
				</div>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* One seat circle                                                     */
/* ------------------------------------------------------------------ */

function SeatButton({ seat, isSelected, onToggle }) {
	const stateText = STATUS_LABEL[seat.status]?.toLowerCase() ?? seat.status;

	return (
		<button
			type="button"
			className={`ssm-seat ssm-seat--${seat.status}${isSelected ? " is-selected" : ""}`}
			aria-pressed={isSelected}
			aria-label={`Seat ${seat.label}, ${stateText}${isSelected ? ", selected" : ""}`}
			title={`${seat.label} · ${STATUS_LABEL[seat.status] ?? seat.status}`}
			onClick={() => onToggle(seat.id)}
		>
			{seat.number}
		</button>
	);
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function SeatSelectionManagement({ branchId }) {
	/* ---------- Load the branch's showtimes (once, retryable) ---------- */

	const [baseReload, setBaseReload] = useState(0);
	// { key, data | error } — the key ties a result to the request that made it.
	const [baseResult, setBaseResult] = useState(null);
	const baseKey = `${branchId}:${baseReload}`;

	useEffect(() => {
		const controller = new AbortController();
		fetchBranchShowtimes(branchId, controller.signal)
			.then((data) => setBaseResult({ key: baseKey, data }))
			.catch((error) => {
				if (error.name === "AbortError") return;
				setBaseResult({ key: baseKey, error });
			});
		return () => controller.abort();
	}, [branchId, baseKey]);

	const base = baseResult?.key === baseKey ? baseResult : null;
	const showtimes = base?.data?.showtimes ?? EMPTY_ROWS;

	// Cinemas come from the showtimes (a cinema with no showtime has nothing to show).
	const cinemas = useMemo(() => {
		const byId = new Map();
		showtimes.forEach((showtime) => {
			if (!byId.has(showtime.cinemaId)) {
				byId.set(showtime.cinemaId, {
					id: showtime.cinemaId,
					name: `Cinema ${showtime.cinemaNum}`,
					num: showtime.cinemaNum,
				});
			}
		});
		return [...byId.values()].sort((a, b) => a.num - b.num);
	}, [showtimes]);

	/* ---------- Which cinema / showtime is chosen ---------- */

	const [pickedCinema, setPickedCinema] = useState(null);
	const [pickedShowtime, setPickedShowtime] = useState(null);

	// Fall back to the first option whenever the pick is missing or no longer valid.
	const cinemaId = cinemas.some((c) => c.id === pickedCinema)
		? pickedCinema
		: (cinemas[0]?.id ?? null);
	const cinemaShowtimes = showtimes.filter((s) => s.cinemaId === cinemaId);
	const showtime =
		cinemaShowtimes.find((s) => s.id === pickedShowtime) ?? cinemaShowtimes[0] ?? null;

	const showtimeId = showtime?.id ?? null;
	const showtimeCinemaId = showtime?.cinemaId ?? null;
	const showDate = showtime?.date ?? null;
	const showMovieId = showtime?.movieId ?? null;

	/* ---------- Load the seat map for that showtime ---------- */

	const [mapReload, setMapReload] = useState(0);
	const [mapResult, setMapResult] = useState(null);
	const mapKey = `${showtimeId}:${mapReload}`;

	useEffect(() => {
		if (showtimeId === null) return undefined;
		const controller = new AbortController();

		Promise.all([
			fetchAdminSeatMap(
				{ cinemaId: showtimeCinemaId, showtimeId, branchId },
				controller.signal,
			),
			// Customer names for sold seats. If this fails the map still works.
			fetchAdminBookings(
				{ branchId, date: showDate, movieId: showMovieId },
				controller.signal,
			).catch((error) => {
				if (error.name === "AbortError") throw error;
				return null;
			}),
		])
			.then(([seatMap, bookings]) => {
				const bookingsById = new Map(
					(bookings ?? [])
						.filter((booking) => booking.showtimeId === showtimeId)
						.map((booking) => [booking.id, booking]),
				);
				setMapResult({
					key: mapKey,
					showtimeId,
					seatMap,
					bookingsById,
					bookingsFailed: bookings === null,
				});
			})
			.catch((error) => {
				if (error.name === "AbortError") return;
				setMapResult({ key: mapKey, showtimeId, error });
			});

		return () => controller.abort();
	}, [showtimeId, showtimeCinemaId, showDate, showMovieId, branchId, mapKey]);

	// Result for THIS showtime only (never show another showtime's seats).
	const forShowtime = mapResult?.showtimeId === showtimeId ? mapResult : null;
	const mapFresh = forShowtime?.key === mapKey ? forShowtime : null;
	const mapData = forShowtime && !forShowtime.error ? forShowtime : null;
	const mapRefreshing = Boolean(mapData) && !mapFresh;

	const rows = mapData?.seatMap.rows ?? EMPTY_ROWS;
	const stats = mapData?.seatMap.stats ?? null;
	const bookingsById = mapData?.bookingsById ?? null;

	const flatSeats = useMemo(() => rows.flatMap((row) => row.seats), [rows]);
	const seatsPerRow = rows.reduce((max, row) => Math.max(max, row.seats.length), 0);
	const leftCols = Math.ceil(seatsPerRow / 2);
	const rightCols = seatsPerRow - leftCols;

	/* ---------- Selection + actions ---------- */

	const [selected, setSelected] = useState([]);
	const [notice, setNotice] = useState(null); // { type: "ok" | "error", text }
	const [confirmingCancel, setConfirmingCancel] = useState(false);
	const [busy, setBusy] = useState(false);

	const selectedSet = new Set(selected);
	const selectedSeats = flatSeats.filter((seat) => selectedSet.has(seat.id));

	// A selection is always one type: open, blocked, held, or ONE booking.
	const selectionStatus = selectedSeats[0]?.status ?? null;
	let booking = null;
	if (selectionStatus === "booked") {
		const bookingId = selectedSeats[0].bookingId;
		const info = bookingsById?.get(bookingId);
		booking = {
			id: bookingId,
			ref: info?.reference ?? `#${bookingId}`,
			customer: info?.customer.name ?? "Customer unavailable",
			seatIds: selectedSeats.map((seat) => seat.label),
			total: info?.amount ?? selectedSeats.reduce((sum, seat) => sum + seat.price, 0),
			discount: info?.discountLabel ?? "",
		};
	}

	function resetSelection() {
		setSelected([]);
		setNotice(null);
		setConfirmingCancel(false);
	}

	function handleCinemaChange(event) {
		setPickedCinema(Number(event.target.value));
		setPickedShowtime(null);
		resetSelection();
	}

	function handleShowtimeChange(event) {
		setPickedShowtime(Number(event.target.value));
		resetSelection();
	}

	function toggleSeat(seatId) {
		setNotice(null);
		const seat = flatSeats.find((s) => s.id === seatId);
		if (!seat) return;

		// Reserved seat: select the whole booking it belongs to.
		if (seat.status === "booked") {
			const bookingSeatIds = flatSeats
				.filter((s) => s.bookingId === seat.bookingId)
				.map((s) => s.id);
			setSelected((prev) => (prev.includes(seatId) ? [] : bookingSeatIds));
			return;
		}

		// Open / blocked / held seats: several allowed, but never mixed types.
		if (selectionStatus !== seat.status) {
			setSelected([seatId]);
			return;
		}
		setSelected((prev) =>
			prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId],
		);
	}

	// "block" or "release" for every selected seat, then reload the map.
	async function runSeatAction(action) {
		setBusy(true);
		setNotice(null);
		const results = await Promise.allSettled(
			selected.map((seatId) => setSeatStatus({ showtimeId, seatId, branchId, action })),
		);
		const failed = results.filter((result) => result.status === "rejected");
		const done = results.length - failed.length;
		const verb = action === "block" ? "Blocked" : "Released";

		setSelected([]);
		setBusy(false);
		setMapReload((n) => n + 1);
		setNotice(
			failed.length === 0
				? { type: "ok", text: `${verb} ${plural(done, "seat")}.` }
				: {
						type: "error",
						text: `${verb} ${plural(done, "seat")}. ${plural(failed.length, "seat")} failed: ${failed[0].reason.message}`,
					},
		);
	}

	async function handleCancelBooking() {
		setBusy(true);
		try {
			const { seatsReleased } = await cancelBooking({ bookingId: booking.id, branchId });
			setNotice({
				type: "ok",
				text: `Cancelled booking ${booking.ref}. ${plural(seatsReleased, "seat")} released.`,
			});
			setSelected([]);
			setMapReload((n) => n + 1);
		} catch (error) {
			setNotice({ type: "error", text: error.message });
		} finally {
			setConfirmingCancel(false);
			setBusy(false);
		}
	}

	/* ---------- Render ---------- */

	if (!base) {
		return (
			<PageFrame>
				<StateBox loading title="Loading showtimes…" />
			</PageFrame>
		);
	}

	if (base.error) {
		return (
			<PageFrame>
				<StateBox
					error
					title="Couldn't load showtimes"
					text={base.error.message}
					onRetry={() => setBaseReload((n) => n + 1)}
				/>
			</PageFrame>
		);
	}

	if (showtimes.length === 0) {
		return (
			<PageFrame>
				<StateBox
					title="No showtimes for this branch yet"
					text="Add a showtime in Schedule Management, then come back to manage its seats."
				/>
			</PageFrame>
		);
	}

	const STAT_CARDS = [
		{
			label: "Total Seats",
			value: stats ? stats.total : "–",
			icon: iconSeat,
			tone: "",
		},
		{
			label: "Available",
			value: stats ? stats.available : "–",
			icon: iconAvailable,
			tone: "ssm-stat-value--green",
			sub: stats ? `${stats.held} held · ${stats.blocked} blocked` : "",
		},
		{
			label: "Sold / Booked",
			value: stats ? stats.sold : "–",
			icon: iconBooked,
			tone: "ssm-stat-value--red",
		},
		{
			label: "Revenue",
			value: stats ? formatPeso(stats.revenue) : "–",
			icon: iconMoney,
			tone: "ssm-stat-value--green",
		},
	];

	let inspectorSubtitle = "Select a seat on the map to manage it";
	if (booking) inspectorSubtitle = `Booking ${booking.ref}`;
	else if (selectedSeats.length > 0)
		inspectorSubtitle = `${plural(selectedSeats.length, "seat")} selected`;

	const chips = (
		<ul className="ssm-chip-list">
			{selectedSeats.map((seat) => (
				<li key={seat.id}>{seat.label}</li>
			))}
		</ul>
	);

	const clearButton = (
		<button
			type="button"
			className="ssm-btn ssm-btn--ghost"
			onClick={resetSelection}
			disabled={busy}
		>
			Clear selection
		</button>
	);

	let mapSection;
	if (mapFresh?.error) {
		mapSection = (
			<StateBox
				error
				title="Couldn't load the seat map"
				text={mapFresh.error.message}
				onRetry={() => setMapReload((n) => n + 1)}
			/>
		);
	} else if (!mapData) {
		mapSection = <StateBox loading title="Loading seat map…" />;
	} else if (flatSeats.length === 0) {
		mapSection = (
			<StateBox
				title="No seats set up for this cinema"
				text="This cinema has no seats in the database yet, so there is nothing to manage."
			/>
		);
	}

	return (
		<PageFrame
			overlay={
				confirmingCancel &&
				booking && (
					<CancelBookingModal
						booking={booking}
						busy={busy}
						onKeep={() => setConfirmingCancel(false)}
						onConfirm={handleCancelBooking}
					/>
				)
			}
		>
			<section className="ssm-filters" aria-label="Choose showtime">
				<div className="ssm-field">
					<label htmlFor="ssm-cinema">Cinema</label>
					<select
						id="ssm-cinema"
						className="ssm-select ssm-select--cinema"
						value={cinemaId}
						onChange={handleCinemaChange}
					>
						{cinemas.map((c) => (
							<option key={c.id} value={c.id}>
								{c.name}
							</option>
						))}
					</select>
				</div>

				<div className="ssm-field">
					<label htmlFor="ssm-showtime">Showtime</label>
					<select
						id="ssm-showtime"
						className="ssm-select ssm-select--showtime"
						value={showtimeId}
						onChange={handleShowtimeChange}
					>
						{cinemaShowtimes.map((s) => (
							<option key={s.id} value={s.id}>
								{showtimeLabel(s)}
							</option>
						))}
					</select>
				</div>
			</section>

			{mapData?.bookingsFailed && (
				<p className="adm-notice adm-notice--error" role="status">
					Couldn't load customer details for sold seats. The map is still accurate.
				</p>
			)}

			<section className="ssm-stats" aria-label="Seat summary">
				{STAT_CARDS.map((card) => (
					<article className="ssm-stat-card" key={card.label}>
						<div className="ssm-stat-text">
							<p className="ssm-stat-label">{card.label}</p>
							<p className={`ssm-stat-value ${card.tone}`}>{card.value}</p>
							{card.sub && <p className="adm-stat-sub">{card.sub}</p>}
						</div>
						<img className="ssm-stat-icon" src={card.icon} alt="" />
					</article>
				))}
			</section>

			{mapSection ?? (
				<div className="ssm-layout">
					<section
						className={`ssm-map-panel${mapRefreshing ? " adm-busy" : ""}`}
						aria-label="Seat map"
						aria-busy={mapRefreshing}
					>
						<header className="ssm-panel-head">
							<span className="ssm-panel-icon">
								<IconSeat size={20} />
							</span>
							<h3>Select Seats</h3>
						</header>

						<ul className="ssm-legend">
							<li>
								<span className="ssm-seat ssm-seat--available ssm-legend-swatch" />
								Available
							</li>
							<li>
								<span className="ssm-seat ssm-seat--booked ssm-legend-swatch" />
								Reserved
							</li>
							<li>
								<span className="ssm-seat ssm-seat--held ssm-legend-swatch" />
								Held
							</li>
							<li>
								<span className="ssm-seat ssm-seat--blocked ssm-legend-swatch" />
								Blocked
							</li>
							<li>
								<span className="ssm-seat ssm-seat--available is-selected ssm-legend-swatch" />
								Selected
							</li>
						</ul>

						<div className="ssm-map-scroll">
							<div
								className="ssm-map"
								style={{
									"--ssm-seats-per-row": seatsPerRow,
									"--ssm-left-cols": leftCols,
									"--ssm-right-cols": rightCols,
								}}
							>
								<div className="ssm-screen">
									<div className="ssm-screen-bar" />
									<span>Screen</span>
								</div>

								{rows.map((row) => (
									<div className="ssm-row" key={row.label}>
										<span className="ssm-row-label">{row.label}</span>

										<div className="ssm-group ssm-group--left">
											{row.seats.slice(0, leftCols).map((seat) => (
												<SeatButton
													key={seat.id}
													seat={seat}
													isSelected={selectedSet.has(seat.id)}
													onToggle={toggleSeat}
												/>
											))}
										</div>

										<div className="ssm-group ssm-group--right">
											{row.seats.slice(leftCols).map((seat) => (
												<SeatButton
													key={seat.id}
													seat={seat}
													isSelected={selectedSet.has(seat.id)}
													onToggle={toggleSeat}
												/>
											))}
										</div>
									</div>
								))}
							</div>
						</div>
					</section>

					<aside className="ssm-inspector" aria-label="Seat inspector">
						<header className="ssm-inspector-head">
							<h3>Seat Inspector</h3>
							<p>{inspectorSubtitle}</p>
						</header>

						<div className="ssm-inspector-body">
							{notice && (
								<p
									className={`ssm-notice${notice.type === "error" ? " adm-notice--error" : ""}`}
									role="status"
								>
									{notice.text}
								</p>
							)}

							{selectedSeats.length === 0 && (
								<div className="ssm-empty">
									<span className="ssm-empty-icon">
										<IconCursor size={22} />
									</span>
									<p className="ssm-empty-title">No seats selected</p>
									<p className="ssm-empty-text">
										Click any seat to view its booking or to block,
										release, or cancel it.
									</p>
								</div>
							)}

							{booking && (
								<>
									<span className="ssm-tag ssm-tag--booked">Reserved</span>
									<dl className="ssm-details">
										<div>
											<dt>Customer</dt>
											<dd>{booking.customer}</dd>
										</div>
										<div>
											<dt>Booking ref</dt>
											<dd>{booking.ref}</dd>
										</div>
										<div>
											<dt>{booking.seatIds.length === 1 ? "Seat" : "Seats"}</dt>
											<dd>{booking.seatIds.join(", ")}</dd>
										</div>
										{booking.discount && (
											<div>
												<dt>Tickets</dt>
												<dd>{booking.discount}</dd>
											</div>
										)}
										<div>
											<dt>Amount</dt>
											<dd>{formatPeso(booking.total)}</dd>
										</div>
									</dl>

									<div className="ssm-actions">
										<button
											type="button"
											className="ssm-btn ssm-btn--danger"
											onClick={() => setConfirmingCancel(true)}
											disabled={busy}
										>
											Cancel booking
										</button>
										{clearButton}
									</div>
								</>
							)}

							{selectionStatus === "available" && (
								<>
									<span className="ssm-tag ssm-tag--available">Available</span>
									{chips}
									<p className="ssm-hint">
										Blocked seats can't be booked by customers. Click more
										open seats to block them together.
									</p>

									<div className="ssm-actions">
										<button
											type="button"
											className="ssm-btn ssm-btn--primary"
											onClick={() => runSeatAction("block")}
											disabled={busy}
										>
											{busy
												? "Blocking…"
												: `Block ${plural(selectedSeats.length, "seat")}`}
										</button>
										{clearButton}
									</div>
								</>
							)}

							{selectionStatus === "blocked" && (
								<>
									<span className="ssm-tag ssm-tag--blocked">Blocked</span>
									{chips}
									<p className="ssm-hint">
										Release these seats to let customers book them again.
									</p>

									<div className="ssm-actions">
										<button
											type="button"
											className="ssm-btn ssm-btn--outline"
											onClick={() => runSeatAction("release")}
											disabled={busy}
										>
											{busy
												? "Releasing…"
												: `Release ${plural(selectedSeats.length, "seat")}`}
										</button>
										{clearButton}
									</div>
								</>
							)}

							{selectionStatus === "held" && (
								<>
									<span className="ssm-tag ssm-tag--blocked">Held</span>
									{chips}
									<p className="ssm-hint">
										A customer is checking out with these seats. They free up
										on their own after 10 minutes; release them now only for
										a stuck checkout.
									</p>

									<div className="ssm-actions">
										<button
											type="button"
											className="ssm-btn ssm-btn--outline"
											onClick={() => runSeatAction("release")}
											disabled={busy}
										>
											{busy
												? "Releasing…"
												: `Release ${plural(selectedSeats.length, "seat")}`}
										</button>
										{clearButton}
									</div>
								</>
							)}
						</div>
					</aside>
				</div>
			)}
		</PageFrame>
	);
}

// Only a logged-in admin gets the page; everyone else goes to the admin login.
function SeatSelectionManagementPage() {
	const admin = getAdminSession();
	if (!admin) return <Navigate to="/admin/login" replace />;
	return <SeatSelectionManagement branchId={admin.branchId} />;
}

export default SeatSelectionManagementPage;

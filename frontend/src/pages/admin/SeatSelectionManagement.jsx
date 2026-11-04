// SeatSelectionManagement.jsx — Admin seat map (one branch per admin account)
// Route: "/admin/seats"

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import "../../styles/SeatSelectionManagement.css";

import AdminSidebar from "../../components/AdminSidebar.jsx";

import iconSeat from "../../assets/images/seatSelection/icon-seat.svg";
import iconAvailable from "../../assets/images/seatSelection/icon-available.svg";
import iconBooked from "../../assets/images/seatSelection/icon-booked.svg";
import iconMoney from "../../assets/images/seatSelection/icon-money.svg";

/* ------------------------------------------------------------------ */
/* Mock data — replace with API data later                             */
/* ------------------------------------------------------------------ */

// One admin account per branch. Seat counts are per cinema.
// `seatsPerRow` only controls how the map is drawn (rows = seats / seatsPerRow).
const BRANCHES = {
	"vista-mall": {
		name: "Vista Mall",
		cinemas: 3,
		seatsPerCinema: 140,
		seatsPerRow: 14,
	},
	"market-market": {
		name: "Market Market",
		cinemas: 7,
		seatsPerCinema: 360,
		seatsPerRow: 24,
	},
	venice: {
		name: "Venice",
		cinemas: 4,
		seatsPerCinema: 280,
		seatsPerRow: 20,
	},
};

// TODO: read this from the logged-in admin's session instead of hardcoding.
const CURRENT_BRANCH_ID = "vista-mall";

const MOVIES = [
	{ title: "White Chicks", price: 550 },
	{ title: "Mean Girls", price: 500 },
	{ title: "Disclosure Day", price: 600 },
	{ title: "Toy Story 5", price: 350 },
	{ title: "The Devil Wears Prada 2", price: 800 },
];

const SHOW_DATE = "Sun Jun 16";
const TIME_SLOTS = ["10:00 AM", "1:00 PM", "4:00 PM"];

const CUSTOMERS = [
	"Maria Santos",
	"Juan Dela Cruz",
	"Angela Reyes",
	"Miguel Garcia",
	"Sofia Bautista",
	"Carlo Mendoza",
	"Isabel Cruz",
	"Paolo Ramos",
];

const STATUS_LABEL = {
	available: "Available",
	booked: "Reserved",
	blocked: "Blocked",
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// 0 -> "A", 25 -> "Z", 26 -> "AA"
function rowLabel(index) {
	let label = "";
	let n = index;
	do {
		label = String.fromCharCode(65 + (n % 26)) + label;
		n = Math.floor(n / 26) - 1;
	} while (n >= 0);
	return label;
}

function formatPeso(amount) {
	return `₱${amount.toLocaleString("en-PH")}`;
}

function plural(count, word) {
	return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// Small seeded random generator so the mock data stays the same on re-render.
function createRandom(seedText) {
	let seed = 0;
	for (let i = 0; i < seedText.length; i++) {
		seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
	}
	return function random() {
		seed = (seed + 0x6d2b79f5) >>> 0;
		let t = seed;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function buildCinemas(branch) {
	return Array.from({ length: branch.cinemas }, (_, i) => ({
		id: i + 1,
		name: `Cinema ${i + 1}`,
		totalSeats: branch.seatsPerCinema,
		seatsPerRow: branch.seatsPerRow,
	}));
}

// 3 showtimes per cinema, rotating through the movie list.
function buildShowtimes(cinemas) {
	return cinemas.flatMap((cinema) =>
		TIME_SLOTS.map((time, slot) => {
			const movie = MOVIES[(cinema.id + slot) % MOVIES.length];
			return {
				id: `c${cinema.id}-s${slot + 1}`,
				cinemaId: cinema.id,
				title: movie.title,
				price: movie.price,
				schedule: `${SHOW_DATE}, ${time}`,
			};
		}),
	);
}

// Turns "total seats" into rows of seats. This is what makes the map dynamic:
// change totalSeats / seatsPerRow and the circles multiply automatically.
function buildLayout(totalSeats, seatsPerRow) {
	const rowCount = Math.ceil(totalSeats / seatsPerRow);
	return Array.from({ length: rowCount }, (_, r) => {
		const label = rowLabel(r);
		const seatsInRow = Math.min(seatsPerRow, totalSeats - r * seatsPerRow);
		return {
			label,
			seats: Array.from({ length: seatsInRow }, (_, i) => ({
				id: `${label}${i + 1}`,
				number: i + 1,
			})),
		};
	});
}

// Only seats that are NOT available are stored, e.g.
//   { A3: { status: "booked", ref, customer, price }, A4: { status: "blocked" } }
// Anything missing from this object is available.
// Seats that share the same `ref` belong to the same booking.
function buildInitialSeatState(showtime, layout, seatsPerRow) {
	const random = createRandom(showtime.id);
	const leftCols = Math.ceil(seatsPerRow / 2);
	const state = {};

	layout.forEach((row) => {
		let i = 0;
		while (i < row.seats.length) {
			const roll = random();

			if (roll < 0.055) {
				// A booking of 1–4 neighbouring seats, kept on one side of the aisle.
				const sideEnd = i < leftCols ? leftCols : row.seats.length;
				const end = Math.min(i + 1 + Math.floor(random() * 4), sideEnd);
				const booking = {
					status: "booked",
					ref: `FV-${Math.floor(random() * 900000) + 100000}`,
					customer:
						CUSTOMERS[Math.floor(random() * CUSTOMERS.length)],
					price: showtime.price,
				};
				for (let j = i; j < end; j++) {
					state[row.seats[j].id] = booking;
				}
				i = end;
			} else {
				if (roll < 0.075) {
					state[row.seats[i].id] = { status: "blocked" };
				}
				i += 1;
			}
		}
	});

	return state;
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
/* Confirm modal for cancelling a booking                              */
/* ------------------------------------------------------------------ */

function CancelBookingModal({ booking, onKeep, onConfirm }) {
	useEffect(() => {
		function handleKey(event) {
			if (event.key === "Escape") onKeep();
		}
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [onKeep]);

	return (
		<div className="ssm-overlay" onClick={onKeep}>
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
					{booking.customer}'s{" "}
					{plural(booking.seatIds.length, "seat")} (
					{booking.seatIds.join(", ")}) will become available again.
					This can't be undone.
				</p>
				<div className="ssm-modal-actions">
					<button
						type="button"
						className="ssm-btn ssm-btn--ghost"
						onClick={onKeep}
					>
						Keep booking
					</button>
					<button
						type="button"
						className="ssm-btn ssm-btn--danger"
						onClick={onConfirm}
					>
						Cancel booking
					</button>
				</div>
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ */
/* One seat circle                                                     */
/* ------------------------------------------------------------------ */

function SeatButton({ seat, status, isSelected, onToggle }) {
	const stateText = STATUS_LABEL[status].toLowerCase();

	return (
		<button
			type="button"
			className={`ssm-seat ssm-seat--${status}${isSelected ? " is-selected" : ""}`}
			aria-pressed={isSelected}
			aria-label={`Seat ${seat.id}, ${stateText}${isSelected ? ", selected" : ""}`}
			title={`${seat.id} · ${STATUS_LABEL[status]}`}
			onClick={() => onToggle(seat.id)}
		>
			{seat.number}
		</button>
	);
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function SeatSelectionManagement() {
	const branch = BRANCHES[CURRENT_BRANCH_ID];
	const cinemas = useMemo(() => buildCinemas(branch), [branch]);
	const showtimes = useMemo(() => buildShowtimes(cinemas), [cinemas]);

	const [cinemaId, setCinemaId] = useState(cinemas[0].id);
	const [showtimeId, setShowtimeId] = useState(
		showtimes.find((s) => s.cinemaId === cinemas[0].id).id,
	);
	const [selected, setSelected] = useState([]);
	const [notice, setNotice] = useState("");
	const [confirmingCancel, setConfirmingCancel] = useState(false);

	// Seat changes made by the admin, keyed by showtime id.
	const [changes, setChanges] = useState({});

	const cinema = cinemas.find((c) => c.id === cinemaId);
	const cinemaShowtimes = showtimes.filter((s) => s.cinemaId === cinemaId);
	const showtime = showtimes.find((s) => s.id === showtimeId);

	const layout = useMemo(
		() => buildLayout(cinema.totalSeats, cinema.seatsPerRow),
		[cinema],
	);
	const flatSeats = useMemo(
		() => layout.flatMap((row) => row.seats),
		[layout],
	);

	const initialSeatState = useMemo(
		() => buildInitialSeatState(showtime, layout, cinema.seatsPerRow),
		[showtime, layout, cinema],
	);
	const seatState = changes[showtimeId] ?? initialSeatState;

	const leftCols = Math.ceil(cinema.seatsPerRow / 2);
	const rightCols = cinema.seatsPerRow - leftCols;

	/* ---------- Stats ---------- */

	const stats = useMemo(() => {
		const entries = Object.values(seatState);
		const booked = entries.filter((s) => s.status === "booked");
		const blocked = entries.filter((s) => s.status === "blocked");
		return {
			total: cinema.totalSeats,
			available: cinema.totalSeats - booked.length - blocked.length,
			booked: booked.length,
			revenue: booked.reduce((sum, s) => sum + s.price, 0),
		};
	}, [seatState, cinema]);

	/* ---------- Selection ---------- */

	const selectedSet = new Set(selected);
	const selectedSeats = flatSeats
		.filter((seat) => selectedSet.has(seat.id))
		.map((seat) => ({
			...seat,
			info: seatState[seat.id],
			status: seatState[seat.id]?.status ?? "available",
		}));

	// A selection is always one type: open seats, blocked seats, or ONE booking.
	const selectionStatus = selectedSeats[0]?.status ?? null;
	const booking =
		selectionStatus === "booked"
			? {
					ref: selectedSeats[0].info.ref,
					customer: selectedSeats[0].info.customer,
					seatIds: selectedSeats.map((s) => s.id),
					total: selectedSeats.length * selectedSeats[0].info.price,
				}
			: null;

	function resetSelection() {
		setSelected([]);
		setNotice("");
		setConfirmingCancel(false);
	}

	function handleCinemaChange(event) {
		const nextCinemaId = Number(event.target.value);
		setCinemaId(nextCinemaId);
		setShowtimeId(showtimes.find((s) => s.cinemaId === nextCinemaId).id);
		resetSelection();
	}

	function handleShowtimeChange(event) {
		setShowtimeId(event.target.value);
		resetSelection();
	}

	function toggleSeat(seatId) {
		setNotice("");
		const status = seatState[seatId]?.status ?? "available";

		// Reserved seat: select the whole booking it belongs to.
		if (status === "booked") {
			const ref = seatState[seatId].ref;
			const bookingSeatIds = flatSeats
				.filter((seat) => seatState[seat.id]?.ref === ref)
				.map((seat) => seat.id);
			setSelected((prev) =>
				prev.includes(seatId) ? [] : bookingSeatIds,
			);
			return;
		}

		// Open / blocked seats: several allowed, but never mixed types.
		const currentStatus = selected.length
			? (seatState[selected[0]]?.status ?? "available")
			: null;
		if (currentStatus !== status) {
			setSelected([seatId]);
			return;
		}
		setSelected((prev) =>
			prev.includes(seatId)
				? prev.filter((id) => id !== seatId)
				: [...prev, seatId],
		);
	}

	/* ---------- Admin actions ---------- */

	function applyChange(nextState, message) {
		setChanges((prev) => ({ ...prev, [showtimeId]: nextState }));
		setSelected([]);
		setConfirmingCancel(false);
		setNotice(message);
	}

	function handleBlock() {
		const next = { ...seatState };
		selected.forEach((id) => {
			next[id] = { status: "blocked" };
		});
		applyChange(next, `Blocked ${plural(selected.length, "seat")}.`);
	}

	function handleRelease() {
		const next = { ...seatState };
		selected.forEach((id) => {
			delete next[id];
		});
		applyChange(next, `Released ${plural(selected.length, "seat")}.`);
	}

	function handleCancelBooking() {
		const next = { ...seatState };
		booking.seatIds.forEach((id) => {
			delete next[id];
		});
		applyChange(next, `Cancelled booking ${booking.ref}.`);
	}

	/* ---------- Render ---------- */

	const STAT_CARDS = [
		{
			label: "Total Seats",
			value: stats.total,
			icon: iconSeat,
			tone: "",
		},
		{
			label: "Available",
			value: stats.available,
			icon: iconAvailable,
			tone: "ssm-stat-value--green",
		},
		{
			label: "Sold / Booked",
			value: stats.booked,
			icon: iconBooked,
			tone: "ssm-stat-value--red",
		},
		{
			label: "Revenue",
			value: formatPeso(stats.revenue),
			icon: iconMoney,
			tone: "ssm-stat-value--green",
		},
	];

	let inspectorSubtitle = "Select a seat on the map to manage it";
	if (booking) inspectorSubtitle = `Booking ${booking.ref}`;
	else if (selectedSeats.length > 0)
		inspectorSubtitle = `${plural(selectedSeats.length, "seat")} selected`;

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
					<Link to="/" className="admin-logout">
						Log Out
					</Link>
				</header>

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
									{s.title} · {s.schedule}
								</option>
							))}
						</select>
					</div>
				</section>

				<section className="ssm-stats" aria-label="Seat summary">
					{STAT_CARDS.map((card) => (
						<article className="ssm-stat-card" key={card.label}>
							<div className="ssm-stat-text">
								<p className="ssm-stat-label">{card.label}</p>
								<p className={`ssm-stat-value ${card.tone}`}>
									{card.value}
								</p>
							</div>
							<img
								className="ssm-stat-icon"
								src={card.icon}
								alt=""
							/>
						</article>
					))}
				</section>

				<div className="ssm-layout">
					<section className="ssm-map-panel" aria-label="Seat map">
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
									"--ssm-seats-per-row": cinema.seatsPerRow,
									"--ssm-left-cols": leftCols,
									"--ssm-right-cols": rightCols,
								}}
							>
								<div className="ssm-screen">
									<div className="ssm-screen-bar" />
									<span>Screen</span>
								</div>

								{layout.map((row) => (
									<div className="ssm-row" key={row.label}>
										<span className="ssm-row-label">
											{row.label}
										</span>

										<div className="ssm-group ssm-group--left">
											{row.seats
												.slice(0, leftCols)
												.map((seat) => (
													<SeatButton
														key={seat.id}
														seat={seat}
														status={
															seatState[seat.id]
																?.status ??
															"available"
														}
														isSelected={selectedSet.has(
															seat.id,
														)}
														onToggle={toggleSeat}
													/>
												))}
										</div>

										<div className="ssm-group ssm-group--right">
											{row.seats
												.slice(leftCols)
												.map((seat) => (
													<SeatButton
														key={seat.id}
														seat={seat}
														status={
															seatState[seat.id]
																?.status ??
															"available"
														}
														isSelected={selectedSet.has(
															seat.id,
														)}
														onToggle={toggleSeat}
													/>
												))}
										</div>
									</div>
								))}
							</div>
						</div>
					</section>

					<aside
						className="ssm-inspector"
						aria-label="Seat inspector"
					>
						<header className="ssm-inspector-head">
							<h3>Seat Inspector</h3>
							<p>{inspectorSubtitle}</p>
						</header>

						<div className="ssm-inspector-body">
							{notice && (
								<p className="ssm-notice" role="status">
									{notice}
								</p>
							)}

							{selectedSeats.length === 0 && (
								<div className="ssm-empty">
									<span className="ssm-empty-icon">
										<IconCursor size={22} />
									</span>
									<p className="ssm-empty-title">
										No seats selected
									</p>
									<p className="ssm-empty-text">
										Click any seat to view its booking or to
										block, release, or cancel it.
									</p>
								</div>
							)}

							{booking && (
								<>
									<span className="ssm-tag ssm-tag--booked">
										Reserved
									</span>
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
											<dt>
												{booking.seatIds.length === 1
													? "Seat"
													: "Seats"}
											</dt>
											<dd>
												{booking.seatIds.join(", ")}
											</dd>
										</div>
										<div>
											<dt>Amount</dt>
											<dd>{formatPeso(booking.total)}</dd>
										</div>
									</dl>

									<div className="ssm-actions">
										<button
											type="button"
											className="ssm-btn ssm-btn--danger"
											onClick={() =>
												setConfirmingCancel(true)
											}
										>
											Cancel booking
										</button>
										<button
											type="button"
											className="ssm-btn ssm-btn--ghost"
											onClick={resetSelection}
										>
											Clear selection
										</button>
									</div>
								</>
							)}

							{selectionStatus === "available" && (
								<>
									<span className="ssm-tag ssm-tag--available">
										Available
									</span>
									<ul className="ssm-chip-list">
										{selectedSeats.map((seat) => (
											<li key={seat.id}>{seat.id}</li>
										))}
									</ul>
									<p className="ssm-hint">
										Blocked seats can't be booked by
										customers. Click more open seats to
										block them together.
									</p>

									<div className="ssm-actions">
										<button
											type="button"
											className="ssm-btn ssm-btn--primary"
											onClick={handleBlock}
										>
											Block{" "}
											{plural(
												selectedSeats.length,
												"seat",
											)}
										</button>
										<button
											type="button"
											className="ssm-btn ssm-btn--ghost"
											onClick={resetSelection}
										>
											Clear selection
										</button>
									</div>
								</>
							)}

							{selectionStatus === "blocked" && (
								<>
									<span className="ssm-tag ssm-tag--blocked">
										Blocked
									</span>
									<ul className="ssm-chip-list">
										{selectedSeats.map((seat) => (
											<li key={seat.id}>{seat.id}</li>
										))}
									</ul>
									<p className="ssm-hint">
										Release these seats to let customers
										book them again.
									</p>

									<div className="ssm-actions">
										<button
											type="button"
											className="ssm-btn ssm-btn--outline"
											onClick={handleRelease}
										>
											Release{" "}
											{plural(
												selectedSeats.length,
												"seat",
											)}
										</button>
										<button
											type="button"
											className="ssm-btn ssm-btn--ghost"
											onClick={resetSelection}
										>
											Clear selection
										</button>
									</div>
								</>
							)}
						</div>
					</aside>
				</div>
			</div>

			{confirmingCancel && booking && (
				<CancelBookingModal
					booking={booking}
					onKeep={() => setConfirmingCancel(false)}
					onConfirm={handleCancelBooking}
				/>
			)}
		</div>
	);
}

export default SeatSelectionManagement;

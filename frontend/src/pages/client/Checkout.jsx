// Route: "/checkout"
// Reached from SeatSelection, which passes the held seats and the hold expiry in route state.
// Next page: "/tickets/:bookedId" (after a successful booking).
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import IdPhotoCard from "../../components/IdPhotoCard.jsx";
import heroBg from "../../assets/images/hero-bg.png";
import { placeholderPoster as moviePoster } from "../../api/movies.js";
import { getUser } from "../../api/session.js";
import {
	BOOKING_ERRORS,
	createBooking,
	fetchInvoiceStatus,
	fetchSnacks,
	NEEDS_NEW_SEATS,
	PAYMENT_METHODS,
} from "../../api/bookings.js";
import "../../styles/Checkout.css";

/* ---------------------------------------------------------------- */
/* Icons                                                            */
/* ---------------------------------------------------------------- */

// Shared SVG wrapper. Pass size to change width and height.
const Icon = ({ children, size = 16, ...props }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
		{...props}
	>
		{children}
	</svg>
);
const IconMapPin = (p) => (
	<Icon {...p}>
		<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
		<circle cx="12" cy="10" r="3" />
	</Icon>
);
const IconMonitor = (p) => (
	<Icon {...p}>
		<rect x="2" y="4" width="20" height="14" rx="2" />
		<path d="M8 21h8M12 17v4" />
	</Icon>
);
const IconCalendar = (p) => (
	<Icon {...p}>
		<rect x="3" y="4" width="18" height="18" rx="2" />
		<path d="M16 2v4M8 2v4M3 10h18" />
	</Icon>
);
const IconClock = (p) => (
	<Icon {...p}>
		<circle cx="12" cy="12" r="9" />
		<path d="M12 7v5l3 3" />
	</Icon>
);
const IconMail = (p) => (
	<Icon {...p}>
		<rect x="2" y="4" width="20" height="16" rx="2" />
		<path d="m22 6-10 7L2 6" />
	</Icon>
);
const IconWarning = (p) => (
	<Icon {...p}>
		<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
		<path d="M12 9v4M12 17h.01" />
	</Icon>
);
const IconLock = (p) => (
	<Icon {...p}>
		<rect x="3" y="11" width="18" height="11" rx="2" />
		<path d="M7 11V7a5 5 0 0 1 10 0v4" />
	</Icon>
);
const IconShield = (p) => (
	<Icon {...p}>
		<path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4Z" />
	</Icon>
);
const IconChevronDown = (p) => (
	<Icon size={14} {...p}>
		<path d="m6 9 6 6 6-6" />
	</Icon>
);
const IconCheckCircle = (p) => (
	<Icon size={40} strokeWidth="1.8" {...p}>
		<circle cx="12" cy="12" r="10" />
		<path d="m8 12.5 3 3 5-6" />
	</Icon>
);
const IconInfo = (p) => (
	<Icon {...p}>
		<circle cx="12" cy="12" r="10" />
		<path d="M12 16v-5M12 8h.01" />
	</Icon>
);

/* ---------------------------------------------------------------- */
/* Constants                                                        */
/* ---------------------------------------------------------------- */

const DISCOUNT_RATE = 0.2; // PWD + Senior Citizen
const BOOKING_FEE_PER_TICKET = 30; // ₱30 per ticket, never discounted (waived on a free ticket)

const TICKET_TYPES = {
	regular: { label: "Regular", discounted: false },
	senior: { label: "Senior Citizen", discounted: true },
	pwd: { label: "PWD", discounted: true },
};

const HOLD_SECONDS = 10 * 60; // used only when the page has no real hold expiry
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
// The booking API takes ID photos as JPG / PNG / WebP (not PDF), up to 5 MB each.
const ID_FILE_PATTERN = /\.(jpe?g|png|webp)$/i;

// Used only when the page is opened without booking state (direct URL / refresh).
const FALLBACK_BOOKING = {
	movieId: "1",
	movieTitle: "How To Train Your Dragon",
	genres: ["Adventure", "Fantasy", "Family"],
	rating: "PG",
	poster: null,
	branch: { name: "Vista Mall Taguig" },
	date: new Date(2026, 5, 14),
	showtime: {
		time: "7:30 PM",
		hall: "Cinema 4",
		format: "Digital 2D",
		price: 350,
	},
	seats: ["H7", "H8"],
};

/* ---------------------------------------------------------------- */
/* Helpers                                                          */
/* ---------------------------------------------------------------- */

/**
 * Picks an emoji for a snack from its name.
 * TODO: replace with a real concessions API once the backend has one.
 * The menu comes from GET /api/snacks, which only stores a name and a price.
 */
function snackIcon(name) {
	const n = name.toLowerCase();
	if (n.includes("popcorn")) return "🍿";
	if (/soda|cola|drink|juice|water|tea|coffee/.test(n)) return "🥤";
	if (n.includes("nacho")) return "🧀";
	if (/combo|meal/.test(n)) return "🎬";
	return "🍽️";
}

/** Formats a number as pesos, e.g. 1500 -> "₱1,500". */
const peso = (n) => `₱${Number(n).toLocaleString("en-PH")}`;

/** Formats a date like "Sat, Jun 14, 2026". */
const formatDate = (value) =>
	new Date(value).toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
	});

/** Formats seconds as "MM:SS". */
const formatTimer = (secs) =>
	`${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;

/* ---------------------------------------------------------------- */
/* Small components                                                 */
/* ---------------------------------------------------------------- */

/** Header of a checkout card. Pass `step` to show a step number. */
function CardHeader({ step, title, subtitle }) {
	return (
		<div className="co-card-header">
			{step && <span className="co-step-number">{step}</span>}
			<div>
				<p className="co-card-title">{title}</p>
				<p className="co-card-subtitle">{subtitle}</p>
			</div>
		</div>
	);
}

/** One label/value row in the confirm pop-up. `note` is small text under the label. */
function ConfirmRow({ label, value, note }) {
	return (
		<div className="co-confirm-row">
			<span>
				{label}
				{note && <small>{note}</small>}
			</span>
			<strong>{value}</strong>
		</div>
	);
}

/**
 * Last check before paying. Tickets can't be cancelled, so the user reviews
 * everything here and either goes back to edit or confirms the payment.
 */
function ConfirmModal({
	movieTitle,
	branch,
	showtime,
	date,
	seatLines,
	foodItems,
	email,
	paymentName,
	discountTotal,
	bookingFee,
	total,
	secondsLeft,
	submitting,
	onEdit,
	onConfirm,
}) {
	// Escape goes back to editing (not while the payment is being sent).
	useEffect(() => {
		const onKeyDown = (e) => {
			if (e.key === "Escape" && !submitting) onEdit();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [onEdit, submitting]);

	return (
		<div
			className="co-modal-overlay"
			role="dialog"
			aria-modal="true"
			aria-labelledby="co-confirm-title"
		>
			<div className="co-modal co-modal--confirm">
				<h2 className="co-modal-title" id="co-confirm-title">
					Confirm your booking
				</h2>

				<p className="co-confirm-warning">
					<IconWarning />
					<span>
						Please check everything. Tickets can't be cancelled or
						changed after you pay.
					</span>
				</p>
				<p className="co-confirm-hold">
					Your seats are held for {formatTimer(secondsLeft)}
				</p>

				<div className="co-confirm-body">
					<section className="co-confirm-section">
						<p className="co-confirm-movie">{movieTitle}</p>
						<ConfirmRow label="Branch" value={branch.name} />
						<ConfirmRow label="Cinema" value={showtime.hall} />
						<ConfirmRow label="Date" value={formatDate(date)} />
						<ConfirmRow label="Time" value={showtime.time} />
					</section>

					<section className="co-confirm-section">
						<p className="co-confirm-heading">
							Tickets · {seatLines.length}
						</p>
						{seatLines.map(
							({
								seat,
								typeLabel,
								discounted,
								free,
								price,
								holderName,
							}) => (
								<ConfirmRow
									key={seat}
									label={`Seat ${seat} · ${typeLabel}${free ? " (FREE · Taguig senior)" : discounted ? " (−20%)" : ""}`}
									note={
										holderName
											? `Name on ID: ${holderName}`
											: undefined
									}
									value={peso(price)}
								/>
							),
						)}
					</section>

					{foodItems.length > 0 && (
						<section className="co-confirm-section">
							<p className="co-confirm-heading">
								Food &amp; Snacks
							</p>
							{foodItems.map((f) => (
								<ConfirmRow
									key={f.id}
									label={`${f.name} ×${f.qty}`}
									value={peso(f.price * f.qty)}
								/>
							))}
						</section>
					)}

					<section className="co-confirm-section">
						<p className="co-confirm-heading">
							Contact &amp; Payment
						</p>
						<ConfirmRow label="Email" value={email.trim()} />
						<ConfirmRow
							label="Payment"
							value={paymentName || "No payment needed"}
						/>
					</section>

					<section className="co-confirm-section">
						{discountTotal > 0 && (
							<ConfirmRow
								label="Discounts"
								value={`-${peso(discountTotal)}`}
							/>
						)}
						<ConfirmRow
							label="Booking fee"
							value={peso(bookingFee)}
						/>
						<ConfirmRow label="Total" value={peso(total)} />
					</section>
				</div>

				<div className="co-confirm-actions">
					<button
						type="button"
						className="co-modal-btn co-modal-btn--ghost"
						onClick={onEdit}
						disabled={submitting}
					>
						Edit booking
					</button>
					<button
						type="button"
						className="co-modal-btn"
						onClick={onConfirm}
						disabled={submitting}
					>
						{submitting
							? "Processing…"
							: `Confirm & Pay ${peso(total)}`}
					</button>
				</div>
			</div>
		</div>
	);
}

/** Xendit: the customer pays on Xendit's page in a new tab while this waits. */
function AwaitingPaymentModal({ invoiceUrl, onCancel }) {
	return (
		<div
			className="co-modal-overlay"
			role="dialog"
			aria-modal="true"
			aria-labelledby="co-pay-title"
		>
			<div className="co-modal">
				<h2 className="co-modal-title" id="co-pay-title">
					Complete your payment
				</h2>
				<p className="co-modal-text" aria-live="polite">
					Pay on Xendit's secure page. This window updates by itself
					once the payment goes through. Test mode: use the "Simulate
					payment" option on that page.
				</p>
				<div className="co-confirm-actions">
					<button
						type="button"
						className="co-modal-btn co-modal-btn--ghost"
						onClick={onCancel}
					>
						Cancel
					</button>
					<a
						className="co-modal-btn"
						href={invoiceUrl}
						target="_blank"
						rel="noopener noreferrer"
					>
						Open payment page
					</a>
				</div>
			</div>
		</div>
	);
}

/** Shown after the booking succeeds. */
function PaymentSuccessModal({ onViewTicket }) {
	return (
		<div
			className="co-modal-overlay"
			role="dialog"
			aria-modal="true"
			aria-labelledby="co-modal-title"
		>
			<div className="co-modal">
				<div className="co-modal-head">
					<span className="co-modal-icon">
						<IconCheckCircle />
					</span>
					<h2 className="co-modal-title" id="co-modal-title">
						Payment Successful
					</h2>
				</div>
				<p className="co-modal-text">
					Booking confirmed — please check your email for your ticket
					details.
				</p>
				<button
					type="button"
					className="co-modal-btn"
					onClick={onViewTicket}
				>
					View My Ticket
				</button>
			</div>
		</div>
	);
}

/* ---------------------------------------------------------------- */
/* Page                                                             */
/* ---------------------------------------------------------------- */
function Checkout() {
	const navigate = useNavigate();
	const { state } = useLocation();

	// Booking details from the previous page, with fallbacks for direct visits.
	const booking = useMemo(() => {
		const s = state || {};
		return {
			movieId: s.movieId ?? FALLBACK_BOOKING.movieId,
			movieTitle: s.movieTitle ?? FALLBACK_BOOKING.movieTitle,
			genres: s.genres ?? FALLBACK_BOOKING.genres,
			rating: s.rating ?? FALLBACK_BOOKING.rating,
			poster: s.poster ?? null,
			branch: s.branch ?? FALLBACK_BOOKING.branch,
			date: s.date ?? FALLBACK_BOOKING.date,
			showtime: s.showtime ?? FALLBACK_BOOKING.showtime,
			seats: s.seats?.length ? s.seats : FALLBACK_BOOKING.seats,
			// Set by Seat Selection after the seats are held. Missing if the page was opened directly.
			showtimeId: s.showtimeId ?? null,
			seatIds: s.seatIds ?? null,
			holdExpiresAt: s.holdExpiresAt ?? null,
		};
	}, [state]);
	const {
		movieId,
		movieTitle,
		genres,
		rating,
		poster,
		branch,
		date,
		showtime,
		seats,
		showtimeId,
		seatIds,
		holdExpiresAt,
	} = booking;

	const user = getUser();
	// Booking needs a logged-in user and seats that were really held in Seat Selection.
	const canBook = Boolean(
		user && showtimeId && seatIds?.length === seats.length,
	);
	const basePrice = showtime.price;
	// Monday/Tuesday first screening: Taguig seniors get a free ticket and no booking fee.
	// This is only a flag from the showtime list. The server decides the real price.
	const seniorPromo = Boolean(showtime.seniorFreeTicket);

	/* ---- state: contact ---- */
	const [email, setEmail] = useState("");
	const [mobile, setMobile] = useState("");
	const [emailTouched, setEmailTouched] = useState(false);

	/* ---- state: tickets and ID details (keyed by seat label, e.g. "A1") ---- */
	const [ticketTypes, setTicketTypes] = useState(() =>
		Object.fromEntries(seats.map((seat) => [seat, "regular"])),
	);
	const [idFiles, setIdFiles] = useState({}); // { A1: File } (uploaded or taken with the camera)
	const [idErrors, setIdErrors] = useState({}); // { A1: "message" }
	const [idHolders, setIdHolders] = useState({}); // { A1: { name, number } }
	const [taguigSeats, setTaguigSeats] = useState({}); // { A1: true } senior says they live in Taguig City

	/* ---- state: food ---- */
	const [food, setFood] = useState([]); // [{ id, icon, name, price, qty }]
	const [foodState, setFoodState] = useState("loading"); // loading | ready | error
	const [foodReload, setFoodReload] = useState(0); // change it to reload the menu

	/* ---- state: payment and checkout flow ---- */
	const [paymentMethod, setPaymentMethod] = useState("");
	const [confirmOpen, setConfirmOpen] = useState(false); // "Confirm your booking" pop-up
	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState(null); // { message, needsNewSeats }
	const [paid, setPaid] = useState(false);
	const [bookedId, setBookedId] = useState(null);
	const [invoice, setInvoice] = useState(null); // Xendit { id, url } while waiting for payment
	// Count down from the hold's real expiry (set by Seat Selection), not a fresh 10 minutes.
	const [secondsLeft, setSecondsLeft] = useState(() =>
		holdExpiresAt
			? Math.max(0, Math.round((holdExpiresAt - Date.now()) / 1000))
			: HOLD_SECONDS,
	);

	/** Goes back to Seat Selection and keeps the current seats and showtime. */
	const goToSeats = () =>
		navigate(`/booking/${movieId}/seats`, {
			state: {
				movieId,
				movieTitle,
				branch,
				date,
				showtime,
				ticketCount: seats.length,
				seats,
			},
		});

	/* ---- seat-hold countdown (stops once paid) ---- */
	useEffect(() => {
		if (paid) return undefined;
		const id = setInterval(
			() => setSecondsLeft((s) => Math.max(0, s - 1)),
			1000,
		);
		return () => clearInterval(id);
	}, [paid]);

	// When the hold runs out, send the user back to pick seats again.
	useEffect(() => {
		if (secondsLeft === 0 && !paid) {
			alert(
				"Your seat hold has expired. Please select your seats again.",
			);
			goToSeats();
		}
	}, [secondsLeft, paid]);

	// Load the food menu. Food is optional, so a failure here never blocks booking.
	useEffect(() => {
		const controller = new AbortController();
		fetchSnacks({ signal: controller.signal })
			.then((snacks) => {
				setFood(
					snacks.map((x) => ({
						id: x.id,
						icon: snackIcon(x.name),
						name: x.name,
						price: x.price,
						qty: 0,
					})),
				);
				setFoodState("ready");
			})
			.catch((err) => {
				if (err.name !== "AbortError") setFoodState("error");
			});
		return () => controller.abort();
	}, [foodReload]);

	/* ---- prices and totals ---- */

	/** Price of one ticket of the given type (20% off for discounted types). */
	const priceFor = (type) =>
		TICKET_TYPES[type].discounted
			? Math.round(basePrice * (1 - DISCOUNT_RATE))
			: basePrice;

	/** True when this seat is a Taguig senior ticket on the free-ticket screening. */
	const isFreeSeat = (seat) =>
		seniorPromo &&
		ticketTypes[seat] === "senior" &&
		Boolean(taguigSeats[seat]);

	/** Price of one seat: free for a Taguig senior on the promo, otherwise by type. */
	const priceForSeat = (seat) =>
		isFreeSeat(seat) ? 0 : priceFor(ticketTypes[seat]);

	const discountedSeats = seats.filter(
		(s) => TICKET_TYPES[ticketTypes[s]].discounted,
	);
	const hasDiscountedTicket = discountedSeats.length > 0;

	// Tickets grouped for the sidebar, e.g. [{ type: "regular", free: false, count: 2 }].
	// Free Taguig senior tickets are their own group so they show ₱0 next to paid seniors.
	const ticketSummary = useMemo(() => {
		const groups = {};
		seats.forEach((seat) => {
			const type = ticketTypes[seat];
			const free =
				seniorPromo && type === "senior" && Boolean(taguigSeats[seat]);
			const key = free ? "senior-free" : type;
			groups[key] = groups[key] || { type, free, count: 0 };
			groups[key].count += 1;
		});
		return Object.values(groups);
	}, [seats, ticketTypes, taguigSeats, seniorPromo]);

	const foodItems = food.filter((f) => f.qty > 0);
	const foodTotal = foodItems.reduce((sum, f) => sum + f.price * f.qty, 0);
	const ticketsTotal = seats.reduce((sum, s) => sum + priceForSeat(s), 0);
	const fullPriceTotal = seats.length * basePrice;
	const discountTotal = fullPriceTotal - ticketsTotal;
	const subtotal = fullPriceTotal + foodTotal; // tickets at full price + food, before discounts
	// Not discounted, but a free ticket has no booking fee.
	const bookingFee =
		seats.filter((s) => !isFreeSeat(s)).length * BOOKING_FEE_PER_TICKET;
	const total = subtotal - discountTotal + bookingFee;

	/* ---- validation ---- */
	const emailValid = EMAIL_REGEX.test(email.trim());
	// Every discounted seat needs its own ID photo, holder name and ID number.
	// A photo taken with the camera counts too, because it is saved into idFiles.
	const idOk = discountedSeats.every(
		(seat) =>
			Boolean(idFiles[seat]) &&
			Boolean(idHolders[seat]?.name?.trim()) &&
			Boolean(idHolders[seat]?.number?.trim()),
	);
	const canPay =
		emailValid &&
		idOk &&
		(Boolean(paymentMethod) || total === 0) &&
		seats.length > 0 &&
		canBook &&
		!paid &&
		!submitting;

	// One line per seat for the confirm pop-up.
	const seatLines = seats.map((seat) => {
		const type = ticketTypes[seat];
		return {
			seat,
			typeLabel: TICKET_TYPES[type].label,
			discounted: TICKET_TYPES[type].discounted,
			free: isFreeSeat(seat),
			price: priceForSeat(seat),
			holderName: idHolders[seat]?.name?.trim(),
		};
	});
	const paymentName =
		PAYMENT_METHODS.find((m) => m.id === paymentMethod)?.name ?? "";

	/* ---- handlers ---- */

	/** Returns an updater that removes one seat's entry from a { seat: value } state object. */
	const dropSeat = (seat) => (prev) => {
		const next = { ...prev };
		delete next[seat];
		return next;
	};

	/** Clears all ID details for one seat. */
	const clearSeatId = (seat) => {
		setIdFiles(dropSeat(seat));
		setIdErrors(dropSeat(seat));
		setIdHolders(dropSeat(seat));
		setTaguigSeats(dropSeat(seat));
	};

	/** Changes a seat's ticket type. Going back to Regular removes its ID details. */
	const handleTicketType = (seat) => (e) => {
		const type = e.target.value;
		setTicketTypes((prev) => ({ ...prev, [seat]: type }));
		if (!TICKET_TYPES[type].discounted) clearSeatId(seat);
	};

	/** Ticks or unticks "I live in Taguig City" for a senior seat. */
	const handleTaguig = (seat) => (e) =>
		setTaguigSeats((prev) => ({ ...prev, [seat]: e.target.checked }));

	/** Saves the ID holder's name or number for a seat. */
	const handleHolderChange = (seat, field) => (e) => {
		const value = e.target.value;
		setIdHolders((prev) => ({
			...prev,
			[seat]: { name: "", number: "", ...prev[seat], [field]: value },
		}));
	};

	/** Reloads the food menu after a failed load. */
	const retryFood = () => {
		setFoodState("loading");
		setFoodReload((n) => n + 1);
	};

	/** Changes a snack's quantity by `delta` (kept between 0 and 10). */
	const changeQty = (id, delta) =>
		setFood((prev) =>
			prev.map((f) =>
				f.id === id
					? { ...f, qty: Math.max(0, Math.min(10, f.qty + delta)) }
					: f,
			),
		);

	const setSeatError = (seat, message) =>
		setIdErrors((prev) => ({ ...prev, [seat]: message }));

	/**
	 * Checks an ID photo (type and size) and saves it for a seat.
	 * Used for both uploaded files and photos taken with the camera.
	 */
	const handleFile = (seat, file) => {
		if (!file) return;
		if (!ID_FILE_PATTERN.test(file.name)) {
			setSeatError(seat, "Only JPG, PNG or WebP images are allowed.");
			return;
		}
		if (file.size > MAX_FILE_SIZE) {
			setSeatError(seat, "File is too large. Max 5 MB.");
			return;
		}
		setSeatError(seat, "");
		setIdFiles((prev) => ({ ...prev, [seat]: file }));
	};

	/** Removes a seat's saved ID photo (the name and number stay). */
	const removeSeatPhoto = (seat) => {
		setIdFiles(dropSeat(seat));
		setSeatError(seat, "");
	};

	/** Opens the confirm pop-up (the real payment happens in handlePay). */
	const handleReview = () => {
		if (canPay) setConfirmOpen(true);
	};

	/**
	 * Sends the booking to the server. Called from the confirm pop-up, and again with
	 * paymentRef (the Xendit invoice id) once that invoice is paid.
	 */
	const handlePay = async (paymentRef) => {
		if (!canPay) return;
		setSubmitting(true);
		setSubmitError(null);

		// seats[] (labels like "A1") and seatIds[] (database ids) are in the same order.
		const typesBySeatId = Object.fromEntries(
			seats.map((label, i) => [seatIds[i], ticketTypes[label]]),
		);
		// One ID photo for every discounted seat, keyed by the seat's database id.
		const idImages = Object.fromEntries(
			discountedSeats.map((label) => [
				seatIds[seats.indexOf(label)],
				idFiles[label],
			]),
		);
		try {
			// The server prices the booking itself (discount + booking fee) and checks the
			// hold and that every discounted seat has its own ID photo.
			const booked = await createBooking({
				userId: user.userId,
				showtimeId,
				seatIds,
				ticketTypes: typesBySeatId,
				paymentMethod: paymentMethod || "free", // nothing to pay on a free booking
				contactEmail: email.trim(),
				taguigSeatIds: seats
					.filter(isFreeSeat)
					.map((label) => seatIds[seats.indexOf(label)]),
				snacks: foodItems.map((f) => ({
					snackId: f.id,
					quantity: f.qty,
				})),
				idImages,
				paymentRef,
			});
			setInvoice(null);
			setBookedId(booked.id);
			setPaid(true); // shows the "Payment Successful" pop-up
		} catch (error) {
			setInvoice(null);
			// Xendit: seats stay held; pay the invoice, then the effect below retries.
			if (error.data?.code === BOOKING_ERRORS.PAYMENT_REQUIRED) {
				setInvoice(error.data.invoice);
				return;
			}
			setSubmitError({
				message: error.message,
				needsNewSeats: NEEDS_NEW_SEATS.includes(error.data?.code),
			});
		} finally {
			setSubmitting(false);
			setConfirmOpen(false); // on an error, this shows the message in the sidebar
		}
	};

	// Xendit: check the invoice every 3 s; once paid, send the booking again with its id.
	useEffect(() => {
		if (!invoice) return undefined;
		const controller = new AbortController();
		const id = setInterval(async () => {
			try {
				const status = await fetchInvoiceStatus(invoice.id, {
					signal: controller.signal,
				});
				if (status === "PAID" || status === "SETTLED") {
					clearInterval(id);
					handlePay(invoice.id);
				} else if (status === "EXPIRED") {
					clearInterval(id);
					setInvoice(null);
					setSubmitError({
						message: "The payment page expired. Please try again.",
						needsNewSeats: false,
					});
				}
			} catch {
				// network blip or aborted: try again on the next tick
			}
		}, 3000);
		return () => {
			clearInterval(id);
			controller.abort();
		};
	}, [invoice]); // eslint-disable-line react-hooks/exhaustive-deps

	return (
		<div className="checkout-page">
			<div
				className="checkout-bg"
				style={{ backgroundImage: `url(${heroBg})` }}
			></div>

			<section className="checkout-hero">
				<Navbar />

				<div className="checkout-header">
					<div className="checkout-heading-block">
						<h1 className="checkout-heading">Checkout</h1>
						<p className="checkout-subtext">
							Review your booking, choose ticket types, and
							complete your payment securely.
						</p>
					</div>
					<button
						type="button"
						className="co-btn-back"
						onClick={goToSeats}
					>
						← Back
					</button>
				</div>

				<div className="checkout-layout">
					{/* ============ LEFT COLUMN ============ */}
					<div className="checkout-main">
						{/* Contact */}
						<div className="co-card">
							<CardHeader
								title="Contact Details"
								subtitle="Your e-ticket with QR code & booking confirmation are sent here"
							/>
							<div className="co-card-body">
								<div className="co-form-row">
									<div className="co-field">
										<label
											className="co-label"
											htmlFor="co-email"
										>
											Email Address{" "}
											<span className="co-required">
												*
											</span>
										</label>
										<input
											id="co-email"
											type="email"
											className={
												"co-input" +
												(emailTouched && !emailValid
													? " invalid"
													: "")
											}
											placeholder="you@example.com"
											autoComplete="email"
											value={email}
											onChange={(e) =>
												setEmail(e.target.value)
											}
											onBlur={() => setEmailTouched(true)}
										/>
										{emailTouched && !emailValid && (
											<p className="co-error">
												Enter a valid email address.
											</p>
										)}
									</div>
									<div className="co-field">
										<label
											className="co-label"
											htmlFor="co-mobile"
										>
											Mobile Number{" "}
											<span className="co-hint">
												(optional — SMS reminder)
											</span>
										</label>
										<input
											id="co-mobile"
											type="tel"
											className="co-input"
											placeholder="09XXXXXXXXX"
											autoComplete="tel"
											value={mobile}
											onChange={(e) =>
												setMobile(
													e.target.value.replace(
														/[^\d+\s]/g,
														"",
													),
												)
											}
										/>
									</div>
								</div>
								<div className="co-note co-note--green">
									<IconMail />
									<span>
										We'll email your QR-coded ticket the
										moment payment is confirmed. Present it
										at the cinema entrance — no printing
										needed.
									</span>
								</div>
							</div>
						</div>

						{/* 1. Ticket types */}
						<div className="co-card">
							<CardHeader
								step="1"
								title="Ticket Types & Discounts"
								subtitle="Assign a customer type to each seat — discounts apply automatically"
							/>
							<div className="co-card-body">
								{seats.map((seat) => {
									const type = ticketTypes[seat];
									const discounted =
										TICKET_TYPES[type].discounted;
									const row = seat.charAt(0);
									const holder = idHolders[seat] || {
										name: "",
										number: "",
									};
									return (
										<div className="co-ticket" key={seat}>
											{/* Ticket row: seat, price, ticket type */}
											<div className="co-seat-row">
												<div className="co-seat-badge">
													<span className="co-seat-badge-code">
														{seat}
													</span>
													<span className="co-seat-badge-label">
														SEAT
													</span>
												</div>
												<div className="co-seat-info">
													<span className="co-seat-name">
														Seat {seat} · Row {row}
													</span>
													<span
														className={
															"co-seat-sub" +
															(discounted
																? " discounted"
																: "")
														}
													>
														{isFreeSeat(seat) ? (
															<>
																<strong>
																	FREE
																</strong>{" "}
																· Taguig senior
																· ID checked at
																the counter
															</>
														) : discounted ? (
															<>
																<strong>
																	20% off
																</strong>{" "}
																·{" "}
																{peso(
																	priceFor(
																		type,
																	),
																)}{" "}
																· ID required
															</>
														) : (
															peso(basePrice)
														)}
													</span>
												</div>
												<div className="co-select-wrap">
													<select
														className="co-select"
														value={type}
														onChange={handleTicketType(
															seat,
														)}
														aria-label={`Ticket type for seat ${seat}`}
													>
														{Object.entries(
															TICKET_TYPES,
														).map(([key, t]) => (
															<option
																key={key}
																value={key}
															>
																{t.label} —{" "}
																{peso(
																	priceFor(
																		key,
																	),
																)}
															</option>
														))}
													</select>
													<IconChevronDown className="co-select-caret" />
												</div>
											</div>

											{/* ID check for this ticket only */}
											{discounted && (
												<div className="co-id-panel">
													<p className="co-id-title">
														<IconWarning /> ID
														Verification Required ·
														Seat {seat}
													</p>
													<p className="co-id-text">
														Provide a valid
														government- or
														institution-issued{" "}
														{
															TICKET_TYPES[type]
																.label
														}{" "}
														ID. The ID holder must
														be the person using this
														ticket.
													</p>

													<div className="co-id-fields">
														<div className="co-field">
															<label
																className="co-label"
																htmlFor={`co-id-name-${seat}`}
															>
																Name on ID{" "}
																<span className="co-required">
																	*
																</span>
															</label>
															<input
																id={`co-id-name-${seat}`}
																type="text"
																className="co-input"
																placeholder="Juan Dela Cruz"
																autoComplete="off"
																value={
																	holder.name
																}
																onChange={handleHolderChange(
																	seat,
																	"name",
																)}
															/>
														</div>
														<div className="co-field">
															<label
																className="co-label"
																htmlFor={`co-id-number-${seat}`}
															>
																ID Number{" "}
																<span className="co-required">
																	*
																</span>
															</label>
															<input
																id={`co-id-number-${seat}`}
																type="text"
																className="co-input"
																placeholder="Number on your ID"
																autoComplete="off"
																value={
																	holder.number
																}
																onChange={handleHolderChange(
																	seat,
																	"number",
																)}
															/>
														</div>
													</div>

													{seniorPromo &&
														type === "senior" && (
															<label className="co-taguig">
																<input
																	type="checkbox"
																	checked={Boolean(
																		taguigSeats[
																			seat
																		],
																	)}
																	onChange={handleTaguig(
																		seat,
																	)}
																/>
																<span>
																	<strong>
																		I live
																		in
																		Taguig
																		City.
																	</strong>{" "}
																	Taguig
																	seniors
																	watch free
																	(no booking
																	fee) on this
																	screening.
																	Without this
																	you get the
																	regular 20%
																	senior
																	discount.
																</span>
															</label>
														)}

													{/* Upload File / Take Photo */}
													<IdPhotoCard
														seat={seat}
														file={idFiles[seat]}
														error={idErrors[seat]}
														onFile={(f) =>
															handleFile(seat, f)
														}
														onRemove={() =>
															removeSeatPhoto(
																seat,
															)
														}
													/>
												</div>
											)}
										</div>
									);
								})}

								{hasDiscountedTicket && (
									<div className="co-note co-note--info">
										<IconInfo />
										<span>
											<strong>
												ID check at the cinema.
											</strong>{" "}
											Discounted tickets are verified at
											the entrance. If the ID doesn't
											match the ticket holder, the
											difference is payable at the
											counter.
											{seats.some(isFreeSeat) &&
												" Free tickets need a valid Senior Citizen ID with a Taguig City address."}
										</span>
									</div>
								)}
							</div>
						</div>

						{/* 2. Food */}
						<div className="co-card">
							<CardHeader
								step="2"
								title="Food & Snacks"
								subtitle="Add concessions to your order — picked up at the counter"
							/>
							<div className="co-card-body">
								{foodState === "loading" && (
									<p className="co-food-status">
										Loading the menu…
									</p>
								)}
								{foodState === "error" && (
									<p className="co-food-status" role="alert">
										We couldn't load the food menu.{" "}
										<button
											type="button"
											className="co-link-btn"
											onClick={retryFood}
										>
											Try again
										</button>
									</p>
								)}
								{food.map((item) => (
									<div className="co-food-row" key={item.id}>
										<span className="co-food-icon">
											{item.icon}
										</span>
										<div className="co-food-info">
											<span className="co-food-name">
												{item.name}
											</span>
											<span className="co-food-desc">
												{peso(item.price)}
											</span>
										</div>
										<div className="co-qty">
											<button
												type="button"
												onClick={() =>
													changeQty(item.id, -1)
												}
												disabled={item.qty === 0}
												aria-label={`Remove one ${item.name}`}
											>
												−
											</button>
											<span>{item.qty}</span>
											<button
												type="button"
												onClick={() =>
													changeQty(item.id, 1)
												}
												disabled={item.qty >= 10}
												aria-label={`Add one ${item.name}`}
											>
												+
											</button>
										</div>
									</div>
								))}
							</div>
						</div>

						{/* 3. Payment */}
						<div className="co-card">
							<CardHeader
								step="3"
								title="Payment Method"
								subtitle="Protected payment · encrypted and secure"
							/>
							<div className="co-card-body co-pay-grid">
								{PAYMENT_METHODS.map((m) => (
									<button
										type="button"
										key={m.id}
										className={
											"co-pay-option" +
											(paymentMethod === m.id
												? " selected"
												: "")
										}
										onClick={() => setPaymentMethod(m.id)}
										aria-pressed={paymentMethod === m.id}
									>
										<span
											className="co-pay-logo"
											style={{ background: m.color }}
										>
											{m.logo}
										</span>
										<span className="co-pay-text">
											<span className="co-pay-name">
												{m.name}
											</span>
											<span className="co-pay-desc">
												{m.desc}
											</span>
										</span>
										<span className="co-radio" />
									</button>
								))}
							</div>
						</div>
					</div>

					{/* ============ RIGHT COLUMN ============ */}
					<aside className="checkout-sidebar">
						<div className="co-card">
							<div className="co-summary-movie">
								<img
									src={poster || moviePoster}
									alt={`${movieTitle} poster`}
									className="co-summary-poster"
									onError={(e) => {
										e.currentTarget.onerror = null; // stop a loop if the fallback fails too
										e.currentTarget.src = moviePoster;
									}}
								/>
								<div>
									<h2 className="co-summary-title">
										{movieTitle}
									</h2>
									<div className="co-summary-genres">
										{genres.map((g) => (
											<span
												className="co-summary-genre"
												key={g}
											>
												{g}
											</span>
										))}
									</div>
									{rating && (
										<p className="co-summary-rating">
											<span className="co-rating-badge">
												{rating}
											</span>{" "}
											MTRCB Rated
										</p>
									)}
								</div>
							</div>

							<div className="co-summary-section">
								<p className="co-eyebrow">Showtime</p>
								<div className="co-kv">
									<span>
										<IconMapPin /> Branch
									</span>
									<strong>{branch.name}</strong>
								</div>
								<div className="co-kv">
									<span>
										<IconMonitor /> Cinema
									</span>
									<strong>{showtime.hall}</strong>
								</div>
								<div className="co-kv">
									<span>
										<IconCalendar /> Date
									</span>
									<strong>{formatDate(date)}</strong>
								</div>
								<div className="co-kv">
									<span>
										<IconClock /> Time
									</span>
									<strong>{showtime.time}</strong>
								</div>
							</div>

							<div className="co-summary-section">
								<p className="co-eyebrow">
									Selected Seats · {seats.length}
								</p>
								<div className="co-chips">
									{seats.map((seat) => (
										<span className="co-chip" key={seat}>
											{seat}
										</span>
									))}
								</div>
							</div>

							<div className="co-summary-section">
								<p className="co-eyebrow">Tickets</p>
								{ticketSummary.map(({ type, free, count }) => {
									const t = TICKET_TYPES[type];
									const unitPrice = free ? 0 : priceFor(type);
									return (
										<div
											className="co-line"
											key={free ? "senior-free" : type}
										>
											<div>
												<p className="co-line-name">
													{t.label} ×{count}
													{t.discounted && (
														<span className="co-discount-badge">
															{free
																? "FREE"
																: "−20%"}
														</span>
													)}
												</p>
												<p className="co-line-sub">
													{peso(unitPrice)} each
													{free &&
														" · Taguig senior, no booking fee"}
												</p>
											</div>
											<p className="co-line-price">
												{t.discounted && (
													<span className="co-line-old">
														{peso(
															basePrice * count,
														)}
													</span>
												)}
												{peso(unitPrice * count)}
											</p>
										</div>
									);
								})}
							</div>

							{foodItems.length > 0 && (
								<div className="co-summary-section">
									<p className="co-eyebrow">
										Food &amp; Snacks
									</p>
									{foodItems.map((f) => (
										<div className="co-line" key={f.id}>
											<div>
												<p className="co-line-name">
													{f.name} ×{f.qty}
												</p>
												<p className="co-line-sub">
													{peso(f.price)} each
												</p>
											</div>
											<p className="co-line-price">
												{peso(f.price * f.qty)}
											</p>
										</div>
									))}
								</div>
							)}

							<div className="co-summary-section">
								<div className="co-total-row">
									<span>Subtotal</span>
									<strong>{peso(subtotal)}</strong>
								</div>
								<div className="co-total-row">
									<span>Discounts</span>
									<strong className="co-text-green">
										{discountTotal > 0
											? `-${peso(discountTotal)}`
											: peso(0)}
									</strong>
								</div>
								<div className="co-total-row">
									<span>Booking fee</span>
									<strong>{peso(bookingFee)}</strong>
								</div>
								<div className="co-grand">
									<div>
										<p className="co-grand-label">Total</p>
										<p className="co-grand-note">
											VAT included
										</p>
									</div>
									<p className="co-grand-amount">
										{peso(total)}
									</p>
								</div>

								{!canBook && (
									<div
										className="co-note co-note--warn"
										role="alert"
									>
										<IconWarning />
										<span>
											{user
												? "We lost track of your seats. Please start again from seat selection."
												: "Please log in, then choose your seats again to complete your booking."}
										</span>
									</div>
								)}
								{submitError && (
									<div
										className="co-note co-note--warn"
										role="alert"
									>
										<IconWarning />
										<span>
											{submitError.message}
											{submitError.needsNewSeats && (
												<>
													{" "}
													<button
														type="button"
														className="co-link-btn"
														onClick={goToSeats}
													>
														Choose seats again
													</button>
												</>
											)}
										</span>
									</div>
								)}

								<button
									type="button"
									className="co-btn-pay"
									disabled={!canPay}
									onClick={handleReview}
								>
									<IconLock />{" "}
									{submitting
										? "Processing…"
										: `Review & Pay ${peso(total)}`}
								</button>
								<p className="co-secure">
									<IconShield size={13} /> Your payment
									information is securely protected
								</p>
							</div>
						</div>

						<div className="co-hold">
							<span className="co-hold-dot" />
							<p className="co-hold-text">
								Your seats are held for
								<br />
								<strong>10 minutes</strong> — complete payment
								in time
							</p>
							<p className="co-hold-clock">
								{formatTimer(secondsLeft)}
							</p>
						</div>
					</aside>
				</div>
			</section>

			<Footer />

			{/* ============ CONFIRM BOOKING POP-UP ============ */}
			{confirmOpen && !paid && (
				<ConfirmModal
					movieTitle={movieTitle}
					branch={branch}
					showtime={showtime}
					date={date}
					seatLines={seatLines}
					foodItems={foodItems}
					email={email}
					paymentName={paymentName}
					discountTotal={discountTotal}
					bookingFee={bookingFee}
					total={total}
					secondsLeft={secondsLeft}
					submitting={submitting}
					onEdit={() => setConfirmOpen(false)}
					onConfirm={() => handlePay()}
				/>
			)}

			{/* ============ WAITING FOR XENDIT PAYMENT ============ */}
			{invoice && !paid && (
				<AwaitingPaymentModal
					invoiceUrl={invoice.url}
					onCancel={() => setInvoice(null)}
				/>
			)}

			{/* ============ PAYMENT SUCCESSFUL POP-UP ============ */}
			{paid && (
				<PaymentSuccessModal
					onViewTicket={() =>
						navigate(`/tickets/${bookedId}`, {
							state: { justBooked: true },
						})
					}
				/>
			)}
		</div>
	);
}

export default Checkout;

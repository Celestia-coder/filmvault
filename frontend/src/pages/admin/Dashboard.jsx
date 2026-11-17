// Dashboard.jsx — Admin dashboard
// Route: "/admin/dashboard"
//
// Real data, scoped to the logged-in admin's branch:
//   bookings -> GET /api/admin/bookings?branchId=
//   shows    -> GET /api/showtimes + GET /api/movies (this branch, status "scheduled")

import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { clearUser } from "../../api/session.js";
import { formatDate, formatTime } from "../../api/movies.js";
import { getAdminSession, fetchAdminBookings, fetchBranchShowtimes } from "../../api/admin.js";
import "../../styles/Dashboard.css";
import "../../styles/AdminLive.css";

import AdminSidebar from "../../components/AdminSidebar.jsx";
import headerGrid from "../../assets/images/dashboard/header-grid.svg";

import iconChart from "../../assets/images/dashboard/icon-chart.svg";
import iconMoney from "../../assets/images/dashboard/icon-money.svg";
import iconMonitor from "../../assets/images/dashboard/icon-monitor.svg";
import iconUsers from "../../assets/images/dashboard/icon-users.svg";

const peso = (amount) => `₱ ${Number(amount).toLocaleString("en-US")}`;

// shortcut: "Total Users" counts customers who booked at this branch, because
// there is no users-count endpoint; add GET /api/admin/stats if a true total is needed.
function buildDashboard(bookings, showtimes) {
	const confirmed = bookings.filter((booking) => booking.status === "Confirmed");

	// One card per movie, using its earliest scheduled showtime.
	const shows = [];
	const seen = new Set();
	showtimes
		.filter((showtime) => showtime.status === "scheduled")
		.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
		.forEach((showtime) => {
			if (seen.has(showtime.movieId)) return;
			seen.add(showtime.movieId);
			shows.push(showtime);
		});

	return {
		shows,
		stats: [
			{ label: "Total Bookings", value: bookings.length, icon: iconChart },
			{
				label: "Total Revenue",
				value: peso(confirmed.reduce((sum, booking) => sum + Number(booking.amount), 0)),
				icon: iconMoney,
			},
			{ label: "Active Shows", value: shows.length, icon: iconMonitor },
			{
				label: "Total Users",
				value: new Set(bookings.map((booking) => booking.customer.email)).size,
				icon: iconUsers,
			},
		],
	};
}

function Dashboard({ branchId }) {
	const [reloadKey, setReloadKey] = useState(0);
	const [result, setResult] = useState(null);
	const requestKey = `${branchId}:${reloadKey}`;

	useEffect(() => {
		const controller = new AbortController();
		Promise.all([
			fetchAdminBookings({ branchId }, controller.signal),
			fetchBranchShowtimes(branchId, controller.signal),
		])
			.then(([bookings, { showtimes }]) =>
				setResult({ key: requestKey, data: buildDashboard(bookings, showtimes) }),
			)
			.catch((error) => {
				if (error.name !== "AbortError") setResult({ key: requestKey, error });
			});
		return () => controller.abort();
	}, [branchId, requestKey]);

	const current = result?.key === requestKey ? result : null;

	return (
		<div className="admin-dashboard">
			<AdminSidebar />

			<div className="admin-main">
				<header className="admin-header">
					<h1 className="admin-title">
						<img src={headerGrid} alt="" />
						<span>
							Admin <em>Dashboard</em>
						</span>
					</h1>
					<Link to="/" className="admin-logout" onClick={clearUser}>
						Log Out
					</Link>
				</header>

				{!current && (
					<div className="adm-state" role="status">
						<span className="adm-spinner" aria-hidden="true" />
						<p className="adm-state-title">Loading dashboard…</p>
					</div>
				)}

				{current?.error && (
					<div className="adm-state adm-state--error" role="alert">
						<p className="adm-state-title">Couldn’t load the dashboard</p>
						<p className="adm-state-text">{current.error.message}</p>
						<button type="button" className="adm-btn" onClick={() => setReloadKey((key) => key + 1)}>
							Try again
						</button>
					</div>
				)}

				{current?.data && (
					<>
						<section className="admin-stats" aria-label="Overview">
							{current.data.stats.map((stat) => (
								<article className="stat-card" key={stat.label}>
									<div className="stat-text">
										<p className="stat-label">{stat.label}</p>
										<p className="stat-value">{stat.value}</p>
									</div>
									<img className="stat-icon" src={stat.icon} alt="" />
								</article>
							))}
						</section>

						<section className="active-shows">
							<h2>Active Shows</h2>
							{current.data.shows.length === 0 && <p>No scheduled shows for this branch.</p>}
							<div className="show-grid">
								{current.data.shows.map((show) => (
									<article className="show-card" key={show.movieId}>
										<img className="show-poster" src={show.poster} alt={`${show.movieTitle} poster`} />
										<div className="show-info">
											<h3>{show.movieTitle}</h3>
											<p className="show-price">{peso(show.price)}</p>
											<p className="show-schedule">
												{formatDate(show.date)} at {formatTime(show.time)}
											</p>
										</div>
									</article>
								))}
							</div>
						</section>
					</>
				)}
			</div>
		</div>
	);
}

// RequireAdmin already guards the route; this also hands the branch to the page.
export default function DashboardPage() {
	const admin = getAdminSession();
	return admin ? <Dashboard branchId={admin.branchId} /> : <Navigate to="/admin/login" replace />;
}

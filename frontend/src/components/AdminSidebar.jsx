import { Link, useLocation } from "react-router";
import "../styles/AdminSidebar.css";

import avatarUser from "../assets/images/dashboard/avatar-user.svg";
import { getAdminSession } from "../api/admin.js";

// Paste each branch's logo link here once you have it.
// Empty string = show the placeholder avatar.
const BRANCH_LOGOS = {
	"Market Market": "",
	Venice: "",
	Vista: "",
};

// Match these ids to the branches table in your database.
const BRANCH_NAMES = {
	1: "Vista Mall",
	2: "Market! Market!",
	3: "Venice McKinley",
};

const NAV_ITEMS = [
	{ label: "Dashboard", icon: "dashboard", to: "/admin/dashboard" },
	{ label: "Movie Management", icon: "movie", to: "/admin/movies" },
	{ label: "Schedule Management", icon: "schedule", to: "/admin/schedule" },
	{ label: "Seat Selection Management", icon: "seat", to: "/admin/seats" },
	{ label: "List of Bookings", icon: "bookings", to: "/admin/bookings" },
	{ label: "Ticket Verification", icon: "verify", to: "/admin/verify" },
];

function AdminSidebar() {
	const { pathname } = useLocation();

	const admin = getAdminSession();
	const branchName = admin?.branchName ?? BRANCH_NAMES[admin?.branchId] ?? "";
	const logo = BRANCH_LOGOS[branchName] || "";

	return (
		<aside className="admin-sidebar">
			<div className="admin-profile">
				<div className="admin-avatar">
					{logo ? (
						<img
							className="admin-avatar-logo"
							src={logo}
							alt={`${branchName} logo`}
						/>
					) : (
						<img src={avatarUser} alt="" />
					)}
				</div>
				{branchName && <p className="admin-branch">{branchName}</p>}
				<p className="admin-role">Admin</p>
			</div>

			<nav className="admin-nav" aria-label="Admin">
				{NAV_ITEMS.map((item) => {
					const isActive = pathname.startsWith(item.to);
					return (
						<Link
							key={item.label}
							to={item.to}
							className={`admin-nav-item${isActive ? " active" : ""}`}
						>
							<span
								className={`admin-nav-icon admin-nav-icon--${item.icon}`}
							/>
							<span>{item.label}</span>
						</Link>
					);
				})}
			</nav>
		</aside>
	);
}

export default AdminSidebar;

import { Link, useLocation } from "react-router";
import "../styles/AdminSidebar.css";

import avatarUser from "../assets/images/dashboard/avatar-user.svg";

// Central list of nav items. Add a real `to` path here as each page's
// branch gets merged — until then it renders as a non-clickable placeholder.
const NAV_ITEMS = [
	{ label: "Dashboard", icon: "dashboard", to: "/admin/dashboard" },
	{ label: "Movie Management", icon: "movie", to: "/admin/movies" },
	{ label: "Schedule Management", icon: "schedule", to: "/admin/schedule" },
	{ label: "Seat Selection Management", icon: "seat", to: "/admin/seats" },
	{ label: "List of Bookings", icon: "bookings", to: "/admin/bookings" },
];

function AdminSidebar() {
	// Active state is derived from the current URL, so any page using this
	// component gets correct highlighting automatically — no prop needed.
	const { pathname } = useLocation();

	return (
		<aside className="admin-sidebar">
			<div className="admin-profile">
				<div className="admin-avatar">
					<img src={avatarUser} alt="" />
				</div>
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

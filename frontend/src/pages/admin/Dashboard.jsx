// Dashboard.jsx — Admin dashboard (Figma: Admin Page > Dashboard)
// Route: "/admin/dashboard"

import { Link } from "react-router";
import "../../styles/Dashboard.css";

import avatarUser from "../../assets/images/dashboard/avatar-user.svg";
import headerGrid from "../../assets/images/dashboard/header-grid.svg";

import iconChart from "../../assets/images/dashboard/icon-chart.svg";
import iconMoney from "../../assets/images/dashboard/icon-money.svg";
import iconMonitor from "../../assets/images/dashboard/icon-monitor.svg";
import iconUsers from "../../assets/images/dashboard/icon-users.svg";

import posterWhiteChicks from "../../assets/images/dashboard/white-chicks.png";
import posterMeanGirls from "../../assets/images/dashboard/mean-girls.png";
import posterDisclosureDay from "../../assets/images/dashboard/disclosure-day.png";
import posterToyStory from "../../assets/images/dashboard/toy-story-5.png";
import posterDevilWearsPrada from "../../assets/images/dashboard/devil-wears-prada-2.png";

// Sidebar links. Only Dashboard has a page so far — the rest are placeholders
// until their own branches are merged, so they render as plain (non-link) rows.
// `icon` maps to a .admin-nav-icon--* class that supplies the mask image.
const NAV_ITEMS = [
  { label: "Dashboard", icon: "dashboard", to: "/admin/dashboard" },
  { label: "Movie Management", icon: "movie", to: null },
  { label: "Schedule Management", icon: "schedule", to: null },
  { label: "Seat Selection Management", icon: "seat", to: null },
  { label: "List of Bookings", icon: "bookings", to: null },
];

// Placeholder figures until the backend is wired up
const STATS = [
  { label: "Total Bookings", value: "20", icon: iconChart },
  { label: "Total Revenue", value: "₱ 10,000", icon: iconMoney },
  { label: "Active Shows", value: "5", icon: iconMonitor },
  { label: "Total Users", value: "23", icon: iconUsers },
];

// Placeholder shows until real schedule data is available
const ACTIVE_SHOWS = [
  {
    id: 1,
    title: "White Chicks",
    price: "₱ 550",
    schedule: "Sat, June 18 at 10:00 am",
    poster: posterWhiteChicks,
  },
  {
    id: 2,
    title: "Mean Girls",
    price: "₱ 500",
    schedule: "Sun, June 18 at 1:00 pm",
    poster: posterMeanGirls,
  },
  {
    id: 3,
    title: "Disclosure Day",
    price: "₱ 600",
    schedule: "Sun, June 16 at 10:30 am",
    poster: posterDisclosureDay,
  },
  {
    id: 4,
    title: "Toy Story 5",
    price: "₱ 350",
    schedule: "Sun, June 17 at 12:00 pm",
    poster: posterToyStory,
  },
  {
    id: 5,
    title: "The Devil Wears Prada 2",
    price: "₱ 800",
    schedule: "Sun, June 18 at 3:00 pm",
    poster: posterDevilWearsPrada,
  },
];

function Dashboard() {
  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <div className="admin-profile">
          <div className="admin-avatar">
            <img src={avatarUser} alt="" />
          </div>
          <p className="admin-role">Admin</p>
        </div>

        <nav className="admin-nav" aria-label="Admin">
          {NAV_ITEMS.map((item) =>
            item.to ? (
              <Link key={item.label} to={item.to} className="admin-nav-item active">
                <span className={`admin-nav-icon admin-nav-icon--${item.icon}`} />
                <span>{item.label}</span>
              </Link>
            ) : (
              <span key={item.label} className="admin-nav-item">
                <span className={`admin-nav-icon admin-nav-icon--${item.icon}`} />
                <span>{item.label}</span>
              </span>
            )
          )}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <h1 className="admin-title">
            <img src={headerGrid} alt="" />
            <span>
              Admin <em>Dashboard</em>
            </span>
          </h1>
          <Link to="/" className="admin-logout">
            Log Out
          </Link>
        </header>

        <section className="admin-stats" aria-label="Overview">
          {STATS.map((stat) => (
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
          <div className="show-grid">
            {ACTIVE_SHOWS.map((show) => (
              <article className="show-card" key={show.id}>
                <img className="show-poster" src={show.poster} alt={`${show.title} poster`} />
                <div className="show-info">
                  <h3>{show.title}</h3>
                  <p className="show-price">{show.price}</p>
                  <p className="show-schedule">{show.schedule}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Dashboard;

import { useState } from "react";
import { Search, MapPin, ArrowUpRight, ArrowLeft } from "lucide-react";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import "../../styles/Branches.css";

/* Function 1 — branch data (hardcoded, 3 Taguig branches) */
const BRANCHES = [
  {
    id: "vista-mall-taguig",
    name: "Vista Mall Taguig",
    address: "Bagong Calzada St., Brgy. Tuktukan, Taguig City",
    hours: [
      { day: "Monday", time: "11:00 AM - 09:00 PM" },
      { day: "Tuesday", time: "11:00 AM - 09:00 PM" },
      { day: "Wednesday", time: "11:00 AM - 09:00 PM" },
      { day: "Thursday", time: "11:00 AM - 09:00 PM" },
      { day: "Friday", time: "11:00 AM - 09:00 PM" },
      { day: "Saturday", time: "10:00 AM - 09:00 PM" },
      { day: "Sunday", time: "10:00 AM - 09:00 PM" },
    ],
  },
  {
    id: "market-market",
    name: "Market! Market!",
    address: "McKinley Parkway, Bonifacio Global City, Taguig City",
    hours: [
      { day: "Monday", time: "10:00 AM - 10:00 PM" },
      { day: "Tuesday", time: "10:00 AM - 10:00 PM" },
      { day: "Wednesday", time: "10:00 AM - 10:00 PM" },
      { day: "Thursday", time: "10:00 AM - 10:00 PM" },
      { day: "Friday", time: "10:00 AM - 11:00 PM" },
      { day: "Saturday", time: "10:00 AM - 11:00 PM" },
      { day: "Sunday", time: "10:00 AM - 10:00 PM" },
    ],
  },
  {
    id: "venice-mckinley",
    name: "Venice McKinley",
    address: "Upper McKinley Road, McKinley Hill, Taguig City",
    hours: [
      { day: "Monday", time: "11:00 AM - 10:00 PM" },
      { day: "Tuesday", time: "11:00 AM - 10:00 PM" },
      { day: "Wednesday", time: "11:00 AM - 10:00 PM" },
      { day: "Thursday", time: "11:00 AM - 10:00 PM" },
      { day: "Friday", time: "11:00 AM - 11:00 PM" },
      { day: "Saturday", time: "10:00 AM - 11:00 PM" },
      { day: "Sunday", time: "10:00 AM - 10:00 PM" },
    ],
  },
];

export default function Branches() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  /* Function 2 — filter the list by branch name */
  const keyword = query.trim().toLowerCase();
  const visibleBranches = BRANCHES.filter((branch) =>
    branch.name.toLowerCase().includes(keyword)
  );

  const selectedBranch = BRANCHES.find((branch) => branch.id === selectedId);

  const handleSearchChange = (event) => {
    setQuery(event.target.value);
    setSelectedId(null); // searching always returns to the list
  };

  return (
    <>
      <Navbar />

      <main className="branches">
      <section className="branches__hero">
        <div className="branches__hero-inner">
          <h1 className="branches__title">Explore FilmVault Branches</h1>
          <p className="branches__subtitle">
            Discover all our branches across the city. Find the nearest FilmVault
            in your area below.
          </p>

          <form
            className="branches__search"
            role="search"
            onSubmit={(event) => event.preventDefault()}
          >
            <label className="branches__search-field">
              <Search className="branches__search-icon" size={18} aria-hidden="true" />
              <input
                type="text"
                value={query}
                onChange={handleSearchChange}
                placeholder="Find branch name..."
                aria-label="Find branch name"
              />
            </label>
            <button type="submit" className="branches__search-button">
              Search
            </button>
          </form>
        </div>
      </section>

      {selectedBranch ? (
        <section className="branch-detail" aria-label={`${selectedBranch.name} details`}>
          <button
            type="button"
            className="branch-detail__back"
            onClick={() => setSelectedId(null)}
          >
            <ArrowLeft size={15} aria-hidden="true" />
            Back
          </button>

          <div className="branch-detail__body">
            <div className="branch-detail__identity">
              <h2 className="branch-detail__name">{selectedBranch.name}</h2>
              <p className="branch-detail__address">
                <MapPin size={16} aria-hidden="true" />
                <span>{selectedBranch.address}</span>
              </p>
            </div>

            <div className="branch-detail__hours">
              <h3 className="branch-detail__hours-title">Cinema Hours</h3>
              <div className="branch-detail__hours-grid">
                <dl className="branch-detail__hours-column">
                  {selectedBranch.hours.slice(0, 5).map((entry) => (
                    <div className="branch-detail__hours-row" key={entry.day}>
                      <dt>{entry.day}</dt>
                      <dd>{entry.time}</dd>
                    </div>
                  ))}
                </dl>
                <dl className="branch-detail__hours-column">
                  {selectedBranch.hours.slice(5).map((entry) => (
                    <div className="branch-detail__hours-row" key={entry.day}>
                      <dt>{entry.day}</dt>
                      <dd>{entry.time}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </section>
      ) : visibleBranches.length > 0 ? (
        <section className="branch-grid" aria-label="FilmVault branches">
          {visibleBranches.map((branch) => (
            <article className="branch-card" key={branch.id}>
              <h2 className="branch-card__name">{branch.name}</h2>
              <p className="branch-card__address">{branch.address}</p>
              <button
                type="button"
                className="branch-card__link"
                onClick={() => setSelectedId(branch.id)}
              >
                <span>See Branch Details</span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </button>
            </article>
          ))}
        </section>
      ) : (
        <section className="branch-empty">
          <p>No branch is named “{query.trim()}”.</p>
          <button type="button" onClick={() => setQuery("")}>
            Show all branches
          </button>
        </section>
      )}
      </main>

      <Footer />
    </>
  );
}

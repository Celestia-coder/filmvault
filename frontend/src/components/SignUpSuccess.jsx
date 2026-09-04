import "../styles/SignUpSuccess.css";

/**
 * Step 4 of the Sign Up flow — shown after "Activate my account" passes validation.
 *
 * Props
 *  formData       the same object passed through Steps 1–3
 *  onExplore      () => void — usually navigate("/")
 *  onGoToLogin    () => void — usually navigate("/login")
 */
export default function SignUpSuccess({ formData = {}, onExplore, onGoToLogin }) {
  const displayName = formData.displayName || formData.firstName || "there";
  const location = formData.location;
  const genres = Array.isArray(formData.favoriteGenres) ? formData.favoriteGenres : [];

  const shortcuts = [
    { icon: "🍿", title: "Browse movies", copy: "See what's now showing near you" },
    { icon: "🎟️", title: "Book tickets", copy: "Pick your seats in seconds" },
    { icon: "🎬", title: "Find cinemas", copy: "Explore cinemas around your city" },
  ];

  return (
    <div className="activated">
      <span className="activated__check" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="4 12.5 9.5 18 20 6.5" />
        </svg>
      </span>

      <p className="activated__label">Account activated</p>

      <h1 className="activated__title">
        Welcome to FilmVault,
        <span className="activated__name">{displayName}!</span>
      </h1>

      <p className="activated__lede">
        Your account is live and ready to go. Discover the latest movies, grab your seats, and enjoy
        the big screen experience — all in one place.
      </p>

      <ul className="badges">
        <li className="badge badge--verified">Email verified</li>
        {location && <li className="badge">{location}</li>}
        {genres.length > 0 && <li className="badge">{genres.join(" · ")}</li>}
      </ul>

      <div className="shortcuts">
        {shortcuts.map((item) => (
          <div className="shortcut" key={item.title}>
            <span className="shortcut__icon" aria-hidden="true">
              {item.icon}
            </span>
            <h2 className="shortcut__title">{item.title}</h2>
            <p className="shortcut__copy">{item.copy}</p>
          </div>
        ))}
      </div>

      <div className="activated__actions">
        <button type="button" className="btn btn--primary" onClick={onExplore}>
          Start exploring FilmVault
        </button>
        <button type="button" className="btn btn--ghost btn--full" onClick={onGoToLogin}>
          Go to login
        </button>
      </div>
    </div>
  );
}

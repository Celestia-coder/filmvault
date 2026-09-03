// Route: "/admin/login"
import { useState } from "react";
import { Link } from "react-router";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import heroBg from "../../assets/images/hero-bg.png";
import "../../styles/AdminLogin.css";

const IconMail = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 6-10 7L2 6" />
  </svg>
);

const IconLock = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconEye = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconEyeOff = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <path d="M6.61 6.61A18.5 18.5 0 0 0 1 12s4 8 11 8a10.94 10.94 0 0 0 5.39-1.61" />
    <path d="M1 1l22 22" />
  </svg>
);

const IconChevronDown = (props) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const IconGoogle = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" {...props}>
    <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82Z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.87-3.01c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24Z" />
    <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.11Z" />
    <path fill="#EA4335" d="M12 4.76c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.94 1.19 15.23 0 12 0 7.31 0 3.26 2.69 1.27 6.61l4 3.11C6.22 6.87 8.87 4.76 12 4.76Z" />
  </svg>
);

const IconFilm = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="3" width="20" height="18" rx="2" />
    <path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5" />
  </svg>
);

const IconTicket = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M2 9a3 3 0 1 0 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 1 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2Z" />
    <path d="M9 5v14" strokeDasharray="3 3" />
  </svg>
);

const IconStar = (props) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
    <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
  </svg>
);

const FEATURES = [
  {
    icon: <IconFilm />,
    title: "Instant Seat Selection",
    desc: "Real-time availability at cinemas near you",
  },
  {
    icon: <IconTicket />,
    title: "Digital Tickets",
    desc: "QR codes delivered instantly to your account",
  },
  {
    icon: <IconStar />,
    title: "Discount Eligibility",
    desc: "Special discounts available for students and PWDs",
  },
];

function AdminFeatureCard({ icon, title, desc }) {
  return (
    <div className="admin-feature-card">
      <div className="admin-feature-icon">{icon}</div>
      <div>
        <p className="admin-feature-title">{title}</p>
        <p className="admin-feature-desc">{desc}</p>
      </div>
    </div>
  );
}

// Mock auth
const MOCK_ADMIN_ACCOUNT = {
  email: "admin@filmvault.com",
  password: "admin123",
};

// Branch list for the dropdown
const BRANCHES = [
  "Vista Mall Taguig",
  "Market! Market!",
  "Venice McKinley",
];

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [branch, setBranch] = useState("BRANCHES[0]");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);

  const validate = () => {
    const next = {};
    if (!email.trim()) next.email = "Email is required.";
    if (!password) next.password = "Password is required.";
    if (!branch) next.branch = "Please select your branch.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus(null);
    if (!validate()) return;

    if (email === MOCK_ADMIN_ACCOUNT.email && password === MOCK_ADMIN_ACCOUNT.password) {
      setStatus({ type: "success", message: `Login successful! Redirecting to the ${branch} dashboard...` });
    } else {
      setStatus({ type: "error", message: "Invalid email or password." });
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-bg" style={{ backgroundImage: `url(${heroBg})` }}></div>
      <section className="admin-login-hero">
        <Navbar />
        <div className="admin-login-layout">
          <div className="admin-login-intro">
            <h1 className="admin-login-heading">
              YOUR<br /><span className="admin-text-red">GATEWAY</span><br />TO THE<br />BIG<br />SCREEN
            </h1>
            <p className="admin-login-subtext">
              FilmVault is your all-in-one movie ticketing platform. Browse the
              latest releases, pick your perfect seats, and book in just a few
              clicks — anytime, anywhere.
            </p>

            <div className="admin-feature-list">
              {FEATURES.map((f) => (
                <AdminFeatureCard key={f.title} {...f} />
              ))}
            </div>
          </div>

          <div className="admin-login-card">
            <div className="admin-card-top-row">
              <p className="admin-card-eyebrow">Welcome Back</p>
              <Link to="/login" className="admin-card-top-link">← Back</Link>
            </div>
            <h2 className="admin-card-title">Sign In</h2>
            <p className="admin-card-subtitle">
              Log in to oversee your branch operations, including movie
              schedules, cinema seating, and customer bookings.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="admin-email">Email Address</label>
                <div className="admin-input-wrapper">
                  <IconMail />
                  <input
                    id="admin-email"
                    className="admin-form-input"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {errors.email && <p className="admin-field-error">{errors.email}</p>}
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="admin-password">Password</label>
                <div className="admin-input-wrapper">
                  <IconLock />
                  <input
                    id="admin-password"
                    className="admin-form-input"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="admin-input-icon-btn"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
                {errors.password && <p className="admin-field-error">{errors.password}</p>}
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label" htmlFor="admin-branch">Select Branch</label>
                <div className="admin-input-wrapper">
                  <select
                    id="admin-branch"
                    className="admin-form-select"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                  >
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  <IconChevronDown className="admin-select-caret" />
                </div>
                {errors.branch && <p className="admin-field-error">{errors.branch}</p>}
              </div>

              <div className="admin-options-row">
                <label className="admin-remember-me">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Remember Me
                </label>
                <a href="/forgot-password" className="admin-forgot-link">Forgot password?</a>
              </div>

              {status && <p className={"admin-status-message " + status.type}>{status.message}</p>}

              <button type="submit" className="admin-btn-submit">Login</button>

              <div className="admin-divider">or continue with</div>

              <button type="button" className="admin-btn-google">
                <IconGoogle /> Continue with Google
              </button>
            </form>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}

export default AdminLogin;

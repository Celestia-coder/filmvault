// Route: "/login"
import { useState } from "react";
import { Link } from "react-router";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import heroBg from "../../assets/images/hero-bg.png";
import "../../styles/Login.css";

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

function FeatureCard({ icon, title, desc }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <div>
        <p className="feature-title">{title}</p>
        <p className="feature-desc">{desc}</p>
      </div>
    </div>
  );
}

// Mock auth
const MOCK_CLIENT_ACCOUNT = {
  email: "juan@example.com",
  password: "password123",
};

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);

  const validate = () => {
    const next = {};
    if (!email.trim()) next.email = "Email is required.";
    if (!password) next.password = "Password is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setStatus(null);
    if (!validate()) return;

    if (email === MOCK_CLIENT_ACCOUNT.email && password === MOCK_CLIENT_ACCOUNT.password) {
      setStatus({ type: "success", message: "Login successful! Redirecting to your account..." });
    } else {
      setStatus({ type: "error", message: "Invalid email or password." });
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg" style={{ backgroundImage: `url(${heroBg})` }}></div>
      <section className="login-hero">
        <Navbar />
        <div className="login-layout">
          <div className="login-intro">
            <h1 className="login-heading">
              YOUR<br /><span className="text-red">GATEWAY</span><br />TO THE<br />BIG<br />SCREEN
            </h1>
            <p className="login-subtext">
              FilmVault is your all-in-one movie ticketing platform. Browse the
              latest releases, pick your perfect seats, and book in just a few
              clicks — anytime, anywhere.
            </p>

            <div className="feature-list">
              {FEATURES.map((f) => (
                <FeatureCard key={f.title} {...f} />
              ))}
            </div>
          </div>

          <div className="login-card">
            <div className="card-top-row">
              <p className="card-eyebrow">Welcome Back</p>
              <Link to="/admin/login" className="card-top-link">Login as Admin</Link>
            </div>
            <h2 className="card-title">Sign In</h2>
            <p className="card-subtitle">
              Your seat is waiting. Log in to browse movies, check cinemas, and manage your
              bookings.
            </p>

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Address</label>
                <div className="input-wrapper">
                  <IconMail />
                  <input
                    id="email"
                    className="form-input"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {errors.email && <p className="field-error">{errors.email}</p>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <IconLock />
                  <input
                    id="password"
                    className="form-input"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="input-icon-btn"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
                {errors.password && <p className="field-error">{errors.password}</p>}
              </div>

              <div className="options-row">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Remember Me
                </label>
                <a href="/forgot-password" className="forgot-link">Forgot password?</a>
              </div>

              {status && <p className={"status-message " + status.type}>{status.message}</p>}

              <button type="submit" className="btn-submit">Login</button>

              <div className="divider">or continue with</div>

              <button type="button" className="btn-google">
                <IconGoogle /> Continue with Google
              </button>

              <p className="signup-hint">
                Don't have an account? <Link to="/signup">Sign Up</Link>
              </p>
            </form>
          </div>
        </div>
      </section>
      <Footer />
    </div>
  );
}

export default Login;

// Route: "/signup"

import { useState } from "react";
import { Link } from "react-router";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import heroBg from "../../assets/images/hero-bg.png";
import "../../styles/SignUp.css";

const IconUser = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);

const IconMail = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 6-10 7L2 6" />
    </svg>
);

const IconLock = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

const IconPhone = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
);

const IconCalendar = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
);

const IconMapPin = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

const IconGender = (props) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="9" cy="9" r="5" />
        <circle cx="16" cy="15" r="5" />
    </svg>
);

const IconChevronDown = (props) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="m6 9 6 6 6-6" />
    </svg>
);

const IconCamera = (props) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
        <circle cx="12" cy="13" r="4" />
    </svg>
);

const IconFilm = (props) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect x="2" y="3" width="20" height="18" rx="2" />
        <path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5" />
    </svg>
);

const IconTicket = (props) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M2 9a3 3 0 1 0 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 1 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2Z" />
        <path d="M9 5v14" strokeDasharray="3 3" />
    </svg>
);

const IconStar = (props) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
        <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z" />
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

/* ---------------------------------------------------------------- */
/* Static data                                                       */
/* ---------------------------------------------------------------- */

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

const GENRES = [
    { label: "Action", emoji: "🎬" },
    { label: "Comedy", emoji: "😂" },
    { label: "Horror", emoji: "👻" },
    { label: "Romance", emoji: "💕" },
    { label: "Sci-Fi", emoji: "🚀" },
    { label: "Thriller", emoji: "😱" },
    { label: "Animation", emoji: "🎨" },
    { label: "Drama", emoji: "🎭" },
    { label: "Musical", emoji: "🎵" },
    { label: "Documentary", emoji: "🎥" },
];

const PH_COUNTRY_CODE = "+63";

const STEPS = [
    { number: 1, label: "Account" },
    { number: 2, label: "Profile" },
    { number: 3, label: "Confirm" },
];

/* ---------------------------------------------------------------- */
/* Small subcomponents                                               */
/* ---------------------------------------------------------------- */

function StepIndicator({ current }) {
    return (
        <div className="step-indicator">
            {STEPS.map((s, i) => (
                <div className="step-indicator-item" key={s.number}>
                    <div
                        className={
                            "step-circle" +
                            (current === s.number ? " active" : current > s.number ? " completed" : "")
                        }
                    >
                        {s.number}
                    </div>
                    <span className={"step-label" + (current === s.number ? " active" : "")}>
                        {s.label}
                    </span>
                    {i < STEPS.length - 1 && <span className="step-line" />}
                </div>
            ))}
        </div>
    );
}

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

/* ---------------------------------------------------------------- */
/* Page                                                               */
/* ---------------------------------------------------------------- */

function SignUp() {
    const [step, setStep] = useState(1);
    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
        agree: false,
        photoPreview: null,
        displayName: "",
        phone: "",
        dob: "",
        gender: "",
        city: "",
        genres: [],
    });
    const [errors, setErrors] = useState({});

    const set = (field) => (e) => {
        const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const handlePhoneKeyDown = (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return; // don't block shortcuts
        if (e.key.length > 1) return; // Backspace, Delete, arrows, Tab, etc.
        // Extra layer on top of the onChange filter below: reject the
        // keystroke itself for anything that isn't a digit or a space.
        if (!/[\d ]/.test(e.key)) {
            e.preventDefault();
        }
    };

    const handlePhoneChange = (e) => {
        // Digits and spaces only — no letters, no symbols (+63 is a static
        // prefix now, so there's no reason for a + to end up in here
        // either). Filtering the value (not just blocking keystrokes)
        // means this also cleans up pasted text.
        const digitsAndSpaces = e.target.value.replace(/[^\d\s]/g, "");
        // Cap at 10 digits — the standard PH mobile number length — while
        // still allowing the spaces the user types for formatting.
        let digitCount = 0;
        let capped = "";
        let hitLimit = false;
        for (const char of digitsAndSpaces) {
            if (/\d/.test(char)) {
                if (digitCount >= 10) {
                    hitLimit = true;
                    break;
                }
                digitCount++;
            }
            capped += char;
        }
        // Only trim when we actually cut something off — a normal trailing
        // space while still under the limit is the user mid-formatting,
        // not something to clean up.
        setForm((prev) => ({ ...prev, phone: hitLimit ? capped.trimEnd() : capped }));
    };

    const toggleGenre = (label) => {
        setForm((prev) => ({
            ...prev,
            genres: prev.genres.includes(label)
                ? prev.genres.filter((g) => g !== label)
                : [...prev.genres, label],
        }));
    };

    const handlePhoto = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setForm((prev) => ({ ...prev, photoPreview: URL.createObjectURL(file) }));
    };

    const validateAccount = () => {
        const next = {};
        if (!form.firstName.trim()) next.firstName = "First name is required.";
        if (!form.lastName.trim()) next.lastName = "Last name is required.";
        if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Enter a valid email address.";
        if (form.password.length < 8) next.password = "Use at least 8 characters.";
        if (form.confirmPassword !== form.password) next.confirmPassword = "Passwords don't match.";
        if (!form.agree) next.agree = "Please accept the Terms of Use and Privacy Policy.";
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const validateProfile = () => {
        const next = {};
        const digitsOnly = form.phone.replace(/\s/g, "");
        if (digitsOnly && !/^\d+$/.test(digitsOnly)) {
            next.phone = "Phone number should contain numbers only.";
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const handleAccountSubmit = (e) => {
        e.preventDefault();
        // TODO: call the real account-creation endpoint once the auth API is wired up
        if (validateAccount()) setStep(2);
    };

    const handleProfileSubmit = (e) => {
        e.preventDefault();
        // Rest of the profile stays optional per the design; phone just
        // needs to pass the numbers-only check if the user filled it in
        if (validateProfile()) setStep(3);
    };

    const handleFinalSubmit = () => {
        // TODO: POST `form` to the API, then redirect to /login or the dashboard
        console.log("FilmVault sign-up payload", form);
    };

    return (
        <div className="signup-page">
            <div className="signup-bg" style={{ backgroundImage: `url(${heroBg})` }}></div>

            <section className="signup-hero">
                <Navbar />

                <div className="signup-layout">
                    {/* Left column — shared marketing copy, same on every step */}
                    <div className="signup-intro">
                        <h1 className="signup-heading">
                            YOUR
                            <br />
                            <span className="text-red">GATEWAY</span>
                            <br />
                            TO THE
                            <br />
                            BIG
                            <br />
                            SCREEN
                        </h1>
                        <p className="signup-subtext">
                            FilmVault is your all-in-one movie ticketing platform. Browse the
                            latest releases, pick your perfect seats, and book in just a few
                            clicks — anytime, anywhere.
                        </p>

                        <div className="feature-list">
                            {FEATURES.map((f) => (
                                <FeatureCard key={f.title} {...f} />
                            ))}
                        </div>

                        {step === 1 && (
                            <Link to="/" className="btn-outline btn-back-page">
                                ← Back
                            </Link>
                        )}
                    </div>

                    {/* Right column — the step card */}
                    <div className="signup-card">
                        {step === 1 && (
                            <form onSubmit={handleAccountSubmit} noValidate>
                                <p className="card-eyebrow">Create Account</p>
                                <h2 className="card-title">Sign Up</h2>
                                <p className="card-subtitle">
                                    Join thousands of movie fans. It's free and takes less than a
                                    minute.
                                </p>

                                <StepIndicator current={1} />

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="firstName">First Name</label>
                                        <div className="input-wrapper">
                                            <IconUser />
                                            <input
                                                id="firstName"
                                                className="form-input"
                                                placeholder="Juan"
                                                autoComplete="given-name"
                                                value={form.firstName}
                                                onChange={set("firstName")}
                                            />
                                        </div>
                                        {errors.firstName && <p className="field-error">{errors.firstName}</p>}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="lastName">Last Name</label>
                                        <div className="input-wrapper">
                                            <IconUser />
                                            <input
                                                id="lastName"
                                                className="form-input"
                                                placeholder="Dela Cruz"
                                                autoComplete="family-name"
                                                value={form.lastName}
                                                onChange={set("lastName")}
                                            />
                                        </div>
                                        {errors.lastName && <p className="field-error">{errors.lastName}</p>}
                                    </div>
                                </div>

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
                                            value={form.email}
                                            onChange={set("email")}
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
                                            type="password"
                                            placeholder="Min. 8 characters"
                                            autoComplete="new-password"
                                            value={form.password}
                                            onChange={set("password")}
                                        />
                                    </div>
                                    {errors.password && <p className="field-error">{errors.password}</p>}
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
                                    <div className="input-wrapper">
                                        <IconLock />
                                        <input
                                            id="confirmPassword"
                                            className="form-input"
                                            type="password"
                                            placeholder="Re-enter password"
                                            autoComplete="new-password"
                                            value={form.confirmPassword}
                                            onChange={set("confirmPassword")}
                                        />
                                    </div>
                                    {errors.confirmPassword && <p className="field-error">{errors.confirmPassword}</p>}
                                </div>

                                <div className="terms-row">
                                    <input
                                        type="checkbox"
                                        id="agree"
                                        checked={form.agree}
                                        onChange={set("agree")}
                                    />
                                    <label htmlFor="agree" className="terms-text">
                                        I agree to the <a href="/terms">Terms of Use</a> and{" "}
                                        <a href="/privacy">Privacy Policy</a>. I understand that
                                        FilmVault will use my data to manage my account and bookings.
                                    </label>
                                </div>
                                {errors.agree && <p className="field-error">{errors.agree}</p>}

                                <button type="submit" className="btn-submit">
                                    Create My Account
                                </button>

                                <div className="divider">or sign up with</div>

                                <button type="button" className="btn-google">
                                    <IconGoogle /> Continue with Google
                                </button>

                                <p className="signin-hint">
                                    Already have an account? <a href="/login">Login</a>
                                </p>
                            </form>
                        )}

                        {step === 2 && (
                            <form onSubmit={handleProfileSubmit} noValidate>
                                <p className="card-eyebrow">Step 2 of 3</p>
                                <h2 className="card-title">Build Your Profile</h2>
                                <p className="card-subtitle">
                                    Tell us a bit about yourself so we can tailor your movie
                                    experience.
                                </p>

                                <StepIndicator current={2} />

                                <label className="photo-upload">
                                    <input type="file" accept="image/png,image/jpeg" hidden onChange={handlePhoto} />
                                    <span className="photo-avatar">
                                        {form.photoPreview ? (
                                            <img src={form.photoPreview} alt="Profile preview" />
                                        ) : (
                                            <IconCamera />
                                        )}
                                    </span>
                                    <span>
                                        <p className="photo-upload-title">Upload a Profile Photo</p>
                                        <p className="photo-upload-desc">JPG or PNG · Max 5MB · Optional</p>
                                    </span>
                                </label>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="displayName">Display Name</label>
                                        <div className="input-wrapper">
                                            <IconUser />
                                            <input
                                                id="displayName"
                                                className="form-input"
                                                placeholder="e.g. JuanFlix"
                                                autoComplete="nickname"
                                                value={form.displayName}
                                                onChange={set("displayName")}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" htmlFor="dob">Date of Birth</label>
                                        <div className="input-wrapper">
                                            <IconCalendar />
                                            <input
                                                id="dob"
                                                className="form-input"
                                                type="date"
                                                autoComplete="bday"
                                                value={form.dob}
                                                onChange={set("dob")}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="phone">Phone Number</label>
                                    <div className="input-wrapper">
                                        <IconPhone />
                                        <span className="phone-prefix">{PH_COUNTRY_CODE}</span>
                                        <input
                                            id="phone"
                                            className="form-input phone-input"
                                            type="tel"
                                            placeholder="9XX XXX XXXX"
                                            autoComplete="tel-national"
                                            inputMode="numeric"
                                            value={form.phone}
                                            onKeyDown={handlePhoneKeyDown}
                                            onChange={handlePhoneChange}
                                        />
                                    </div>
                                    {errors.phone && <p className="field-error">{errors.phone}</p>}
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="gender">Gender</label>
                                    <div className="input-wrapper">
                                        <IconGender />
                                        <select
                                            id="gender"
                                            className="form-select"
                                            value={form.gender}
                                            onChange={set("gender")}
                                        >
                                            <option value="">Select gender</option>
                                            <option value="female">Female</option>
                                            <option value="male">Male</option>
                                            <option value="nonbinary">Non-binary</option>
                                            <option value="prefer-not">Prefer not to say</option>
                                        </select>
                                        <IconChevronDown className="select-caret" />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="city">City / Location</label>
                                    <div className="input-wrapper">
                                        <IconMapPin />
                                        <input
                                            id="city"
                                            className="form-input"
                                            placeholder="e.g. Quezon City, Metro Manila"
                                            autoComplete="address-level2"
                                            value={form.city}
                                            onChange={set("city")}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        Favorite Genres <span className="label-hint">— pick any</span>
                                    </label>
                                    <div className="genre-grid">
                                        {GENRES.map((g) => (
                                            <button
                                                type="button"
                                                key={g.label}
                                                className={"genre-chip" + (form.genres.includes(g.label) ? " selected" : "")}
                                                onClick={() => toggleGenre(g.label)}
                                            >
                                                <span>{g.emoji}</span> {g.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="step-actions">
                                    <button type="button" className="btn-outline" onClick={() => setStep(1)}>
                                        ← Back
                                    </button>
                                    <button type="submit" className="btn-submit">
                                        Continue to Confirm →
                                    </button>
                                </div>
                            </form>
                        )}

                        {step === 3 && (
                            <div>
                                <p className="card-eyebrow">Step 3 of 3</p>
                                <h2 className="card-title">Review &amp; Confirm</h2>
                                <p className="card-subtitle">
                                    Almost there! Verify your details and confirm your email to activate
                                    your account.
                                </p>

                                <StepIndicator current={3} />

                                <div className="confirm-summary">
                                    <div className="confirm-row">
                                        <span>Name</span>
                                        <strong>{form.firstName} {form.lastName}</strong>
                                    </div>
                                    <div className="confirm-row">
                                        <span>Email</span>
                                        <strong>{form.email || "—"}</strong>
                                    </div>
                                    <div className="confirm-row">
                                        <span>Display Name</span>
                                        <strong>{form.displayName || "—"}</strong>
                                    </div>
                                    <div className="confirm-row">
                                        <span>Phone</span>
                                        <strong>{form.phone ? `${PH_COUNTRY_CODE} ${form.phone}` : "—"}</strong>
                                    </div>
                                    <div className="confirm-row">
                                        <span>City</span>
                                        <strong>{form.city || "—"}</strong>
                                    </div>
                                    <div className="confirm-row">
                                        <span>Favorite Genres</span>
                                        <strong>{form.genres.length ? form.genres.join(", ") : "—"}</strong>
                                    </div>
                                </div>

                                <div className="step-actions">
                                    <button type="button" className="btn-outline" onClick={() => setStep(2)}>
                                        ← Back
                                    </button>
                                    <button type="button" className="btn-submit" onClick={handleFinalSubmit}>
                                        Create My Account
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <Footer />
        </div>
    );
}

export default SignUp;
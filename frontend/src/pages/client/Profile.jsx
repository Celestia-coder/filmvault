import { useState } from "react";
import { useNavigate } from "react-router";
import {
  User,
  ShieldCheck,
  Lock,
  CalendarDays,
  Eye,
  EyeOff,
  LogOut,
  Pencil,
} from "lucide-react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import "../../styles/Profile.css";

/* ---------- Mock data ---------- */
// Replace with an API call once the backend profile endpoint is ready.
const mockProfile = {
  firstName: "Juan",
  lastName: "Dela Cruz",
  email: "juan@example.com",
  phone: "09123456789",
  username: "juan_d",
  memberSince: "June 2025",
  memberId: "FV-2025-00183",
  status: "Active",
  totalBookings: 12,
  activeReservations: 2,
};

const EMPTY_PASSWORDS = { current: "", next: "", confirm: "" };

/* ---------- Validation ---------- */

function validate(form, passwords) {
  const errors = {};

  if (!form.firstName.trim()) errors.firstName = "First name is required.";
  if (!form.lastName.trim()) errors.lastName = "Last name is required.";

  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!/^09\d{9}$/.test(form.phone.trim())) {
    errors.phone = "Use an 11-digit mobile number starting with 09.";
  }

  if (!/^[a-zA-Z0-9_]{3,}$/.test(form.username.trim())) {
    errors.username = "At least 3 characters: letters, numbers, underscore only.";
  }

  // Password fields are optional, but if the user fills any, all must be valid
  const wantsPasswordChange = passwords.current || passwords.next || passwords.confirm;
  if (wantsPasswordChange) {
    if (!passwords.current) errors.current = "Enter your current password.";
    if (passwords.next.length < 8) errors.next = "New password must be at least 8 characters.";
    if (passwords.confirm !== passwords.next) errors.confirm = "Passwords do not match.";
  }

  return errors;
}

/* ---------- Small reusable pieces ---------- */

// One row: read-only text in view mode, input in edit mode
function InfoField({ id, label, value, editing, onChange, error, locked, children }) {
  return (
    <div className="profile-field">
      <label htmlFor={id} className="profile-field-label">
        {label}
      </label>

      {!editing ? (
        <span className="profile-field-value">{children ?? value}</span>
      ) : (
        <div className="profile-field-control">
          <input
            id={id}
            type="text"
            value={value}
            onChange={onChange}
            disabled={locked}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
          />
          {locked && <Lock size={13} className="profile-lock" aria-label="Cannot be edited" />}
          {error && (
            <p id={`${id}-error`} className="profile-error">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PasswordField({ id, label, value, onChange, placeholder, error }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="profile-password-field">
      <label htmlFor={id}>{label}</label>
      <div className="profile-field-control">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="off"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          className="profile-eye"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error && (
        <p id={`${id}-error`} className="profile-error">
          {error}
        </p>
      )}
    </div>
  );
}

/* ---------- Page ---------- */

export default function Profile() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(mockProfile); // saved data
  const [form, setForm] = useState(mockProfile); // draft while editing
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setPassword = (key) => (e) => setPasswords((p) => ({ ...p, [key]: e.target.value }));

  const startEditing = () => {
    setForm(profile);
    setPasswords(EMPTY_PASSWORDS);
    setErrors({});
    setSaved(false);
    setEditing(true);
  };

  const cancelEditing = () => {
    setForm(profile);
    setPasswords(EMPTY_PASSWORDS);
    setErrors({});
    setEditing(false);
  };

  const handleSave = (e) => {
    e.preventDefault();

    const found = validate(form, passwords);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    // TODO: call the backend here (e.g. PUT /api/profile) and send the
    // password fields only if the user filled them in.
    setProfile(form);
    setPasswords(EMPTY_PASSWORDS);
    setEditing(false);
    setSaved(true);
  };

  const handleLogout = () => {
    // TODO: clear whatever your login stores (token / user) before redirecting
    localStorage.clear();
    navigate("/login");
  };

  const fullName = `${profile.firstName} ${profile.lastName}`;

  return (
    <>
      <Navbar />
      <main className="profile-page">
        <form onSubmit={handleSave} noValidate>
          {/* ---- Banner ---- */}
          <section className="profile-banner">
            <div className="profile-avatar" aria-hidden="true">
              <User size={44} />
            </div>

            <div className="profile-banner-info">
              <h1>{fullName}</h1>
              <p className="profile-role">FilmVault Member</p>
              <p className="profile-meta">
                <CalendarDays size={12} aria-hidden="true" /> Member Since {profile.memberSince}
              </p>
              <p className="profile-meta">
                <CalendarDays size={12} aria-hidden="true" /> Member ID: {profile.memberId}
              </p>
            </div>

            {/* FIX: each button has its own key so React does not reuse the
                Edit button as the Save (submit) button */}
            <div className="profile-actions">
              {!editing ? (
                <>
                  <button
                    key="logout"
                    type="button"
                    className="profile-btn profile-btn--outline"
                    onClick={handleLogout}
                  >
                    <LogOut size={13} aria-hidden="true" /> Log Out
                  </button>
                  <button
                    key="edit"
                    type="button"
                    className="profile-btn profile-btn--red"
                    onClick={startEditing}
                  >
                    <Pencil size={13} aria-hidden="true" /> Edit Profile
                  </button>
                </>
              ) : (
                <>
                  <button
                    key="cancel"
                    type="button"
                    className="profile-btn profile-btn--outline"
                    onClick={cancelEditing}
                  >
                    Cancel
                  </button>
                  <button key="save" type="submit" className="profile-btn profile-btn--green">
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </section>

          {saved && (
            <p className="profile-toast" role="status">
              Your profile was updated.
            </p>
          )}

          {/* ---- Info cards ---- */}
          <div className="profile-grid">
            <section className="profile-card" aria-labelledby="personal-title">
              <h2 id="personal-title" className="profile-card-title">
                <User size={16} aria-hidden="true" /> Personal Information
              </h2>

              <InfoField
                id="firstName"
                label="First Name"
                value={editing ? form.firstName : profile.firstName}
                editing={editing}
                onChange={setField("firstName")}
                error={errors.firstName}
              />
              <InfoField
                id="lastName"
                label="Last Name"
                value={editing ? form.lastName : profile.lastName}
                editing={editing}
                onChange={setField("lastName")}
                error={errors.lastName}
              />
              <InfoField
                id="email"
                label="Email Address"
                value={editing ? form.email : profile.email}
                editing={editing}
                onChange={setField("email")}
                error={errors.email}
              />
              <InfoField
                id="phone"
                label="Phone Number"
                value={editing ? form.phone : profile.phone}
                editing={editing}
                onChange={setField("phone")}
                error={errors.phone}
              />
            </section>

            <section className="profile-card" aria-labelledby="account-title">
              <h2 id="account-title" className="profile-card-title">
                <ShieldCheck size={16} aria-hidden="true" /> Account Information
              </h2>

              <InfoField
                id="username"
                label="Username"
                value={editing ? form.username : profile.username}
                editing={editing}
                onChange={setField("username")}
                error={errors.username}
              />
              <InfoField id="status" label="Status" value={profile.status} editing={editing} locked>
                <span className="profile-status">
                  <span className="profile-status-dot" aria-hidden="true" />
                  {profile.status}
                </span>
              </InfoField>
              <InfoField
                id="totalBookings"
                label="Total Bookings"
                value={String(profile.totalBookings)}
                editing={editing}
                locked
              />
              <InfoField
                id="activeReservations"
                label="Active Reservations"
                value={String(profile.activeReservations)}
                editing={editing}
                locked
              />
            </section>
          </div>

          {/* ---- Change password (edit mode only) ---- */}
          {editing && (
            <section className="profile-card profile-card--wide" aria-labelledby="password-title">
              <h2 id="password-title" className="profile-card-title">
                <Lock size={16} aria-hidden="true" /> Change Password
              </h2>
              <p className="profile-hint">Leave these blank if you don't want to change your password.</p>

              <div className="profile-password-grid">
                <PasswordField
                  id="currentPassword"
                  label="Current Password"
                  placeholder="Enter current password"
                  value={passwords.current}
                  onChange={setPassword("current")}
                  error={errors.current}
                />
                <PasswordField
                  id="newPassword"
                  label="New Password"
                  placeholder="Enter new password"
                  value={passwords.next}
                  onChange={setPassword("next")}
                  error={errors.next}
                />
                <PasswordField
                  id="confirmPassword"
                  label="Confirm Password"
                  placeholder="Confirm new password"
                  value={passwords.confirm}
                  onChange={setPassword("confirm")}
                  error={errors.confirm}
                />
              </div>
            </section>
          )}
        </form>
      </main>
      <Footer />
    </>
  );
}
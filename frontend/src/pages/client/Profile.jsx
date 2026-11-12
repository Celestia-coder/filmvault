import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  User,
  ShieldCheck,
  Lock,
  CalendarDays,
  CreditCard,
  Eye,
  EyeOff,
  LogOut,
  UserPen,
  Camera,
} from "lucide-react";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { fetchProfile, updateProfile } from "../../api/profile";
import heroBg from "../../assets/images/hero-bg.png";
import "../../styles/Profile.css";

const EMPTY_PROFILE = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  username: "",
  avatarUrl: null,
  memberSince: "",
  memberId: "",
  status: "",
  totalBookings: 0,
  activeReservations: 0,
};

const EMPTY_PASSWORDS = { current: "", next: "", confirm: "" };

const AVATAR_TYPES = ["image/jpeg", "image/pjpeg", "image/png", "image/webp", "image/gif"];
const AVATAR_EXTENSIONS = /\.(jpe?g|jfif|png|webp|gif)$/i; // fallback when the browser gives no MIME type
const AVATAR_MAX_MB = 10;
const AVATAR_MAX_BYTES = AVATAR_MAX_MB * 1024 * 1024;

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

/*
  One row of an info card.
  - View mode:  label + plain text (or `children`, e.g. the email link / status dot)
  - Edit mode:  label + input
  - locked:     shown in a greyed-out box with a lock icon in edit mode (cannot be edited)
*/
function InfoField({
  id,
  label,
  value,
  editing,
  onChange,
  error,
  locked = false,
  type = "text",
  autoComplete,
  maxLength,
  children,
}) {
  const isInput = editing && !locked;

  return (
    <div className={`profile-field ${editing ? "profile-field--edit" : "profile-field--view"}`}>
      {isInput ? (
        <label htmlFor={id} className="profile-field-label">
          {label}
        </label>
      ) : (
        <span className="profile-field-label">{label}</span>
      )}

      {!editing && <span className="profile-field-value">{children ?? value}</span>}

      {editing && locked && (
        <div className="profile-field-control">
          <div className="profile-locked">
            <span className="profile-locked-value">{children ?? value}</span>
            <Lock size={16} className="profile-lock" aria-hidden="true" />
            <span className="profile-sr-only">{label} cannot be edited</span>
          </div>
        </div>
      )}

      {isInput && (
        <div className="profile-field-control">
          <input
            id={id}
            type={type}
            value={value}
            onChange={onChange}
            autoComplete={autoComplete}
            maxLength={maxLength}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
          />
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

function PasswordField({ id, label, value, onChange, placeholder, autoComplete, error }) {
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
          autoComplete={autoComplete}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          className="profile-eye"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
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
  const fileInputRef = useRef(null);

  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [form, setForm] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState(""); // success message shown after saving

  // Picked-but-not-saved profile picture: { file, preview }
  const [avatarDraft, setAvatarDraft] = useState(null);
  const [avatarError, setAvatarError] = useState("");

  // Hide the success message after a few seconds
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
  let cancelled = false;

  fetchProfile()
    .then((data) => {
      if (cancelled) return;
      setProfile(data);
      setForm(data);
    })
    .catch((err) => {
      if (cancelled) return;
      if (err.status === 401) {
        localStorage.clear();
        navigate("/login");
        return;
      }
      setLoadError(err.message);
    })
    .finally(() => {
      if (!cancelled) setLoading(false);
    });

  return () => {
    cancelled = true;
  };
}, [navigate]);

  const setField = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setPassword = (key) => (e) => setPasswords((p) => ({ ...p, [key]: e.target.value }));

  const discardAvatarDraft = () => {
    if (avatarDraft) URL.revokeObjectURL(avatarDraft.preview);
    setAvatarDraft(null);
    setAvatarError("");
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the user pick the same file again later
    if (!file) return;

    if (!AVATAR_TYPES.includes(file.type) && !AVATAR_EXTENSIONS.test(file.name)) {
      setAvatarError("Use a JPG, PNG, WebP or GIF image.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError(`Image must be ${AVATAR_MAX_MB} MB or smaller.`);
      return;
    }

    if (avatarDraft) URL.revokeObjectURL(avatarDraft.preview);
    setAvatarError("");
    setAvatarDraft({ file, preview: URL.createObjectURL(file) });
  };

  const startEditing = () => {
    discardAvatarDraft();
    setForm(profile);
    setPasswords(EMPTY_PASSWORDS);
    setErrors({});
    setNotice("");
    setEditing(true);
  };

  const cancelEditing = () => {
    discardAvatarDraft();
    setForm(profile);
    setPasswords(EMPTY_PASSWORDS);
    setErrors({});
    setEditing(false);
  };

const handleSave = async (e) => {
  e.preventDefault();
  if (saving) return;

  const found = validate(form, passwords);
  setErrors(found);
  if (Object.keys(found).length > 0) return;

  const passwordChanged = Boolean(passwords.next);
  const profileChanged =
    Boolean(avatarDraft) || Object.keys(form).some((key) => form[key] !== profile[key]);

  if (!passwordChanged && !profileChanged) {
    setEditing(false);
    return;
  }

  setSaving(true);
  try {
    const saved = await updateProfile({
      form,
      passwords,
      avatarFile: avatarDraft?.file,
    });

    if (avatarDraft) URL.revokeObjectURL(avatarDraft.preview);
    setProfile(saved);
    setForm(saved);
    setAvatarDraft(null);
    setAvatarError("");
    setPasswords(EMPTY_PASSWORDS);
    setErrors({});
    setEditing(false);

    if (passwordChanged && profileChanged) setNotice("Your profile and password were updated.");
    else if (passwordChanged) setNotice("Your password was changed.");
    else setNotice("Your profile was updated.");
  } catch (err) {
    if (err.status === 401) {
      localStorage.clear();
      navigate("/login");
      return;
    }
    const { avatar, ...fieldErrors } = err.errors || {};
    if (avatar) setAvatarError(avatar);
    if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
    else if (!avatar) setErrors({ form: err.message });
  } finally {
    setSaving(false);
  }
};

  const handleLogout = () => {
    // TODO: clear whatever your login stores (token / user) before redirecting
    localStorage.clear();
    navigate("/login");
  };

  const fullName = `${profile.firstName} ${profile.lastName}`;

  if (loading || loadError) {
  return (
    <>
      <Navbar />
      <main className="profile-page">
        <p className="profile-hint" role={loadError ? "alert" : "status"}>
          {loadError || "Loading profile..."}
        </p>
      </main>
      <Footer />
    </>
  );
}

  // While editing, inputs read from the draft; otherwise from saved data
  const current = editing ? form : profile;
  const avatarSrc = editing && avatarDraft ? avatarDraft.preview : profile.avatarUrl;

  return (
    <>
      <Navbar />
      <main className="profile-page">
        <form className="profile-container" onSubmit={handleSave} noValidate>
          {/* ---- Banner ---- */}
          <section
            className="profile-banner"
            aria-label="Profile summary"
            style={{ "--profile-banner-image": `url(${heroBg})` }}
          >
            <div className="profile-avatar-wrap">
              <div className="profile-avatar">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={`${fullName} profile photo`} />
                ) : (
                  <User fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
                )}
              </div>

              {editing && (
                <>
                  <button
                    type="button"
                    className="profile-avatar-upload"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Upload profile photo"
                    title="Upload profile photo"
                  >
                    <Camera size={18} aria-hidden="true" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,.jfif"
                    onChange={handleAvatarChange}
                    hidden
                  />
                </>
              )}
            </div>

            <div className="profile-banner-info">
              <h1>{fullName}</h1>
              <p className="profile-role">FilmVault Member</p>
              <p className="profile-meta">
                <CalendarDays size={16} aria-hidden="true" /> Member Since {profile.memberSince}
              </p>
              <p className="profile-meta">
                <CreditCard size={16} aria-hidden="true" /> Member ID: {profile.memberId}
              </p>
              {avatarError && (
                <p className="profile-avatar-error" role="alert">
                  {avatarError}
                </p>
              )}
            </div>

            {/* Each button has its own key so React never reuses the Edit
                button as the Save (submit) button */}
            <div className="profile-actions">
              {!editing ? (
                <>
                  <button
                    key="logout"
                    type="button"
                    className="profile-btn profile-btn--outline"
                    onClick={handleLogout}
                  >
                    <LogOut size={18} aria-hidden="true" /> Log Out
                  </button>
                  <button
                    key="edit"
                    type="button"
                    className="profile-btn profile-btn--red"
                    onClick={startEditing}
                  >
                    <UserPen size={18} aria-hidden="true" /> Edit Profile
                  </button>
                </>
              ) : (
                <>
                <button
                  key="cancel"
                  type="button"
                  className="profile-btn profile-btn--outline"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  key="save"
                  type="submit"
                  className="profile-btn profile-btn--green"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                </>
              )}
            </div>
          </section>

          {notice && (
            <p className="profile-toast" role="status">
              {notice}
            </p>
          )}

          {errors.form && (
            <p className="profile-error" role="alert">
              {errors.form}
            </p>
          )}          

          {/* ---- Info cards ---- */}
          <div className="profile-grid">
            <section className="profile-card" aria-labelledby="personal-title">
              <h2 id="personal-title" className="profile-card-title">
                <User size={24} aria-hidden="true" /> Personal Information
              </h2>

              <InfoField
                id="firstName"
                label="First Name"
                value={current.firstName}
                editing={editing}
                onChange={setField("firstName")}
                error={errors.firstName}
                autoComplete="given-name"
              />
              <InfoField
                id="lastName"
                label="Last Name"
                value={current.lastName}
                editing={editing}
                onChange={setField("lastName")}
                error={errors.lastName}
                autoComplete="family-name"
              />
              <InfoField
                id="email"
                label="Email Address"
                type="email"
                value={current.email}
                editing={editing}
                onChange={setField("email")}
                error={errors.email}
                autoComplete="email"
              >
                <a href={`mailto:${profile.email}`} className="profile-link">
                  {profile.email}
                </a>
              </InfoField>
              <InfoField
                id="phone"
                label="Phone Number"
                type="tel"
                value={current.phone}
                editing={editing}
                onChange={setField("phone")}
                error={errors.phone}
                autoComplete="tel"
                maxLength={11}
              />
            </section>

            <section className="profile-card" aria-labelledby="account-title">
              <h2 id="account-title" className="profile-card-title">
                <ShieldCheck size={24} aria-hidden="true" /> Account Information
              </h2>

              <InfoField
                id="username"
                label="Username"
                value={current.username}
                editing={editing}
                onChange={setField("username")}
                error={errors.username}
                autoComplete="username"
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
                <Lock size={24} aria-hidden="true" /> Security &amp; Password
              </h2>
              <p className="profile-hint">
                Leave blank if you don't want to update your password.
              </p>

              <div className="profile-password-grid">
                <PasswordField
                  id="currentPassword"
                  label="Current Password"
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  value={passwords.current}
                  onChange={setPassword("current")}
                  error={errors.current}
                />
                <PasswordField
                  id="newPassword"
                  label="New Password"
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  value={passwords.next}
                  onChange={setPassword("next")}
                  error={errors.next}
                />
                <PasswordField
                  id="confirmPassword"
                  label="Confirm Password"
                  placeholder="Confirm new password"
                  autoComplete="new-password"
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
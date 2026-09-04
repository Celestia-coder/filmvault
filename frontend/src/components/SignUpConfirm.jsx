import { useEffect, useMemo, useRef, useState } from "react";
import "../styles/SignUpConfirm.css";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

/**
 * Step 3 of the Sign Up flow — "Review & Confirm".
 *
 * Props
 *  formData    object holding everything collected in Steps 1 & 2.
 *              Expected keys (all optional, safe fallbacks below):
 *              firstName, lastName, email, password,
 *              displayName, location, favoriteGenres (array of strings)
 *  onBack      () => void          — go back to Step 2
 *  onEdit      (stepNumber) => void — jump to Step 1 or 2 to fix a field
 *  onSuccess   (payload) => void   — all checks passed, advance to Step 4
 */
export default function SignUpConfirm({ formData = {}, onBack, onEdit, onSuccess }) {
  const [code, setCode] = useState(() => Array(CODE_LENGTH).fill(""));
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [emailPromos, setEmailPromos] = useState(false);
  const [confirmAge, setConfirmAge] = useState(false);
  const [errors, setErrors] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  const inputsRef = useRef([]);

  // Countdown for the "Resend in 00:56" line. Ticks once per second, stops at 0.
  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const timerLabel = useMemo(() => {
    const m = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const s = String(secondsLeft % 60).padStart(2, "0");
    return `${m}:${s}`;
  }, [secondsLeft]);

  // ---- Display values (read-only summary of Steps 1 & 2) ----
  const fullName =
    [formData.firstName, formData.lastName].filter(Boolean).join(" ") ||
    formData.fullName ||
    "Not provided";
  const email = formData.email || "Not provided";
  const maskedPassword = "•".repeat(Math.min(formData.password?.length || 8, 12));
  const displayName = formData.displayName || "Not provided";
  const location = formData.location || "Not provided";
  const genres = Array.isArray(formData.favoriteGenres) ? formData.favoriteGenres : [];

  // ---- Verification code input handling ----
  const focusInput = (index) => {
    const el = inputsRef.current[index];
    if (el) {
      el.focus();
      el.select?.();
    }
  };

  const clearCodeError = () => {
    setErrors((prev) => (prev.code ? { ...prev, code: undefined } : prev));
  };

  const handleCodeChange = (index, rawValue) => {
    // Keep only the last digit typed, so overwriting a filled box works.
    const digit = rawValue.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    clearCodeError();
    if (digit && index < CODE_LENGTH - 1) focusInput(index + 1);
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace") {
      if (code[index]) {
        const next = [...code];
        next[index] = "";
        setCode(next);
        clearCodeError();
      } else if (index > 0) {
        event.preventDefault();
        const next = [...code];
        next[index - 1] = "";
        setCode(next);
        focusInput(index - 1);
      }
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusInput(index - 1);
    } else if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      event.preventDefault();
      focusInput(index + 1);
    }
  };

  // Lets the user paste the whole code from their email in one go.
  const handlePaste = (index, event) => {
    const digits = (event.clipboardData.getData("text") || "").replace(/\D/g, "");
    if (!digits) return;
    event.preventDefault();
    const next = [...code];
    for (let i = 0; i < digits.length && index + i < CODE_LENGTH; i += 1) {
      next[index + i] = digits[i];
    }
    setCode(next);
    clearCodeError();
    focusInput(Math.min(index + digits.length, CODE_LENGTH - 1));
  };

  const handleResend = () => {
    if (secondsLeft > 0) return;
    setCode(Array(CODE_LENGTH).fill(""));
    clearCodeError();
    setSecondsLeft(RESEND_SECONDS);
    focusInput(0);
  };

  // ---- Validation ----
  const validate = () => {
    const found = {};
    if (code.some((digit) => digit === "")) {
      found.code = "Enter all 6 digits of your verification code.";
    }
    if (!agreeTerms) {
      found.terms = "Agree to the Terms of Use and Privacy Policy to continue.";
    }
    if (!confirmAge) {
      found.age = "Confirm you are at least 13 years old.";
    }
    return found;
  };

  const handleActivate = (event) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);

    // Any failure: stay on this step and point the user at the problem.
    if (Object.keys(found).length > 0) {
      if (found.code) focusInput(code.findIndex((digit) => digit === ""));
      return;
    }

    onSuccess?.({
      ...formData,
      verificationCode: code.join(""),
      emailPromotions: emailPromos,
    });
  };

  return (
    <div className="confirm">
      <p className="confirm__step-label">Step 3 of 3</p>
      <h1 className="confirm__title">Review &amp; Confirm</h1>
      <p className="confirm__lede">
        Almost there! Verify your details and confirm your email to activate your account.
      </p>

      <ol className="progress">
        <li className="progress__item">
          <span className="progress__marker">1</span>
          <span className="progress__name">Account</span>
        </li>
        <li className="progress__item">
          <span className="progress__marker">2</span>
          <span className="progress__name">Profile</span>
        </li>
        <li className="progress__item progress__item--current">
          <span className="progress__marker">3</span>
          <span className="progress__name">Confirm</span>
        </li>
      </ol>

      <form className="confirm__form" onSubmit={handleActivate} noValidate>
        <section className="summary">
          <header className="summary__head">
            <h2 className="summary__heading">Account details</h2>
            <button type="button" className="summary__edit" onClick={() => onEdit?.(1)}>
              Edit
            </button>
          </header>
          <dl className="summary__list">
            <div className="summary__row">
              <dt>Full name</dt>
              <dd>{fullName}</dd>
            </div>
            <div className="summary__row">
              <dt>Email</dt>
              <dd>{email}</dd>
            </div>
            <div className="summary__row">
              <dt>Password</dt>
              <dd>{maskedPassword}</dd>
            </div>
          </dl>
        </section>

        <section className="summary">
          <header className="summary__head">
            <h2 className="summary__heading">Profile details</h2>
            <button type="button" className="summary__edit" onClick={() => onEdit?.(2)}>
              Edit
            </button>
          </header>
          <dl className="summary__list">
            <div className="summary__row">
              <dt>Display name</dt>
              <dd>{displayName}</dd>
            </div>
            <div className="summary__row">
              <dt>Location</dt>
              <dd>{location}</dd>
            </div>
            <div className="summary__row">
              <dt>Favorite genres</dt>
              <dd className="summary__genres">
                {genres.length > 0 ? (
                  genres.map((genre) => (
                    <span className="chip" key={genre}>
                      {genre}
                    </span>
                  ))
                ) : (
                  <span className="summary__empty">None selected</span>
                )}
              </dd>
            </div>
          </dl>
        </section>

        <p className="notice">
          We sent a 6-digit code to <strong>{email}</strong>. Enter it below to verify your email.
          Didn&apos;t receive it?{" "}
          <button
            type="button"
            className="notice__resend"
            onClick={handleResend}
            disabled={secondsLeft > 0}
          >
            Resend code
          </button>
        </p>

        <fieldset className="code">
          <legend className="code__legend">Verification code</legend>
          <div className="code__boxes">
            {code.map((digit, index) => (
              <input
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                ref={(el) => {
                  inputsRef.current[index] = el;
                }}
                className={`code__box${errors.code ? " code__box--invalid" : ""}`}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
                aria-invalid={Boolean(errors.code)}
                aria-describedby={errors.code ? "code-error" : undefined}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={(e) => handlePaste(index, e)}
              />
            ))}
          </div>

          {errors.code && (
            <p className="field-error" id="code-error" role="alert">
              {errors.code}
            </p>
          )}

          <p className="code__timer">
            {secondsLeft > 0 ? `Resend in ${timerLabel}` : "You can request a new code now"}
          </p>
        </fieldset>

        <div className="consent">
          <label className={`consent__row${errors.terms ? " consent__row--invalid" : ""}`}>
            <input
              type="checkbox"
              checked={agreeTerms}
              aria-invalid={Boolean(errors.terms)}
              onChange={(e) => {
                setAgreeTerms(e.target.checked);
                setErrors((prev) => ({ ...prev, terms: undefined }));
              }}
            />
            <span>
              I agree to FilmVault&apos;s <a href="/terms">Terms of Use</a> and{" "}
              <a href="/privacy">Privacy Policy</a>.
            </span>
          </label>
          {errors.terms && (
            <p className="field-error" role="alert">
              {errors.terms}
            </p>
          )}

          <label className="consent__row">
            <input
              type="checkbox"
              checked={emailPromos}
              onChange={(e) => setEmailPromos(e.target.checked)}
            />
            <span>
              <strong>Email promotions:</strong> Send me news about upcoming movies, exclusive
              deals, and early access tickets.
            </span>
          </label>

          <label className={`consent__row${errors.age ? " consent__row--invalid" : ""}`}>
            <input
              type="checkbox"
              checked={confirmAge}
              aria-invalid={Boolean(errors.age)}
              onChange={(e) => {
                setConfirmAge(e.target.checked);
                setErrors((prev) => ({ ...prev, age: undefined }));
              }}
            />
            <span>
              I confirm I am <strong>at least 13 years old</strong> and the information I provided
              is accurate.
            </span>
          </label>
          {errors.age && (
            <p className="field-error" role="alert">
              {errors.age}
            </p>
          )}
        </div>

        <div className="confirm__actions">
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            Back
          </button>
          <button type="submit" className="btn btn--primary">
            Activate my account
          </button>
        </div>
      </form>
    </div>
  );
}

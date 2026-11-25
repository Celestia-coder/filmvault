// Route: "/forgot-password"
// Customers only. Step 1: enter email -> step 2: enter the emailed code and a new
// password -> step 3: done, back to login.
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import Navbar from "../../components/Navbar.jsx";
import Footer from "../../components/Footer.jsx";
import heroBg from "../../assets/images/hero-bg.png";
import { requestPasswordReset, resetPassword } from "../../api/auth.js";
import "../../styles/Login.css";

const RESEND_SECONDS = 60;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

function ForgotPassword() {
	const navigate = useNavigate();

	const [step, setStep] = useState(1); // 1 email, 2 code + new password, 3 done
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [errors, setErrors] = useState({});
	const [status, setStatus] = useState(null);
	const [busy, setBusy] = useState(false);
	const [cooldown, setCooldown] = useState(0);

	useEffect(() => {
		if (cooldown <= 0) return undefined;
		const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
		return () => clearTimeout(timer);
	}, [cooldown]);

	const networkMessage = (err) =>
		err.status
			? err.message
			: "Unable to reach the server. Please try again.";

	// Step 1 (and "Resend code"): ask for a code.
	const sendCode = async () => {
		setStatus(null);
		if (!EMAIL_PATTERN.test(email.trim())) {
			setErrors({ email: "Enter a valid email address." });
			return false;
		}
		setErrors({});
		setBusy(true);
		try {
			const data = await requestPasswordReset(email.trim());
			setStatus({ type: "success", message: data.message });
			setCooldown(RESEND_SECONDS);
			return true;
		} catch (err) {
			setStatus({ type: "error", message: networkMessage(err) });
			return false;
		} finally {
			setBusy(false);
		}
	};

	const handleEmailSubmit = async (e) => {
		e.preventDefault();
		if (busy) return;
		if (await sendCode()) setStep(2);
	};

	const handleResend = async () => {
		if (busy || cooldown > 0) return;
		setCode("");
		await sendCode();
	};

	// Step 2: verify the code and set the new password.
	const handleResetSubmit = async (e) => {
		e.preventDefault();
		if (busy) return;
		setStatus(null);

		const next = {};
		if (!/^\d{6}$/.test(code))
			next.code = "Enter the 6-digit code from your email.";
		if (password.length < MIN_PASSWORD_LENGTH) {
			next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
		}
		if (confirm !== password) next.confirm = "Passwords don't match.";
		setErrors(next);
		if (Object.keys(next).length > 0) return;

		setBusy(true);
		try {
			await resetPassword({
				email: email.trim(),
				otp: code,
				newPassword: password,
			});
			setStep(3);
		} catch (err) {
			if (err.data?.field === "otp") {
				setErrors({ code: err.message });
			} else if (err.data?.field === "password") {
				setErrors({ password: err.message });
			} else {
				setStatus({ type: "error", message: networkMessage(err) });
			}
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="login-page">
			<div
				className="login-bg"
				style={{ backgroundImage: `url(${heroBg})` }}
			></div>
			<section className="login-hero">
				<Navbar />
				<div className="login-layout">
					<div className="login-intro">
						<h1 className="login-heading">
							RESET
							<br />
							YOUR
							<br />
							<span className="text-red">PASSWORD</span>
						</h1>
						<p className="login-subtext">
							Forgot your password? Enter the email you signed up
							with and we'll send you a 6-digit code to set a new
							one.
						</p>
					</div>

					<div className="login-card">
						<div className="card-top-row">
							<p className="card-eyebrow">
								{step === 3 ? "All Set" : `Step ${step} of 2`}
							</p>
							<Link to="/login" className="card-top-link">
								Back to Login
							</Link>
						</div>

						{step === 1 && (
							<form onSubmit={handleEmailSubmit} noValidate>
								<h2 className="card-title">Forgot Password</h2>
								<p className="card-subtitle">
									We'll email a code if this address has an
									account.
								</p>

								<div className="form-group">
									<label
										className="form-label"
										htmlFor="email"
									>
										Email Address
									</label>
									<div className="input-wrapper">
										<input
											id="email"
											className="form-input"
											style={{ paddingLeft: 14 }}
											type="email"
											placeholder="you@example.com"
											autoComplete="email"
											value={email}
											onChange={(e) =>
												setEmail(e.target.value)
											}
										/>
									</div>
									{errors.email && (
										<p className="field-error">
											{errors.email}
										</p>
									)}
								</div>

								{status && (
									<p
										className={
											"status-message " + status.type
										}
									>
										{status.message}
									</p>
								)}

								<button
									type="submit"
									className="btn-submit"
									disabled={busy}
								>
									{busy ? "Sending…" : "Send code"}
								</button>
							</form>
						)}

						{step === 2 && (
							<form onSubmit={handleResetSubmit} noValidate>
								<h2 className="card-title">Enter Your Code</h2>
								<p className="card-subtitle">
									We sent a 6-digit code to{" "}
									<strong>{email.trim()}</strong>. It expires
									in 10 minutes.
								</p>

								<div className="form-group">
									<label
										className="form-label"
										htmlFor="code"
									>
										Verification Code
									</label>
									<div className="input-wrapper">
										<input
											id="code"
											className="form-input"
											style={{
												paddingLeft: 14,
												letterSpacing: "0.4em",
												fontSize: 20,
											}}
											type="text"
											inputMode="numeric"
											autoComplete="one-time-code"
											placeholder="000000"
											maxLength={6}
											value={code}
											onChange={(e) =>
												setCode(
													e.target.value
														.replace(/\D/g, "")
														.slice(0, 6),
												)
											}
										/>
									</div>
									{errors.code && (
										<p className="field-error">
											{errors.code}
										</p>
									)}
								</div>

								<div className="form-group">
									<label
										className="form-label"
										htmlFor="password"
									>
										New Password
									</label>
									<div className="input-wrapper">
										<input
											id="password"
											className="form-input"
											style={{ paddingLeft: 14 }}
											type="password"
											placeholder="Min. 8 characters"
											autoComplete="new-password"
											value={password}
											onChange={(e) =>
												setPassword(e.target.value)
											}
										/>
									</div>
									{errors.password && (
										<p className="field-error">
											{errors.password}
										</p>
									)}
								</div>

								<div className="form-group">
									<label
										className="form-label"
										htmlFor="confirm"
									>
										Confirm New Password
									</label>
									<div className="input-wrapper">
										<input
											id="confirm"
											className="form-input"
											style={{ paddingLeft: 14 }}
											type="password"
											placeholder="Re-enter new password"
											autoComplete="new-password"
											value={confirm}
											onChange={(e) =>
												setConfirm(e.target.value)
											}
										/>
									</div>
									{errors.confirm && (
										<p className="field-error">
											{errors.confirm}
										</p>
									)}
								</div>

								{status && (
									<p
										className={
											"status-message " + status.type
										}
									>
										{status.message}
									</p>
								)}

								<button
									type="submit"
									className="btn-submit"
									disabled={busy}
								>
									{busy ? "Saving…" : "Reset password"}
								</button>

								<p className="signup-hint">
									Didn't get a code?{" "}
									<a
										href="#resend"
										onClick={(e) => {
											e.preventDefault();
											handleResend();
										}}
										style={
											cooldown > 0 || busy
												? {
														opacity: 0.5,
														pointerEvents: "none",
													}
												: undefined
										}
									>
										{cooldown > 0
											? `Resend in ${cooldown}s`
											: "Resend code"}
									</a>
									{" · "}
									<a
										href="#change-email"
										onClick={(e) => {
											e.preventDefault();
											setErrors({});
											setStatus(null);
											setStep(1);
										}}
									>
										Change email
									</a>
								</p>
							</form>
						)}

						{step === 3 && (
							<div>
								<h2 className="card-title">Password Updated</h2>
								<p className="card-subtitle">
									Your password has been changed. You can now
									log in with your new password.
								</p>
								<button
									type="button"
									className="btn-submit"
									onClick={() =>
										navigate("/login", { replace: true })
									}
								>
									Go to Login
								</button>
							</div>
						)}
					</div>
				</div>
			</section>
			<Footer />
		</div>
	);
}

export default ForgotPassword;

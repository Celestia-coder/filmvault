// TicketVerification.jsx — Admin ticket check from an uploaded e-ticket or a live camera scan
// Route: "/admin/verify"
//
// The admin either drops in the customer's FilmVault e-ticket PDF / QR image, or scans the
// QR with the camera. Either way the QR is decoded in the browser (utils/verifyQr.js), the
// token is checked with the existing GET /api/tickets/verify/:token, and the backend's
// verdict is shown on this page.

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Camera, FileText, ScanQrCode, Upload, X } from "lucide-react";
import "../../styles/Dashboard.css";
import "../../styles/AdminLive.css";
import "../../styles/Ticket.css";
import "../../styles/TicketVerification.css";

import AdminSidebar from "../../components/AdminSidebar.jsx";
import QrScanner from "../../components/QrScanner.jsx";
import VerifyResult from "../../components/VerifyResult.jsx";
import navVerify from "../../assets/images/dashboard/nav-verify.svg";
import { clearUser } from "../../api/session.js";
import { verifyTicket } from "../../api/bookings.js";
import {
	QrError,
	fileKind,
	readTicketQr,
	verifyTokenFromUrl,
} from "../../utils/verifyQr.js";

// Where FilmVault QR codes point: see ticketVerifyUrl in api/bookings.js.
const QR_ORIGINS = [window.location.origin, import.meta.env.VITE_PUBLIC_URL]
	.filter((url) => url && URL.canParse(url))
	.map((url) => new URL(url).origin);

export default function TicketVerification() {
	const inputRef = useRef(null);
	const resultRef = useRef(null);
	const [mode, setMode] = useState("upload"); // "upload" | "camera"
	const [scanning, setScanning] = useState(true); // camera mode: is the scanner running?
	const [scanKey, setScanKey] = useState(0); // remounts the scanner for the next ticket
	const [upload, setUpload] = useState(null); // { file, url, kind }
	const [error, setError] = useState(null);
	const [busy, setBusy] = useState(null); // null, or the loading label while reading/checking
	const [result, setResult] = useState(); // undefined = none yet; null = unknown token; else verifyTicket() data
	const [dragging, setDragging] = useState(false);

	// Free the preview's object URL when the file is replaced/removed or the page closes.
	useEffect(() => () => upload && URL.revokeObjectURL(upload.url), [upload]);

	// The PDF preview is tall; bring the verdict into view.
	useEffect(() => {
		if (result !== undefined)
			resultRef.current?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
	}, [result]);

	function switchMode(next) {
		if (next === mode || busy) return;
		setMode(next);
		setUpload(null);
		setError(null);
		setResult(undefined);
		if (next === "camera") {
			setScanning(true);
			setScanKey((key) => key + 1);
		}
	}

	function pickFile(file) {
		if (!file || busy) return; // a drop mid-check would pair the old verdict with the new file
		setResult(undefined);
		const kind = fileKind(file);
		if (!kind) {
			setError("Unsupported file type. Upload a PDF, PNG or JPG file.");
			return;
		}
		setError(null);
		setUpload({ file, url: URL.createObjectURL(file), kind });
	}

	function removeFile() {
		setUpload(null);
		setError(null);
		setResult(undefined);
	}

	function handleDrop(e) {
		e.preventDefault();
		setDragging(false);
		pickFile(e.dataTransfer.files[0]);
	}

	function handleDragOver(e) {
		e.preventDefault();
		setDragging(true);
	}

	// Only the backend decides validity; a decoded QR alone proves nothing.
	async function checkToken(token) {
		setBusy("Checking ticket…");
		try {
			setResult(await verifyTicket(token));
		} catch (err) {
			if (err.status === 404) setResult(null);
			else
				setError(
					`We couldn't verify this ticket. ${err.message ?? ""} Try again.`.trim(),
				);
		} finally {
			setBusy(null);
		}
	}

	async function handleVerify() {
		if (busy) return;
		if (!upload) {
			setError(
				"No file selected. Upload the customer's e-ticket PDF or QR code image first.",
			);
			return;
		}
		setBusy("Reading QR code…");
		setError(null);
		setResult(undefined);
		let token;
		try {
			token = verifyTokenFromUrl(
				await readTicketQr(upload.file),
				QR_ORIGINS,
			);
		} catch (err) {
			if (!(err instanceof QrError))
				console.error("Ticket QR read failed:", err);
			setError(
				err instanceof QrError
					? err.message
					: "Something went wrong while reading this file. Try again or upload another file.",
			);
			setBusy(null);
			return;
		}
		await checkToken(token);
	}

	// Camera mode: the scanner hands back the raw QR text, then it shuts itself off.
	async function handleScanned(text) {
		setScanning(false);
		setError(null);
		setResult(undefined);
		let token;
		try {
			token = verifyTokenFromUrl(text, QR_ORIGINS);
		} catch (err) {
			if (!(err instanceof QrError))
				console.error("Ticket QR scan failed:", err);
			setError(
				err instanceof QrError
					? err.message
					: "Something went wrong while reading this QR code.",
			);
			return;
		}
		await checkToken(token);
	}

	function scanNext() {
		setError(null);
		setResult(undefined);
		setScanning(true);
		setScanKey((key) => key + 1);
	}

	const dropProps = {
		onDragOver: handleDragOver,
		onDragLeave: () => setDragging(false),
		onDrop: handleDrop,
	};

	return (
		<div className="admin-dashboard">
			<AdminSidebar />

			<div className="admin-main tv-main">
				<header className="admin-header">
					<h1 className="admin-title">
						<img src={navVerify} alt="" />
						<span>
							Ticket <em>Verification</em>
						</span>
					</h1>
					<Link to="/" className="admin-logout" onClick={clearUser}>
						Log Out
					</Link>
				</header>

				<div className="tv-body">
					<section className="tv-intro">
						<h2>Ticket Verification</h2>
						<p>
							Upload the customer's e-ticket PDF or QR code image,
							or scan the QR code with the camera. It's read on
							this device and never uploaded.
						</p>
					</section>

					<section className="tv-card" aria-label="Verify e-ticket">
						<div
							className="tv-tabs"
							role="tablist"
							aria-label="Verification method"
						>
							<button
								type="button"
								role="tab"
								aria-selected={mode === "upload"}
								className={`tv-tab${mode === "upload" ? " tv-tab--active" : ""}`}
								onClick={() => switchMode("upload")}
								disabled={busy}
							>
								<Upload size={16} aria-hidden="true" />
								Upload File
							</button>
							<button
								type="button"
								role="tab"
								aria-selected={mode === "camera"}
								className={`tv-tab${mode === "camera" ? " tv-tab--active" : ""}`}
								onClick={() => switchMode("camera")}
								disabled={busy}
							>
								<Camera size={16} aria-hidden="true" />
								Scan with Camera
							</button>
						</div>

						{mode === "upload" ? (
							<>
								<input
									ref={inputRef}
									id="tv-file"
									type="file"
									accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
									className="tv-input"
									onChange={(e) => {
										pickFile(e.target.files[0]);
										e.target.value = ""; // lets the same file be picked again
									}}
								/>

								{upload ? (
									<div
										className={`tv-preview${dragging ? " tv-dragging" : ""}`}
										{...dropProps}
									>
										<div className="tv-file">
											{upload.kind === "pdf" ? (
												<FileText
													size={20}
													aria-hidden="true"
												/>
											) : null}
											<span className="tv-file-name">
												{upload.file.name}
											</span>
											<div className="tv-file-actions">
												<button
													type="button"
													className="tv-btn"
													onClick={() =>
														inputRef.current.click()
													}
													disabled={busy}
												>
													Replace
												</button>
												<button
													type="button"
													className="tv-btn tv-remove"
													onClick={removeFile}
													disabled={busy}
													aria-label={`Remove ${upload.file.name}`}
												>
													<X
														size={16}
														aria-hidden="true"
													/>
													Remove
												</button>
											</div>
										</div>
										{upload.kind === "pdf" ? (
											<iframe
												className="tv-preview-pdf"
												src={upload.url}
												title="E-ticket PDF preview"
											/>
										) : (
											<img
												className="tv-preview-img"
												src={upload.url}
												alt="Uploaded QR code preview"
											/>
										)}
									</div>
								) : (
									<div
										className={`tv-drop${dragging ? " tv-dragging" : ""}`}
										{...dropProps}
									>
										<Upload size={36} aria-hidden="true" />
										<p className="tv-drop-title">
											Drag and drop the e-ticket here
										</p>
										<p className="tv-drop-hint">
											PDF, PNG or JPG
										</p>
										<button
											type="button"
											className="tv-btn"
											onClick={() =>
												inputRef.current.click()
											}
										>
											Browse files
										</button>
									</div>
								)}

								{error && (
									<p
										className="adm-notice adm-notice--error"
										role="alert"
									>
										{error}
									</p>
								)}

								<button
									type="button"
									className="tv-verify-btn"
									onClick={handleVerify}
									disabled={busy}
								>
									<ScanQrCode size={18} aria-hidden="true" />
									{busy ?? "Verify Ticket"}
								</button>
							</>
						) : (
							<>
								{scanning ? (
									<QrScanner
										key={scanKey}
										onResult={handleScanned}
									/>
								) : (
									<div className="tv-scan-done">
										<ScanQrCode
											size={36}
											aria-hidden="true"
										/>
										<p className="tv-drop-title">
											{busy ?? "Scan complete"}
										</p>
									</div>
								)}

								{error && (
									<p
										className="adm-notice adm-notice--error"
										role="alert"
									>
										{error}
									</p>
								)}

								{!scanning && !busy && (
									<button
										type="button"
										className="tv-verify-btn"
										onClick={scanNext}
									>
										<ScanQrCode
											size={18}
											aria-hidden="true"
										/>
										Scan Next Ticket
									</button>
								)}
							</>
						)}
					</section>

					{result !== undefined && (
						<section
							ref={resultRef}
							className="tv-result"
							aria-label="Verification result"
						>
							<VerifyResult ticket={result} />
						</section>
					)}
				</div>
			</div>
		</div>
	);
}

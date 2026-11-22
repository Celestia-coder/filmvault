// IdPhotoCard.jsx — ID photo input for one discounted seat in Checkout.
// Two ways to provide the photo: upload a file, or take a photo with the camera.
// Either way the result is a File passed to onFile(), so Checkout treats both the same.

import { useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Upload, X } from "lucide-react";

/** Live camera with Capture, then Retake / Use Photo. Calls onUse(file) with the photo. */
function CameraCapture({ seat, onUse }) {
	const videoRef = useRef(null);
	const streamRef = useRef(null);
	const [status, setStatus] = useState("starting"); // starting | live | captured | error
	const [errorMsg, setErrorMsg] = useState("");
	const [shot, setShot] = useState(null); // { file, url }
	const [attempt, setAttempt] = useState(0); // bump to restart the camera

	const stopStream = () => {
		streamRef.current?.getTracks().forEach((t) => t.stop());
		streamRef.current = null;
	};

	// Start the camera (again) whenever `attempt` changes; always release it on cleanup.
	useEffect(() => {
		let cancelled = false;

		(async () => {
			if (!navigator.mediaDevices?.getUserMedia) {
				setErrorMsg(
					"The camera isn't available here. Open the site on localhost or HTTPS.",
				);
				setStatus("error");
				return;
			}
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					video: {
						facingMode: "environment",
						width: { ideal: 1280 },
						height: { ideal: 720 },
					},
					audio: false,
				});
				if (cancelled) {
					stream.getTracks().forEach((t) => t.stop());
					return;
				}
				streamRef.current = stream;
				videoRef.current.srcObject = stream;
				await videoRef.current.play();
				if (!cancelled) setStatus("live");
			} catch (err) {
				if (cancelled) return;
				setErrorMsg(
					err.name === "NotAllowedError"
						? "Camera access was blocked. Allow camera permission and try again."
						: err.name === "NotFoundError"
							? "No camera was found on this device."
							: "The camera couldn't be started. Close other apps using it and try again.",
				);
				setStatus("error");
			}
		})();

		return () => {
			cancelled = true;
			stopStream();
		};
	}, [attempt]);

	// Free the captured photo's preview URL when it's replaced or the card closes.
	useEffect(() => () => shot && URL.revokeObjectURL(shot.url), [shot]);

	const capture = () => {
		const video = videoRef.current;
		if (!video?.videoWidth) return;
		const canvas = document.createElement("canvas");
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		canvas.getContext("2d").drawImage(video, 0, 0);
		canvas.toBlob(
			(blob) => {
				if (!blob) {
					setErrorMsg("Couldn't capture the photo. Try again.");
					setStatus("error");
					return;
				}
				stopStream(); // the photo is taken, so the camera can switch off
				setShot({
					file: new File([blob], `id-photo-${seat}.jpg`, {
						type: "image/jpeg",
					}),
					url: URL.createObjectURL(blob),
				});
				setStatus("captured");
			},
			"image/jpeg",
			0.85,
		);
	};

	const restart = () => {
		setShot(null);
		setErrorMsg("");
		setStatus("starting");
		setAttempt((n) => n + 1);
	};

	return (
		<div className="co-idc-camera">
			<div className="co-idc-view">
				<video
					ref={videoRef}
					className={
						"co-idc-video" +
						(status === "captured" ? " is-hidden" : "")
					}
					muted
					playsInline
				/>
				{status === "captured" && shot && (
					<img
						className="co-idc-video"
						src={shot.url}
						alt="Captured ID"
					/>
				)}
				{status === "live" && (
					<span className="co-idc-frame" aria-hidden="true" />
				)}
				{status === "starting" && (
					<p className="co-idc-overlay">Starting camera…</p>
				)}
				{status === "error" && (
					<p className="co-idc-overlay" role="alert">
						{errorMsg}
					</p>
				)}
			</div>

			{status === "live" && (
				<p className="co-idc-hint">
					Hold the ID flat inside the frame, then press Capture.
				</p>
			)}

			<div className="co-idc-actions">
				{status === "live" && (
					<button
						type="button"
						className="co-idc-btn co-idc-btn--primary"
						onClick={capture}
					>
						<Camera size={16} aria-hidden="true" />
						Capture
					</button>
				)}
				{status === "captured" && (
					<>
						<button
							type="button"
							className="co-idc-btn"
							onClick={restart}
						>
							<RefreshCw size={16} aria-hidden="true" />
							Retake
						</button>
						<button
							type="button"
							className="co-idc-btn co-idc-btn--primary"
							onClick={() => onUse(shot.file)}
						>
							Use Photo
						</button>
					</>
				)}
				{status === "error" && (
					<button
						type="button"
						className="co-idc-btn"
						onClick={restart}
					>
						<RefreshCw size={16} aria-hidden="true" />
						Try again
					</button>
				)}
			</div>
		</div>
	);
}

export default function IdPhotoCard({ seat, file, error, onFile, onRemove }) {
	const inputRef = useRef(null);
	const [mode, setMode] = useState("upload"); // "upload" | "camera"
	const [dragging, setDragging] = useState(false);
	const [previewUrl, setPreviewUrl] = useState(null);

	// Preview URL for whichever file is saved (uploaded or captured).
	useEffect(() => {
		if (!file) {
			setPreviewUrl(null);
			return undefined;
		}
		const url = URL.createObjectURL(file);
		setPreviewUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [file]);

	const handleDrop = (e) => {
		e.preventDefault();
		setDragging(false);
		onFile(e.dataTransfer.files?.[0]);
	};

	const handleReplace = () => {
		onRemove();
		if (mode === "upload") inputRef.current?.click();
	};

	return (
		<div className="co-idc">
			<div
				className="co-idc-tabs"
				role="tablist"
				aria-label={`ID photo method for seat ${seat}`}
			>
				<button
					type="button"
					role="tab"
					aria-selected={mode === "upload"}
					className={
						"co-idc-tab" +
						(mode === "upload" ? " co-idc-tab--active" : "")
					}
					onClick={() => setMode("upload")}
				>
					<Upload size={16} aria-hidden="true" />
					Upload File
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={mode === "camera"}
					className={
						"co-idc-tab" +
						(mode === "camera" ? " co-idc-tab--active" : "")
					}
					onClick={() => setMode("camera")}
				>
					<Camera size={16} aria-hidden="true" />
					Take Photo
				</button>
			</div>

			<input
				ref={inputRef}
				type="file"
				accept=".jpg,.jpeg,.png,.webp"
				hidden
				onChange={(e) => {
					onFile(e.target.files?.[0]);
					e.target.value = ""; // lets the same file be picked again
				}}
			/>

			{file ? (
				<div className="co-idc-preview">
					<div className="co-idc-file">
						<span className="co-idc-file-name">✓ {file.name}</span>
						<div className="co-idc-file-actions">
							<button
								type="button"
								className="co-idc-btn"
								onClick={handleReplace}
							>
								Replace
							</button>
							<button
								type="button"
								className="co-idc-btn"
								onClick={onRemove}
								aria-label={`Remove ID photo for seat ${seat}`}
							>
								<X size={16} aria-hidden="true" />
								Remove
							</button>
						</div>
					</div>
					{previewUrl && (
						<img
							className="co-idc-preview-img"
							src={previewUrl}
							alt={`ID photo for seat ${seat}`}
						/>
					)}
				</div>
			) : mode === "upload" ? (
				<div
					className={"co-idc-drop" + (dragging ? " dragging" : "")}
					onDragOver={(e) => {
						e.preventDefault();
						setDragging(true);
					}}
					onDragLeave={() => setDragging(false)}
					onDrop={handleDrop}
				>
					<Upload size={32} aria-hidden="true" />
					<p className="co-idc-drop-title">
						Drag and drop the ID photo here
					</p>
					<p className="co-idc-drop-hint">
						JPG, PNG or WebP · max 5 MB
					</p>
					<button
						type="button"
						className="co-idc-btn"
						onClick={() => inputRef.current?.click()}
					>
						Browse files
					</button>
				</div>
			) : (
				<CameraCapture seat={seat} onUse={onFile} />
			)}

			{error && <p className="co-error">{error}</p>}
		</div>
	);
}

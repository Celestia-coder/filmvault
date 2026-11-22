// QrScanner.jsx — live webcam QR reader for the admin ticket check.
// Reads frames from the camera, decodes them with jsQR, and calls onResult(text) once.
// The camera is stopped as soon as a code is read or the component unmounts.

import { useEffect, useRef, useState } from "react";

const SCAN_INTERVAL_MS = 120; // ~8 reads per second is plenty and keeps phones cool
const MAX_SIDE = 800; // downscale frames before decoding; jsQR doesn't need HD

export default function QrScanner({ onResult }) {
	const videoRef = useRef(null);
	const canvasRef = useRef(null);
	const onResultRef = useRef(onResult);
	const [error, setError] = useState(null);
	const [ready, setReady] = useState(false);

	// Always call the latest handler without restarting the camera.
	useEffect(() => {
		onResultRef.current = onResult;
	}, [onResult]);

	useEffect(() => {
		let cancelled = false;
		let stream = null;
		let rafId = 0;
		let lastScan = 0;

		function stop() {
			cancelAnimationFrame(rafId);
			stream?.getTracks().forEach((track) => track.stop());
			stream = null;
		}

		async function start() {
			if (!navigator.mediaDevices?.getUserMedia) {
				setError(
					"The camera isn't available here. It needs HTTPS (or localhost) and a supported browser.",
				);
				return;
			}
			try {
				const [{ default: jsQR }, media] = await Promise.all([
					import("jsqr"),
					navigator.mediaDevices.getUserMedia({
						video: {
							facingMode: "environment",
							width: { ideal: 1280 },
							height: { ideal: 720 },
						},
						audio: false,
					}),
				]);
				if (cancelled) {
					media.getTracks().forEach((track) => track.stop());
					return;
				}
				stream = media;
				const video = videoRef.current;
				video.srcObject = stream;
				await video.play();
				setReady(true);

				const tick = (now) => {
					if (cancelled) return;
					rafId = requestAnimationFrame(tick);
					if (now - lastScan < SCAN_INTERVAL_MS) return;
					lastScan = now;
					if (
						video.readyState < video.HAVE_ENOUGH_DATA ||
						!video.videoWidth
					)
						return;

					const scale = Math.min(
						1,
						MAX_SIDE /
							Math.max(video.videoWidth, video.videoHeight),
					);
					const width = Math.round(video.videoWidth * scale);
					const height = Math.round(video.videoHeight * scale);
					const canvas = canvasRef.current;
					canvas.width = width;
					canvas.height = height;
					const ctx = canvas.getContext("2d", {
						willReadFrequently: true,
					});
					ctx.drawImage(video, 0, 0, width, height);
					const code = jsQR(
						ctx.getImageData(0, 0, width, height).data,
						width,
						height,
						{
							inversionAttempts: "dontInvert",
						},
					);
					if (code?.data) {
						cancelled = true; // one result per mount
						stop();
						onResultRef.current(code.data);
					}
				};
				rafId = requestAnimationFrame(tick);
			} catch (err) {
				if (cancelled) return;
				if (err.name === "NotAllowedError") {
					setError(
						"Camera access was blocked. Allow the camera in your browser settings and try again.",
					);
				} else if (
					err.name === "NotFoundError" ||
					err.name === "OverconstrainedError"
				) {
					setError("No camera was found on this device.");
				} else {
					setError(
						"The camera couldn't be started. Close other apps using it and try again.",
					);
				}
			}
		}

		start();
		return () => {
			cancelled = true;
			stop();
		};
	}, []);

	return (
		<div className="tv-scanner">
			<video
				ref={videoRef}
				className="tv-scanner-video"
				muted
				playsInline
			/>
			<canvas ref={canvasRef} hidden />
			{!error && <div className="tv-scan-frame" aria-hidden="true" />}
			{!error && (
				<p className="tv-scan-hint" role="status">
					{ready
						? "Hold the ticket's QR code inside the frame"
						: "Starting camera…"}
				</p>
			)}
			{error && (
				<p
					className="adm-notice adm-notice--error tv-scan-error"
					role="alert"
				>
					{error}
				</p>
			)}
		</div>
	);
}

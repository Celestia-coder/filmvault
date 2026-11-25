// Google sign-in, rendered by Google Identity Services.
// Needs VITE_GOOGLE_CLIENT_ID in the frontend .env. No npm package: the script
// is loaded from Google the first time a button mounts.
//
// Keep your own button design: pass it as children and Google's real button is
// laid invisibly over it, so the click still goes to Google.
//
//   <GoogleButton onCredential={(idToken) => ...} onError={(message) => ...}>
//     <button type="button" className="btn-google" tabIndex={-1}>...</button>
//   </GoogleButton>
//
// With no children, Google's own button is shown instead.

import { useEffect, useRef, useState } from "react";
import "../styles/GoogleButton.css";

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_BUTTON_WIDTH = 400; // widest Google allows (200-400)
const GOOGLE_BUTTON_HEIGHT = 40; // height of Google's "large" button

let scriptPromise;
function loadGoogleScript() {
	if (window.google?.accounts?.id) return Promise.resolve();

	scriptPromise ??= new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = SCRIPT_SRC;
		script.async = true;
		script.onload = resolve;
		script.onerror = () => {
			scriptPromise = undefined; // allow a retry on the next mount
			reject(new Error("Could not load Google sign-in."));
		};
		document.head.appendChild(script);
	});

	return scriptPromise;
}

function GoogleButton({
	onCredential,
	onError,
	text = "continue_with",
	children,
}) {
	const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
	console.log("client id:", clientId);
	const wrapRef = useRef(null);
	const slotRef = useRef(null);
	const [failed, setFailed] = useState(false);
	const overlay = Boolean(children);

	// Keep the latest callbacks without re-rendering Google's button.
	const callbacks = useRef({ onCredential, onError });
	callbacks.current = { onCredential, onError };

	useEffect(() => {
		if (!clientId) return undefined;

		let cancelled = false;
		let observer;

		// Stretch Google's invisible button to exactly cover the child button.
		const layout = () => {
			const target = wrapRef.current?.firstElementChild;
			const slot = slotRef.current;
			if (!overlay || !target || !slot) return;

			slot.style.left = `${target.offsetLeft}px`;
			slot.style.top = `${target.offsetTop}px`;
			slot.style.transform = `scale(${target.offsetWidth / GOOGLE_BUTTON_WIDTH}, ${
				target.offsetHeight / GOOGLE_BUTTON_HEIGHT
			})`;
		};

		loadGoogleScript()
			.then(() => {
				if (cancelled || !slotRef.current) return;

				window.google.accounts.id.initialize({
					client_id: clientId,
					callback: (response) => {
						if (response?.credential) {
							callbacks.current.onCredential?.(
								response.credential,
							);
						} else {
							callbacks.current.onError?.(
								"Google sign-in was cancelled.",
							);
						}
					},
				});

				window.google.accounts.id.renderButton(slotRef.current, {
					type: "standard",
					theme: "filled_black",
					size: "large",
					shape: "rectangular",
					text,
					logo_alignment: "center",
					width: overlay ? GOOGLE_BUTTON_WIDTH : 320,
				});

				layout();
				if (
					overlay &&
					wrapRef.current &&
					typeof ResizeObserver !== "undefined"
				) {
					observer = new ResizeObserver(layout);
					observer.observe(wrapRef.current);
				}
			})
			.catch(() => {
				if (!cancelled) setFailed(true);
			});

		return () => {
			cancelled = true;
			observer?.disconnect();
		};
	}, [clientId, text, overlay]);

	const problem = !clientId
		? "Google sign-in isn't configured (missing VITE_GOOGLE_CLIENT_ID)."
		: failed
			? "Google sign-in couldn't load. Check your connection and refresh."
			: null;

	if (problem) {
		return (
			<>
				{children}
				<p className="field-error">{problem}</p>
			</>
		);
	}

	if (!overlay) {
		return (
			<div
				ref={slotRef}
				style={{
					display: "flex",
					justifyContent: "center",
					minHeight: 44,
				}}
			/>
		);
	}

	return (
		<div className="google-btn-wrap" ref={wrapRef}>
			{children}
			<div className="google-btn-slot" ref={slotRef} />
		</div>
	);
}

export default GoogleButton;

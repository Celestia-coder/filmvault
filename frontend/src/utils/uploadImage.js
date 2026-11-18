// utils/uploadImage.js
// Profile photo helpers: check a picked file in the browser, then upload it.
// The backend (POST /api/upload/profile) stores it on Cloudinary and returns the URL.

const API_URL = "http://localhost:5000";

// Must match profileUpload on the backend (middleware/upload.js).
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AVATAR_MAX_MB = 2;
const AVATAR_MAX_BYTES = AVATAR_MAX_MB * 1024 * 1024;

// Returns an error message, or "" if the file is fine.
export function checkAvatarFile(file) {
	if (!AVATAR_TYPES.includes(file.type)) {
		return "Use a JPG, PNG or WebP image.";
	}
	if (file.size > AVATAR_MAX_BYTES) {
		return `Image must be ${AVATAR_MAX_MB} MB or smaller.`;
	}
	return "";
}

// Sends the file to the backend. Resolves with the permanent image URL.
export async function uploadProfilePhoto(file) {
	const body = new FormData();
	body.append("image", file); // must match profileUpload.single("image")

	// Don't set Content-Type: the browser adds the multipart boundary itself.
	const res = await fetch(`${API_URL}/api/upload/profile`, {
		method: "POST",
		body,
	});

	let data = {};
	try {
		data = await res.json();
	} catch {
		// not JSON, handled below
	}
	if (!res.ok || !data.url) {
		throw new Error(
			data.message || `Photo upload failed (HTTP ${res.status}).`,
		);
	}
	return data.url;
}

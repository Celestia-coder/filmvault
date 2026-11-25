// services/googleAuthService.js
// Verifies the ID token ("credential") that Google's sign-in button returns.
// Needs GOOGLE_CLIENT_ID and the google-auth-library package:  npm i google-auth-library

class GoogleConfigError extends Error {
	constructor(message) {
		super(message);
		this.name = "GoogleConfigError";
	}
}

function createGoogleVerifier({
	env = process.env,
	// Lazy require: the server still starts if the package isn't installed yet.
	clientFactory = (clientId) => {
		const { OAuth2Client } = require("google-auth-library");
		return new OAuth2Client(clientId);
	},
} = {}) {
	let client;

	// Resolves to { googleId, email, emailVerified, name, givenName, familyName }. Throws if the token is
	// forged, expired, or was issued for a different client ID.
	return async function verifyGoogleIdToken(idToken) {
		const clientId = env.GOOGLE_CLIENT_ID?.trim();
		if (!clientId)
			throw new GoogleConfigError("GOOGLE_CLIENT_ID is not set.");

		client ??= clientFactory(clientId);
		const ticket = await client.verifyIdToken({
			idToken,
			audience: clientId,
		});
		const payload = ticket.getPayload();
		if (!payload?.sub || !payload.email) {
			throw new Error("Google token is missing the account id or email.");
		}
		return {
			googleId: String(payload.sub),
			email: String(payload.email).toLowerCase(),
			emailVerified: payload.email_verified === true,
			name: typeof payload.name === "string" ? payload.name.trim() : "",
			givenName:
				typeof payload.given_name === "string"
					? payload.given_name.trim()
					: "",
			familyName:
				typeof payload.family_name === "string"
					? payload.family_name.trim()
					: "",
		};
	};
}

module.exports = {
	GoogleConfigError,
	createGoogleVerifier,
	verifyGoogleIdToken: createGoogleVerifier(),
};

// utils/authToken.js

const jwt = require("jsonwebtoken");

function signAuthToken(userId) {
	if (!process.env.AUTH_TOKEN_SECRET) {
		throw new Error("AUTH_TOKEN_SECRET is not set");
	}
	return jwt.sign({ userId: Number(userId) }, process.env.AUTH_TOKEN_SECRET, {
		algorithm: "HS256",
		expiresIn: "8h",
	});
}

module.exports = { signAuthToken };

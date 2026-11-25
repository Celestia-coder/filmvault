// api/authToken.js

const KEY = "filmvault_token";

export const saveToken = (token) => {
	try {
		if (token) localStorage.setItem(KEY, token);
		else localStorage.removeItem(KEY);
	} catch {
		/* storage unavailable: requests just go out without a token */
	}
};

export const getToken = () => {
	try {
		return localStorage.getItem(KEY);
	} catch {
		return null;
	}
};

export const clearToken = () => saveToken(null);
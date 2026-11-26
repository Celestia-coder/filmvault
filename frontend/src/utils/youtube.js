// Turns a YouTube link (watch, youtu.be, shorts or embed) into an embeddable URL.
// Returns null for anything that is not a valid YouTube video link.
export function getYouTubeEmbedUrl(url) {
	if (!url) return null;
	try {
		const u = new URL(url.trim());
		const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
		let id = null;

		if (host === "youtu.be") {
			id = u.pathname.slice(1).split("/")[0];
		} else if (host === "youtube.com" || host === "youtube-nocookie.com") {
			if (u.pathname === "/watch") id = u.searchParams.get("v");
			else {
				const match = u.pathname.match(
					/^\/(?:embed|shorts|v)\/([\w-]{11})/,
				);
				id = match ? match[1] : null;
			}
		}

		return id && /^[\w-]{11}$/.test(id)
			? `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
			: null;
	} catch {
		return null;
	}
}

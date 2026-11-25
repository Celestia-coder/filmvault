// controllers/movieController.js
// Public + admin movie logic (routes decide which is which).

const pool = require("../config/database");
const { parseStatusFilter } = require("../utils/statusFilter");

const VALID_STATUSES = ["upcoming", "now-showing", "ended"];

// Base query: one row per movie, genres collapsed into a comma list
const MOVIE_SELECT = `
  SELECT m.*, GROUP_CONCAT(g.genre_name ORDER BY g.genre_name SEPARATOR ',') AS genres,
         MAX(ob.branch_name) AS created_by_branch_name
  FROM MOVIE m
  LEFT JOIN MOVIE_GENRE mg ON mg.movie_id = m.movie_id
  LEFT JOIN GENRE g ON g.genre_id = mg.genre_id
  LEFT JOIN BRANCH ob ON ob.branch_id = m.created_by_branch_id
`;

const formatMovie = (row) => ({
	...row,
	genres: row.genres ? row.genres.split(",") : [],
});

// Replaces a movie's cast with the given names, reusing existing CAST rows by name.
const saveCast = async (conn, movieId, cast) => {
	const names = [
		...new Set(
			(Array.isArray(cast) ? cast : [])
				.map((n) => String(n).trim())
				.filter(Boolean),
		),
	];
	await conn.query("DELETE FROM MOVIE_CAST WHERE movie_id = ?", [movieId]);
	for (const name of names) {
		const [found] = await conn.query(
			"SELECT cast_id FROM `CAST` WHERE cast_name = ? LIMIT 1",
			[name],
		);
		const castId = found.length
			? found[0].cast_id
			: (
					await conn.query(
						"INSERT INTO `CAST` (cast_name) VALUES (?)",
						[name],
					)
				)[0].insertId;
		await conn.query(
			"INSERT INTO MOVIE_CAST (movie_id, cast_id) VALUES (?, ?)",
			[movieId, castId],
		);
	}
};

// Movies are shared by every branch, but only the branch that created a movie
// may edit or delete it. Branch comes from the verified login token.
const adminBranchId = (req) => {
	const branchId = Number(req.auth?.branchId);
	return Number.isInteger(branchId) && branchId > 0 ? branchId : null;
};

const NOT_OWNER = {
	success: false,
	message: "Only the branch that added this movie can edit or delete it.",
};

// Upcoming scheduled showtimes of a movie in ANY branch, grouped by branch.
// Used to stop one branch from deleting or ending a movie other branches still play.
const upcomingShowtimeBlockers = async (db, movieId) => {
	const [rows] = await db.query(
		`SELECT b.branch_name, COUNT(*) AS upcoming
     FROM SCREENING s
     JOIN CINEMA c ON c.cinema_id = s.cinema_id
     JOIN BRANCH b ON b.branch_id = c.branch_id
     WHERE s.movie_id = ? AND s.deleted_at IS NULL AND s.status = 'scheduled'
       AND TIMESTAMP(s.show_date, s.show_time) >= NOW()
     GROUP BY b.branch_id, b.branch_name
     ORDER BY b.branch_name`,
		[movieId],
	);
	return rows;
};

const describeBlockers = (rows) =>
	rows.map((r) => `${r.branch_name} (${r.upcoming})`).join(", ");

// GET /api/movies?status=now-showing,upcoming  (status is optional)
const getAllMovies = async (req, res) => {
	const { statuses, error } = parseStatusFilter(req.query.status);
	if (error) {
		return res.status(400).json({ success: false, message: error });
	}

	const conditions = ["m.deleted_at IS NULL"];
	const params = [];
	if (statuses.length) {
		conditions.push("m.status IN (?)");
		params.push(statuses);
	}
	const where = `WHERE ${conditions.join(" AND ")}`;

	try {
		const [rows] = await pool.query(
			`${MOVIE_SELECT} ${where} GROUP BY m.movie_id ORDER BY m.movie_id`,
			params,
		);
		return res
			.status(200)
			.json({ success: true, movies: rows.map(formatMovie) });
	} catch (error) {
		console.error("getAllMovies error:", error);
		return res
			.status(500)
			.json({ success: false, message: "Failed to fetch movies." });
	}
};

// GET /api/movies/:id
const getMovieById = async (req, res) => {
	const id = Number(req.params.id);
	if (!Number.isInteger(id) || id <= 0) {
		return res
			.status(400)
			.json({ success: false, message: "Invalid movie ID." });
	}

	try {
		const [rows] = await pool.query(
			`${MOVIE_SELECT} WHERE m.movie_id = ? AND m.deleted_at IS NULL GROUP BY m.movie_id`,
			[id],
		);
		if (rows.length === 0) {
			return res
				.status(404)
				.json({ success: false, message: "Movie not found." });
		}

		// Cast lives in a separate many-to-many table (CAST is a reserved word, hence the backticks).
		const [castRows] = await pool.query(
			`SELECT c.cast_name
       FROM MOVIE_CAST mc
       JOIN \`CAST\` c ON c.cast_id = mc.cast_id
       WHERE mc.movie_id = ?
       ORDER BY c.cast_id`,
			[id],
		);

		return res.status(200).json({
			success: true,
			movie: {
				...formatMovie(rows[0]),
				cast: castRows.map((r) => r.cast_name),
			},
		});
	} catch (error) {
		console.error("getMovieById error:", error);
		return res
			.status(500)
			.json({ success: false, message: "Failed to fetch movie." });
	}
};

// POST /api/admin/movies
const createMovie = async (req, res) => {
	const branchId = adminBranchId(req);
	if (!branchId) {
		return res
			.status(403)
			.json({ success: false, message: "Admin access required." });
	}
	const {
		title,
		synopsis,
		duration,
		ageRating,
		language,
		price,
		poster,
		director,
		releaseDate,
		status,
		trailerUrl,
		genres,
		cast,
	} = req.body;

	if (
		!title ||
		!director ||
		!price ||
		!duration ||
		!status ||
		!Array.isArray(genres) ||
		genres.length === 0
	) {
		return res.status(400).json({
			success: false,
			message:
				"title, director, price, duration, status, and at least one genre are required.",
		});
	}
	if (Number(price) <= 0 || Number(duration) <= 0) {
		return res.status(400).json({
			success: false,
			message: "price and duration must be greater than 0.",
		});
	}
	if (!VALID_STATUSES.includes(status)) {
		return res.status(400).json({
			success: false,
			message: `status must be one of: ${VALID_STATUSES.join(", ")}.`,
		});
	}

	let conn;
	try {
		conn = await pool.getConnection();

		const [genreRows] = await conn.query(
			"SELECT genre_id, genre_name FROM GENRE WHERE genre_name IN (?)",
			[genres],
		);
		if (genreRows.length !== genres.length) {
			return res
				.status(400)
				.json({
					success: false,
					message: "One or more genres do not exist.",
				});
		}

		await conn.beginTransaction();

		const [result] = await conn.query(
			`INSERT INTO MOVIE
        (title, synopsis, duration, age_rating, language, base_price,
         poster, director, release_date, status, trailer_url, created_by_branch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				title,
				synopsis || null,
				duration,
				ageRating || null,
				language || null,
				price,
				poster || null,
				director,
				releaseDate || null,
				status,
				trailerUrl || null,
				branchId,
			],
		);

		const movieId = result.insertId;
		await conn.query(
			"INSERT INTO MOVIE_GENRE (movie_id, genre_id) VALUES ?",
			[genreRows.map((g) => [movieId, g.genre_id])],
		);
		await saveCast(conn, movieId, cast);

		await conn.commit();

		return res.status(201).json({
			success: true,
			message: "Movie created.",
			movie: { movieId, title, director, status, genres },
		});
	} catch (error) {
		if (conn) await conn.rollback();
		console.error("createMovie error:", error);
		return res
			.status(500)
			.json({ success: false, message: "Failed to create movie." });
	} finally {
		if (conn) conn.release();
	}
};

// PUT /api/admin/movies/:id
const updateMovie = async (req, res) => {
	const branchId = adminBranchId(req);
	if (!branchId) {
		return res
			.status(403)
			.json({ success: false, message: "Admin access required." });
	}
	const id = Number(req.params.id);
	if (!Number.isInteger(id) || id <= 0) {
		return res
			.status(400)
			.json({ success: false, message: "Invalid movie ID." });
	}

	const {
		title,
		synopsis,
		duration,
		ageRating,
		language,
		price,
		poster,
		director,
		releaseDate,
		status,
		trailerUrl,
		genres,
		cast,
	} = req.body;

	if (
		!title ||
		!director ||
		!price ||
		!duration ||
		!status ||
		!Array.isArray(genres) ||
		genres.length === 0
	) {
		return res.status(400).json({
			success: false,
			message:
				"title, director, price, duration, status, and at least one genre are required.",
		});
	}
	if (Number(price) <= 0 || Number(duration) <= 0) {
		return res.status(400).json({
			success: false,
			message: "price and duration must be greater than 0.",
		});
	}
	if (!VALID_STATUSES.includes(status)) {
		return res.status(400).json({
			success: false,
			message: `status must be one of: ${VALID_STATUSES.join(", ")}.`,
		});
	}

	let conn;
	try {
		conn = await pool.getConnection();

		const [existing] = await conn.query(
			"SELECT movie_id, created_by_branch_id, status FROM MOVIE WHERE movie_id = ? AND deleted_at IS NULL",
			[id],
		);
		if (existing.length === 0) {
			return res
				.status(404)
				.json({ success: false, message: "Movie not found." });
		}
		if (Number(existing[0].created_by_branch_id) !== branchId) {
			return res.status(403).json(NOT_OWNER);
		}

		// "Ended" hides the movie from every branch, so it can't be set while any
		// branch still has an upcoming showtime.
		if (status === "ended" && existing[0].status !== "ended") {
			const blocking = await upcomingShowtimeBlockers(conn, id);
			if (blocking.length > 0) {
				return res.status(409).json({
					success: false,
					message:
						`Cannot set this movie to Ended yet: upcoming showtimes remain at ${describeBlockers(blocking)}. ` +
						"Ask that branch to remove them first.",
					blockingBranches: blocking.map((r) => r.branch_name),
				});
			}
		}

		const [genreRows] = await conn.query(
			"SELECT genre_id, genre_name FROM GENRE WHERE genre_name IN (?)",
			[genres],
		);
		if (genreRows.length !== genres.length) {
			return res
				.status(400)
				.json({
					success: false,
					message: "One or more genres do not exist.",
				});
		}

		await conn.beginTransaction();

		await conn.query(
			`UPDATE MOVIE SET
         title = ?, synopsis = ?, duration = ?, age_rating = ?, language = ?,
         base_price = ?, poster = ?, director = ?, release_date = ?, status = ?, trailer_url = ?
       WHERE movie_id = ?`,
			[
				title,
				synopsis || null,
				duration,
				ageRating || null,
				language || null,
				price,
				poster || null,
				director,
				releaseDate || null,
				status,
				trailerUrl || null,
				id,
			],
		);

		// Simplest correct way to sync genres: wipe and re-insert rather than diffing.
		await conn.query("DELETE FROM MOVIE_GENRE WHERE movie_id = ?", [id]);
		await conn.query(
			"INSERT INTO MOVIE_GENRE (movie_id, genre_id) VALUES ?",
			[genreRows.map((g) => [id, g.genre_id])],
		);
		await saveCast(conn, id, cast);

		await conn.commit();

		return res.status(200).json({
			success: true,
			message: "Movie updated.",
			movie: { movieId: id, title, director, status, genres },
		});
	} catch (error) {
		if (conn) await conn.rollback();
		console.error("updateMovie error:", error);
		return res
			.status(500)
			.json({ success: false, message: "Failed to update movie." });
	} finally {
		if (conn) conn.release();
	}
};

// DELETE /api/admin/movies/:id
// Soft-deletes the movie (sets deleted_at), preserving historical bookings/tickets.
// Only the owning branch may delete, and only when no branch still has an
// upcoming scheduled showtime for it. Showtimes that already played don't block.
const deleteMovie = async (req, res) => {
	const branchId = adminBranchId(req);
	if (!branchId) {
		return res
			.status(403)
			.json({ success: false, message: "Admin access required." });
	}
	const id = Number(req.params.id);
	if (!Number.isInteger(id) || id <= 0) {
		return res
			.status(400)
			.json({ success: false, message: "Invalid movie ID." });
	}

	try {
		const [existing] = await pool.query(
			"SELECT movie_id, deleted_at, created_by_branch_id FROM MOVIE WHERE movie_id = ?",
			[id],
		);
		if (existing.length === 0 || existing[0].deleted_at !== null) {
			return res
				.status(404)
				.json({ success: false, message: "Movie not found." });
		}
		if (Number(existing[0].created_by_branch_id) !== branchId) {
			return res.status(403).json(NOT_OWNER);
		}

		const blocking = await upcomingShowtimeBlockers(pool, id);
		if (blocking.length > 0) {
			return res.status(409).json({
				success: false,
				message:
					`Cannot delete this movie yet: upcoming showtimes remain at ${describeBlockers(blocking)}. ` +
					"Ask that branch to remove them first.",
				blockingBranches: blocking.map((r) => r.branch_name),
			});
		}

		await pool.query(
			"UPDATE MOVIE SET deleted_at = NOW() WHERE movie_id = ?",
			[id],
		);

		return res
			.status(200)
			.json({ success: true, message: "Movie deleted." });
	} catch (error) {
		console.error("deleteMovie error:", error);
		return res
			.status(500)
			.json({ success: false, message: "Failed to delete movie." });
	}
};

module.exports = {
	getAllMovies,
	getMovieById,
	createMovie,
	updateMovie,
	deleteMovie,
};

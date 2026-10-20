// api/movies.js
// All movie/showtime/branch requests live here, and so does the ONE place where
// the API's snake_case response is mapped to the shape the pages use.
//
//   API (DB column)        ->  Page field
//   movie_id               ->  id
//   poster (path/URL)      ->  poster (resolved image URL)
//   duration (minutes)     ->  runtime ("2h 5m")
//   age_rating             ->  rating + restriction { code, label }
//   release_date           ->  releaseDate ("Jun 13, 2025")
//   base_price             ->  price (number)
//   genres (array)         ->  genres (array)
//   cast (array of names)  ->  cast (array of names)

import placeholderPoster from "../assets/images/movie-poster.webp";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

// Home/Movies only list these; "ended" movies stay out of the public grid.
export const PUBLIC_STATUSES = "now-showing,upcoming";

export const STATUS_LABELS = {
  "now-showing": "Now Showing",
  upcoming: "Coming Soon",
  ended: "Ended",
};

const RATING_LABELS = {
  G: "General Audiences",
  PG: "Parental Guidance",
  "PG-13": "Parents Strongly Cautioned",
  R: "Restricted",
  "R-13": "Restricted to 13 and above",
  "R-16": "Restricted to 16 and above",
  "R-18": "Restricted to 18 and above",
};

/* ------------------------------ errors + fetch ----------------------------- */

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status; // 0 = network failure, otherwise the HTTP status
  }
}

async function request(path, { signal, params } = {}) {
  const query = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, value]) => value)
  ).toString();

  let response;
  try {
    response = await fetch(`${API_BASE}${path}${query ? `?${query}` : ""}`, { signal });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }

  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    throw new ApiError(body?.message || "Something went wrong.", response.status);
  }
  return body;
}

/* --------------------------------- mappers --------------------------------- */

// Poster values in the DB are paths like "/images/foo.jpg". Match by filename
// against the images bundled in src/assets/images/movies; fall back to a placeholder.
const bundledPosters = import.meta.glob("../assets/images/movies/*.{jpg,jpeg,png,webp}", {
  eager: true,
  import: "default",
});
const postersByFilename = Object.fromEntries(
  Object.entries(bundledPosters).map(([path, url]) => [path.split("/").pop().toLowerCase(), url])
);

function resolvePoster(poster) {
  if (!poster) return placeholderPoster;
  if (/^https?:\/\//i.test(poster)) return poster;
  return postersByFilename[poster.split("/").pop().toLowerCase()] ?? placeholderPoster;
}

function formatRuntime(minutes) {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total <= 0) return "TBA";
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins}m`;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
}

// Dates arrive as "YYYY-MM-DD" strings (backend uses dateStrings), so build the
// Date from parts to avoid a timezone shift.
export function formatDate(value) {
  if (!value) return "TBA";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
}

function mapMovie(raw) {
  const code = raw.age_rating || "NR";
  return {
    id: raw.movie_id,
    title: raw.title,
    synopsis: raw.synopsis ?? "",
    poster: resolvePoster(raw.poster),
    genres: Array.isArray(raw.genres) ? raw.genres : [],
    runtime: formatRuntime(raw.duration),
    releaseDate: formatDate(raw.release_date),
    director: raw.director || "TBA",
    rating: code,
    restriction: { code, label: RATING_LABELS[code] ?? "" },
    language: raw.language ?? "",
    price: Number(raw.base_price),
    status: raw.status,
    cast: Array.isArray(raw.cast) ? raw.cast : [],
  };
}

function mapShowtime(raw) {
  return {
    id: raw.showtime_id,
    branchName: raw.branch_name,
    cinemaNum: raw.cinema_num,
    date: raw.show_date,
    time: raw.show_time,
    seatsAvailable: raw.seatsAvailable,
    status: raw.status,
  };
}

/* -------------------------------- endpoints -------------------------------- */

// Home grid: GET /api/movies   (filters present -> GET /api/movies/search)
export async function fetchMovies({ title, genre, branch } = {}, signal) {
  const hasFilters = Boolean(title || genre || branch);
  const body = await request(hasFilters ? "/api/movies/search" : "/api/movies", {
    signal,
    params: { title, genre, branch, status: PUBLIC_STATUSES },
  });
  return body.movies.map(mapMovie);
}

// Movie page: GET /api/movies/:id
export async function fetchMovie(id, signal) {
  const body = await request(`/api/movies/${id}`, { signal });
  return mapMovie(body.movie);
}

// Movie page: GET /api/movies/:id/showtimes  (each has seatsAvailable)
export async function fetchShowtimes(id, signal) {
  const body = await request(`/api/movies/${id}/showtimes`, { signal });
  return body.showtimes.map(mapShowtime);
}

// Branch filter options: GET /api/branches/search (no name = all branches)
export async function fetchBranches(signal) {
  const body = await request("/api/branches/search", { signal });
  return body.branches.map((branch) => branch.branch_name);
}

// utils/statusFilter.js
// Shared parser for the optional ?status= query param on movie endpoints.
// Accepts one or more comma-separated statuses, e.g. ?status=now-showing,upcoming

const VALID_STATUSES = ["upcoming", "now-showing", "ended"];

// Returns { statuses } (empty array = no filter) or { error } for a 400 response.
const parseStatusFilter = (raw) => {
  if (raw === undefined || raw === "") return { statuses: [] };

  const statuses = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (statuses.length === 0 || statuses.some((s) => !VALID_STATUSES.includes(s))) {
    return {
      error: `status must be one or more of: ${VALID_STATUSES.join(", ")} (comma-separated).`,
    };
  }
  return { statuses };
};

module.exports = { parseStatusFilter };

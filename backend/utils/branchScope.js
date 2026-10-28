// utils/branchScope.js
// Shared parser for the ?branchId= param on admin endpoints.
//
// There's no real auth yet, so the admin's branch is passed explicitly.
// Once login sessions exist, swap this for the logged-in admin's
// USER.branch_id instead of trusting the query string.

// Returns { branchId } (null = not provided) or { error } for a 400 response.
const parseBranchId = (raw, { required = false } = {}) => {
  if (raw === undefined || raw === "") {
    return required ? { error: "branchId is required." } : { branchId: null };
  }
  const branchId = Number(raw);
  if (!Number.isInteger(branchId) || branchId <= 0) {
    return { error: "branchId must be a positive integer." };
  }
  return { branchId };
};

module.exports = { parseBranchId };

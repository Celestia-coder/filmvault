// Email-only adapter for a future backend authentication middleware.
// Only trusted server middleware may set req.auth from a verified session or
// token and the current USER record. Never copy request body/query/header
// identity fields or frontend localStorage into this property.
const positiveId = (value) => Number.isSafeInteger(value) && value > 0;

function notificationCustomer(req) {
  const auth = req?.auth;
  if (!positiveId(auth?.userId) || auth.role !== "customer" ||
      (auth.branchId !== null && !positiveId(auth.branchId))) return null;
  return { verified: true, userId: auth.userId };
}

function notificationAdmin(req) {
  const auth = req?.auth;
  if (!positiveId(auth?.userId) || auth.role !== "admin" || !positiveId(auth.branchId)) return null;
  return { verified: true, userId: auth.userId, role: "admin", branchId: auth.branchId };
}

module.exports = { notificationCustomer, notificationAdmin };

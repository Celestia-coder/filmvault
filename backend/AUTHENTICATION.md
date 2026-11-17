# Authentication on FE/email-qa-integration

`POST /api/auth/login` verifies the existing bcrypt password and returns a
15-minute HS256 bearer token alongside its existing `user` response. Set a
random `AUTH_TOKEN_SECRET` of at least 32 bytes in a private backend environment
or secret manager before testing login; there is no default secret. Never use
SMTP credentials as the signing secret. The frontend keeps the token in
`sessionStorage` and sends `Authorization: Bearer <token>` on protected calls.
The browser's stored user object is only for UI display, never authorization.

`middleware/authenticate.js` verifies signature, issuer, audience, expiration,
and the current password, role, and branch version. Every protected request loads the
current `USER` row and sets `req.auth = { userId, role, branchId }` from that row.
Password, role, or branch changes invalidate old tokens; the profile update
returns a new one.
Missing secret, token, account, or valid admin branch fails closed. The login
and registration routes remain public. The ticket QR verifier is intentionally
public and requires its separate privacy review.

The booking, ticket-list/detail, seat-hold, profile, and admin routes now require
the appropriate verified role. Checkout uses `req.auth.userId`; a conflicting
browser `userId` is rejected. Admin booking, ID-image, and seat operations use
`req.auth.branchId`, never `?branchId=`. Showtime create/update/delete check
the cinema's stored branch; a cross-branch update is rejected before commit.
The global MOVIE catalog has no branch ownership column, so its write routes
are admin-only; Triselle and the Backend Team must decide whether movie editing
requires a different branch policy.

This is a short-lived stateless token, not a durable server-side session.
Clearing the browser token signs out that browser, but cannot revoke a copied
token before expiration unless the password changes. Use HTTPS for deployment,
review XSS protections because sessionStorage is readable by page scripts,
and agree on login rate limiting and production secret rotation before live
customer delivery. The optional `VITE_API_URL` must point to the same trusted
backend that issued the token. No automatic email flag is enabled by auth.

The automated `npm test` suite uses fictional USER rows, mocked transactions,
and fake email transports; it does not connect to MySQL or SMTP. A separate,
manually invoked integration run completed 17 checks against the isolated
`filmvault_email_e2e_test` database on `127.0.0.1:3307`. It verified customer
and both branch-admin logins, rejected credentials and tokens, booking ownership,
branch-scoped cancellation and rescheduling, and token revocation after a
fictional password change. The three resulting notifications were captured by
an injected fake sender. This was not an application-triggered SMTP test or a
test against an existing FilmVault database. The local provisioning scripts and
result reports are test artifacts and should stay out of the integration commit.

Before customer-facing deployment, configure the signing secret and trusted
database connection, review login abuse protection and token storage, and keep
the separate email-delivery gates disabled until the notification limitations
in `EMAIL_NOTIFICATIONS.md` are resolved.

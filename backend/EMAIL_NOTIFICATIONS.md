# Email notifications

`services/emailService.js` imports the existing
`frontend/src/email/emailTemplates.js` with Node's dynamic ESM import. A backend
deployment must include that template file and `frontend/package.json` (which
declares the module type). No separate backend copy of the designs exists.

Start with `EMAIL_DELIVERY_ENABLED=false` and
`RESCHEDULE_NOTIFICATIONS_ENABLED=false` as shown in `.env.example`. SMTP
settings and `MAIL_FROM` are validated only when real delivery is enabled.
The normal backend pool uses `DB_HOST`, `DB_PORT` (default 3306), `DB_USER`,
`DB_PASS`, and `DB_NAME`. Set these for a separately authorized local database;
the Vite development proxy expects the backend on port 5000.
`npm test` uses a fake mail transport and mocked database; it needs neither
SMTP credentials nor MySQL. A future trusted caller may pass an approved
public HTTPS `logoUrl`. Confirmation preparation selects `MOVIE.poster` from
the committed booking's movie and uses it only when it is a direct HTTPS image
URL on the seeded `image.tmdb.org` CDN or on this deployment's configured
`CLOUDINARY_CLOUD_NAME` image host. Local filenames and other hosts omit
the image; no deployment asset origin has been approved for them. An email
client can also block or fail to fetch a remote poster, leaving the movie title
readable. Booking Confirmation attaches the tracked
`frontend/src/assets/images/logo.png` as an inline CID image. If the asset is
unavailable, the template displays the FILMVAULT text fallback. A backend
deployment must include the frontend asset for the original logo to appear.
The QR integration below supplies a verification `ticketUrl` only from committed
purchase data. No local asset path is embedded in outgoing mail.

The integration branch now verifies a signed token, resolves the current USER
role and branch, and populates `req.auth` on protected routes. See
`AUTHENTICATION.md`. The browser's `branchId` is not proof of authorization.
Checkout pre-fills the signed-in account email. If the form submits an address,
the booking controller checks its syntax and compares it with the current
`USER.email` read inside the booking transaction before payment. A different
address is rejected; older API callers that omit the field still use the saved
account address. Confirmation, cancellation, and reschedule recipients are
read from `USER.email`, not a browser-supplied address. The existing signup
code does not verify mailbox ownership, and changing the profile email can
change the destination of later notices. Alternate checkout recipients require
a separate verified-email design and a purchase-level recipient record.
The account-email policy needs no new column. A fresh database built from
`database/schema.sql` alone still lacks checkout columns and Eli's
`verification_token`, which the current booking INSERT requires even when QR
mail is off. The existing compatibility and ticket-verification SQL contain
`USE filmvault` and additional data operations; review and adapt them for the
intended database rather than running them unchanged on a test or team schema.
Live reschedule mail remains disabled pending database-backed concurrency
verification and the cinema seat policy described below.

For a changed schedule, the controller holds the screening's `FOR UPDATE` lock
and asks the notifier to read confirmed, paid purchases for that screening and
branch on the *same transaction connection before the UPDATE*. Recipients come
from `USER.email`, never the request body. SMTP runs only after commit and after
that connection is released. An unchanged request does not read recipients or
send mail. Cinema changes remain allowed by the existing scheduling endpoint,
but notifications for them are suppressed until seat validity is resolved:
existing `TICKET.seat_id` values may still point to seats in the previous
cinema after `SCREENING.cinema_id` changes. The Backend Team must decide how
to validate or reassign seats before those notices can be enabled.

The pre-update recipient snapshot excludes customers who book the updated
schedule after the update commits. Checkout now locks the same `SCREENING` row
before validating and completing a booking. An in-flight checkout should
therefore commit before the reschedule snapshot or wait and book the updated
schedule. This ordering has an offline controller check but still needs a
concurrent test against isolated MySQL. Real reschedule delivery remains
disabled until that test and the cinema seat policy are reviewed. The branch
already provides verified admin identity and branch checks.

Repeated unchanged schedule requests do not send another notice: the locked
screening is compared before creating a notification event. A random UUID
identifies each actual update. The notifier groups ticket rows by purchase ID,
so a purchase gets one attempt even with multiple seats, while two purchases
by the same customer get separate notices. It claims the event and each
purchase in process-local maps before starting delivery; overlapping calls for
that event cannot both send. A schedule-value hash would be a poor event ID because a later
A-to-B change following B-to-A is a new event. The UUID exists only in memory,
so this protection does not survive restarts or coordinate servers. Failed
purchases with a definite SMTP rejection are exposed by the internal
`retryCandidates(eventId)` method for future outbox integration. It does not
resend: the service cannot establish fresh event membership and eligibility
without a durable record and a trusted database check. Do not treat the
in-memory list as a retry queue or exactly-once delivery. The controller returns aggregate `sent`, `failed`, and
`skipped` counts and logs failures without addresses or credentials. SMTP
connection, greeting, and socket timeouts are configured, but the admin
response still waits for all sends; a durable outbox is needed for prompt,
reliable deferred delivery. Do not use fire-and-forget sends.

A minimal future outbox would store a stable event ID and one row per affected
purchase with a unique `(event_id, purchase_id, notification_type)` key,
delivery state, and retry attempts. Create those rows in the showtime transaction,
then deliver after commit. This needs Database Team approval and the booking
serialization rule above; no schema change is part of this feature yet.
The outbox must retain its event ID across process restarts and coordinate
workers with a claim/lease. Store notification type, purchase ID, recipient
identity, a safe payload or source version, delivery state, attempt count,
and timestamps. Before a retry, recheck booking/payment status and recipient
authorization. An SMTP timeout or disconnect may occur after provider
acceptance; do not automatically retry an uncertain outcome. A durable outbox
alone cannot guarantee exactly-once delivery without provider idempotency or
reconciliation. Do not store QR tokens or SMTP credentials in logs.

`bookingNotificationService` prepares confirmation and cancellation messages
from committed `TOTAL_PURCHASE`, `TICKET`, `SCREENING`, and `USER` records. It
checks payment and purchase status, verified actor context, branch ownership,
and recipient syntax. It sends through the existing shared templates and
mailer, with one process-local attempt per notification type and purchase.
Only the internal `retryDefiniteFailure(event)` method may make one additional
attempt after an explicit permanent SMTP `MAIL FROM` or `RCPT TO` rejection.
It re-reads the committed purchase, rechecks the verified actor and payment or
cancellation state, and requires the same trusted recipient. It is not called
by any controller or public endpoint and must not be used for a timeout,
connection loss, unknown transport error, or a send that succeeded. A failed
or unavailable template and disabled delivery make no transport attempt.
This bounded in-process retry is a development/service interface, not a
durable production retry mechanism.
The fake-transport tests exercise both messages without customer data or SMTP.

Both booking controllers have guarded post-commit notification hooks.
`POST /api/bookings` verifies the simulated payment and commits a confirmed,
paid purchase. The route now requires a signed customer token, takes the
booking owner from `req.auth.userId`, and rejects a conflicting browser
`userId`. The current `verifyPayment()` always succeeds. The notifier rechecks
the committed purchase owner, payment and status, and reads `USER.email`.
`PATCH /api/admin/bookings/:id` requires a signed admin token and uses the
current `USER.branch_id` to scope the cancellation. Its hook verifies that all
affected tickets belong to that branch; the notifier also checks the committed
purchase branch and status. Without valid `req.auth`, the protected routes
reject the operation before reading recipients or sending mail. These checks
also passed an isolated MySQL-backed integration run with fictional records and
captured delivery; that run does not establish live SMTP readiness.
The notifier's `committed` input is an internal controller contract, not a way
to authenticate a request. Confirmation must use the existing booking
reference and a verified successful payment; cancellation must not promise a
refund.
Only attach or link an e-ticket when Eli supplies a trusted ticket asset.
Process-local duplicate protection is not durable and requires the outbox
described above before reliable live retries. Definite and uncertain failures
are logged with notification type and purchase or event ID only; errors and
recipient addresses are not logged. Email failure does not reverse a committed
purchase or schedule update. The current synchronous sends can delay the API
response until configured SMTP timeouts; defer delivery through the approved
outbox instead of adding untracked fire-and-forget sends.

The confirmation preparation now reads the e-ticket's purchase details from
committed purchase, ticket, movie, and snack records: rating, runtime, each
ticket's seat/type/price, snack subtotals, the derived booking fee, payment
method, discount note, and purchase time. The required notification query does
not reference `verification_token`, so it still works before Eli's migration.
`ticketQrService` performs a separate optional token lookup only when both
`EMAIL_TICKET_QR_ENABLED=true` and `EMAIL_TICKET_QR_PRIVACY_APPROVED=true` and
`PUBLIC_APP_ORIGIN` is a valid public HTTPS origin. Both gates default to false.
The lookup requires a confirmed, paid `TOTAL_PURCHASE` and a 32-character hex
token already stored by Eli's booking flow. A missing column, token, or valid
origin omits the QR without preventing the ordinary confirmation email.

The backend uses the same `qrcode` 1.5.4 library and image settings as Eli's
frontend to encode `PUBLIC_APP_ORIGIN/verify/<existing token>` as a PNG. Nodemailer
attaches it inline with a CID; the existing confirmation template shows that
image and a verification link, and its plain-text part includes the same URL.
No new token, QR verification format, PDF generator, or PDF attachment exists.
The QA/testing4 foundation already includes Eli's booking token creation and
public verification route. The isolated test database received the token column
through test-only setup; every deployment still needs the approved QR schema
change before relying on this feature. The public verifier
currently returns the ticket owner's name and payment details to anyone with
the URL, so the privacy gate must remain false until that response is reviewed.
The public HTTPS origin must point to a deployed app that serves `/verify/:token`
and its API; syntactic validation alone cannot prove reachability. The existing
customer authentication and post-commit delivery gates also remain in force.
Real automatic token-bearing delivery is not enabled here.

An offline test in `tests/ticketQrService.test.js` uses a fictional paid purchase
and stored 32-character token with a fake transport. It checks the exact
`/verify/:token` URL, generated PNG, inline CID attachment, shared confirmation
HTML, plain-text URL, and duplicate suppression. The isolated MySQL run separately
verified a committed booking token, public verification behavior, and QR PNG
generation, but deliberately captured a confirmation **without** a QR attachment.
Those offline and captured-mail tests did not send SMTP mail or resolve the
public verifier's privacy concern. The separate controlled Gmail demonstrations
below used the same application hooks under test-only configuration.

The schedule fields are MySQL `DATE` and `TIME`; the pool returns `DATE` as a
`YYYY-MM-DD` string. Pass those date and time strings to the shared template as
Philippine wall-clock values. Do not convert them through a server-local `Date`
or append a timezone offset, which could shift a midnight showtime to another
day. Agree on the database timezone contract before adding timestamp-based
event selection.

## Manual SMTP smoke test

`node scripts/emailSmokeTest.js --send-test-emails --to <test-inbox>` runs only
when explicitly invoked from `backend/`. It sends the existing confirmation,
cancellation, and reschedule templates, in that order, with fictional data to
one address on `EMAIL_SMOKE_TEST_RECIPIENTS` (comma-separated). Importing the
script or starting the server never runs it, and `NODE_ENV=production` is
rejected. A real CLI run also requires an interactive terminal confirmation
after showing the allowlisted recipient and all three notice types. It does not
query MySQL or use a customer address. The command prints notice names and results, not credentials
or recipient addresses. A failed result sets a nonzero exit code; earlier
successful sends cannot be undone. Do not use a production customer inbox.

For a manual test, use a dedicated test mailbox and SMTP account. Set
`EMAIL_SMOKE_TEST_RECIPIENTS` to the test inbox and pass the same address with
`--to`. Supply `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` (`true` for implicit TLS,
usually port 465; `false` for STARTTLS, usually port 587), `SMTP_USER`,
`SMTP_PASS`, and `MAIL_FROM` from the approved mail provider. Set
`EMAIL_DELIVERY_ENABLED=true` only in the explicitly prepared local test
environment. `RESCHEDULE_NOTIFICATIONS_ENABLED` stays `false`; the smoke test
calls the mail service directly, not the admin endpoint. The sample
`.env.example` keeps both delivery flags disabled and contains no credentials.
The backend's `.env` is ignored by Git. Do not put secrets in shell command
arguments, committed files, or test output.

If a local development machine times out when connecting to an SMTP hostname,
set `SMTP_LOCAL_IPV4_RESOLVE=true` only in that backend process. The mailer
resolves the configured `SMTP_HOST` to IPv4 before connecting, retains the
hostname in `tls.servername` for certificate validation, and requires STARTTLS
when implicit TLS is not selected. The option defaults to `false` and is
rejected outside `NODE_ENV=development`. It does not alter the recipient
allowlist or enable delivery by itself. Do not enter a fixed SMTP IP address.
On a Windows host where a trusted local CA is needed, start Node with
`node --use-system-ca server.js` from `backend` (or set `NODE_OPTIONS=--use-system-ca`
for that local process). Do not disable certificate verification.

For a no-send connection and authentication check, first configure the approved
SMTP settings privately and retain a single authorized test recipient. From
`backend` in a temporary PowerShell session, set `NODE_ENV=development`,
`SMTP_LOCAL_IPV4_RESOLVE=true`, `EMAIL_DELIVERY_ENABLED=true`, and
`EMAIL_LOCAL_TEST_RECIPIENT` to that approved inbox for this process only. Run:

```powershell
node --use-system-ca -e "require('dotenv').config(); const {createMailer}=require('./utils/mailer'); createMailer().verify().then(result => { console.log(result.status); process.exitCode = result.status === 'verified' ? 0 : 1; });"
```

`verify()` performs the SMTP connection, TLS negotiation, and authentication;
it does not call `sendMail()`. After the check, clear the temporary environment
overrides and leave delivery disabled. Verification does not resolve an earlier
uncertain send and must not be followed by an automatic retry.

For a normal browser checkout test, use only an isolated database containing
fictional records and a customer whose saved `USER.email` is the explicitly
authorized test inbox. Before starting the backend, obtain approval for that
single send, set `NODE_ENV=development` and
`EMAIL_LOCAL_TEST_RECIPIENT` to that same address, and enable
`EMAIL_DELIVERY_ENABLED=true` only in that local backend process. The mailer
rejects any other recipient before SMTP; this guard cannot redirect a different
customer's mail to the test inbox. Keep
`RESCHEDULE_NOTIFICATIONS_ENABLED=false` and both QR flags false. Stop the
backend after the test so normal delivery returns to its disabled default.
The browser checkout itself does not ask for a separate email-send confirmation.
The manual smoke-test allowlist is a separate setting and does not protect the
normal application. A successful simulated payment and committed purchase
trigger the confirmation hook; notification failure does not undo checkout.
The Checkout page pre-fills the saved account address and submits it for the
server-side match check; the test account must use the approved inbox. With the QR
flags off, the confirmation email has no QR. Checkout directs customers to My
Tickets for their e-ticket and QR code.

The script checks its CLI flag, recipient allowlist, SMTP settings, and all
three rendered templates before the first send. `npm test` exercises the same
workflow through an injected fake transport and never connects to SMTP. A
Gmail smoke test uses an IPv4 local binding and requires STARTTLS; on this
Windows host, run Node with `--use-system-ca` so its certificate validation can
use the trusted Windows CA store. Neither adjustment disables TLS checks. A
manual SMTP run checks service-level delivery only. All three controllers have
guarded hooks and the new middleware populates `req.auth`. Delivery flags
remain disabled. Reschedule additionally
requires branch and seat safety and both delivery flags.

## Fresh local test database for a teammate

Use a separate database named `filmvault_email_local_test` on your own MySQL
server. Confirm that the name is absent before creating it. Apply
`database/schema.sql`, `database/email_local_test_catalog.sql`, and
`database/email_local_test_checkout.sql` in that order, stopping after any SQL
error. The two local-test scripts select only `filmvault_email_local_test`.
They are for a new disposable database and must not be run on an existing team
database or repeated after checkout. The catalog is based on the QA movie,
branch, cinema, and seat seed but omits every sample USER row. The checkout
script adds the required hold, payment, reference, and verification-token
columns and indexes, inserts the three ticket types, and ensures a future
Cinema 1 screening if the catalog's fixed screening dates have passed. It does
not create accounts or bookings. Do not run `booking_compatibility.sql`,
`ticket_verification.sql`, or `credentials_update.sql` for this setup.

Create a database-scoped application account with SELECT, INSERT, UPDATE, and
DELETE privileges on this disposable database only. Configure its credentials
privately in the Git-ignored `backend/.env`, together with `DB_HOST`, `DB_PORT`,
`DB_NAME=filmvault_email_local_test`, and a unique `AUTH_TOKEN_SECRET` of at least
32 random bytes. Keep all email and QR flags false while checking login and the
catalog. Install dependencies with `npm ci` in both `backend` and `frontend`.
Start the backend with `npm start` from `backend`, then start Vite with `npm run
dev` from `frontend`. Vite forwards `/api` to backend port 5000.

Register one fictional customer through the website with the approved test
inbox as its account email. For admin actions, register a separate fictional
account, then have the owner of this disposable database assign that account
`role='admin'` and the intended `branch_id` in the local USER table. Sign in
again after the branch assignment. Do not use the placeholder users from the
normal development seed, change a shared account, or copy a teammate's
database credentials. Before a controlled email test, configure only your own
approved SMTP sender and set `EMAIL_LOCAL_TEST_RECIPIENT` to the same address as
the customer's saved USER.email. Enable `EMAIL_DELIVERY_ENABLED=true` only for
that isolated local process; set `RESCHEDULE_NOTIFICATIONS_ENABLED=true` only
when testing an authorized same-cinema schedule change. Leave both QR flags
false. Stop the backend and restore delivery to false after testing. The
Windows system-CA option and development-only SMTP IPv4 resolution are needed
only on machines whose network or certificate setup requires them.

## Automatic event trigger readiness

The authenticated request contract is:

```js
req.auth = { userId: 8, role: "customer", branchId: null };
req.auth = { userId: 9, role: "admin", branchId: 3 };
```

The new middleware sets this property only after verifying a server-issued
signed token and resolving the current `USER.user_id`, `role`, and assigned
`branch_id` from trusted server records. It does not copy identity
from request body/query parameters, unverified headers, or frontend
`localStorage`. `utils/notificationAuth.js` validates this shape and creates
the internal `{ verified: true, ... }` notifier context. The route middleware
performs authentication; customer ownership and admin branch checks are in the
respective controllers. A future Backend Team change to the auth contract
should adapt this adapter without rewriting notification services.

`bookingNotificationService.notifyCommitted(event)` prepares from committed
purchase records and then invokes the existing mail service. It rejects an
uncommitted event, failed payment, an unverified actor, an ineligible purchase,
or an invalid database recipient. Preparation and delivery failures return a
status without changing the committed booking. This method is a server-side
integration point, not an HTTP endpoint or proof of caller authentication.

`tests/automaticNotificationLifecycle.test.js` models checkout and admin
cancellation transactions with verified fictional actors and a fake transport.
`tests/automaticControllerTriggers.test.js` additionally exercises the actual
checkout and cancellation handlers with mocked transactions and fake mail.
They verify post-commit ordering, skipped failed events, branch and recipient
checks, and mail failure containment. Those automated tests use mocks; the
separate isolated MySQL run is described below. The login response includes a short-lived signed token, which the
backend validates on protected API requests. The simulated payment service
currently auto-approves; a later payment implementation must preserve its
`ok` contract.

`updateShowtime` already invokes the reschedule notifier after commit, with
an affected-booking snapshot before update. Its controller tests use a fake
database and transport. It now consumes the same `req.auth` adapter as the
booking hooks. Keep `EMAIL_DELIVERY_ENABLED=false` and
`RESCHEDULE_NOTIFICATIONS_ENABLED=false` in normal configuration. The deferred
isolated concurrent checkout/reschedule test and cinema seat validity issue above
also block live reschedule delivery. No real SMTP test is part of the automated
event tests.

## Isolated MySQL integration result

A manually invoked, test-only run completed 17 of 17 checks against
`filmvault_email_e2e_test` at `127.0.0.1:3307`. The existing database had the
base 16-table schema and test-only checkout/QR columns, indexes, and foreign
key. The run verified customer and two branch-admin logins, invalid and expired
token rejection, customer booking ownership, a committed paid booking, declined
payment, branch-scoped admin cancellation and same-cinema rescheduling,
unchanged/repeated actions, stored verification-token lookup, QR PNG rendering,
and token revocation after a fictional password change. One confirmation, one
cancellation, and one reschedule notice were captured through an injected fake
mailer after their corresponding successful commits. The recipient fixtures
used fictional `.example.com` addresses. No SMTP connection was made.

The initial 17-check run did not prove a QR-bearing confirmation from the same
database-backed purchase, failed database-commit behavior, overlapping checkout
and reschedule transactions, repeated successful booking requests, multi-instance deduplication,
or deployment behavior. The QR-bearing confirmation was covered offline with a
fake transport and fictional records, then separately exercised in the
display-only Gmail test below. Keep automatic delivery disabled until
the remaining concurrency, cinema-seat, verifier-privacy, and durable retry
decisions are reviewed. The local MySQL provisioning scripts and result reports
are inspection artifacts, not application or automated-test dependencies.

## Controlled automatic Gmail demonstrations

A manually approved, isolated test used the real booking, showtime update, and
admin cancellation controllers against fictional records in
`filmvault_email_e2e_test`. Each transaction committed before its notification
hook invoked the existing mail service. The test made exactly three SMTP send
attempts to one explicitly authorized test inbox: Booking Confirmation,
Showtime Reschedule, and Booking Cancellation. Gmail SMTP accepted all three,
and the tester personally confirmed receiving all three with the same fictional
booking reference. The booking used simulated payment. A temporary authorized
Gmail sender was used only for this controlled test; Ralph's official FilmVault
SMTP configuration is still pending. This test did not activate normal
customer-facing email delivery.

A separate, manually approved **QR email display-only** test created another
fictional, committed booking through the real customer booking controller.
The post-commit confirmation hook used the stored verification token and Eli's
existing QR generator to produce a PNG, attached inline with the template's
CID image reference. Gmail SMTP accepted its single send attempt, and the
tester confirmed that the Booking Confirmation and QR image appeared in Gmail.
The QR encoded a deliberately unreachable `.invalid` verification URL. Phone
scanning, public ticket verification, and verifier privacy were not tested or
approved. No real customer data or payment was used in either demonstration.

These were test-only runs with an authorized recipient and process-scoped
delivery configuration. The committed application defaults remain
`EMAIL_DELIVERY_ENABLED=false`, `RESCHEDULE_NOTIFICATIONS_ENABLED=false`,
`EMAIL_TICKET_QR_ENABLED=false`, and
`EMAIL_TICKET_QR_PRIVACY_APPROVED=false`. Customer-facing delivery and
token-bearing QR activation require team review and explicit approval, a
reviewed public HTTPS verification origin and verifier privacy policy, and the
remaining transaction, seat-validity, and durable delivery decisions above.

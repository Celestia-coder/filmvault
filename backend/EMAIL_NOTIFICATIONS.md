# Email notifications

`services/emailService.js` imports the existing
`frontend/src/email/emailTemplates.js` with Node's dynamic ESM import. A backend
deployment must include that template file and `frontend/package.json` (which
declares the module type). No separate backend copy of the designs exists.

Start with `EMAIL_DELIVERY_ENABLED=false` and
`RESCHEDULE_NOTIFICATIONS_ENABLED=false` as shown in `.env.example`. SMTP
settings and `MAIL_FROM` are validated only when real delivery is enabled.
`npm test` uses a fake mail transport and mocked database; it needs neither
SMTP credentials nor MySQL. A future trusted caller may pass an approved
public HTTPS `logoUrl` or `posterUrl`. The QR integration below supplies a
verification `ticketUrl` only from committed purchase data. No local asset path is
embedded in outgoing mail.

The admin showtime endpoint currently has no authentication middleware. Its
server-populated `req.auth` field is therefore absent, and the notifier will not
read customer addresses or send mail. Before enabling live reschedule mail,
the Backend Team must populate the verified `req.auth` contract below and
enforce branch access on the route. The browser's `branchId` is not proof of
authorization.

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
schedule after the update commits. It does **not** guarantee correct event
membership for every overlapping transaction. Customer checkout currently
reads `SCREENING` without a matching locking protocol, so an in-flight checkout
may read the old schedule, complete after the recipient snapshot, and miss a
notice. MySQL's repeatable-read snapshot alone does not prevent this. The
Booking Backend developer and Email Notifications developer must coordinate a
shared schedule-validation and locking contract and verify it against an
isolated MySQL test database. Real reschedule email delivery must remain
disabled until that work and admin authorization are complete.

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

Both booking controllers now have guarded post-commit notification hooks.
`POST /api/bookings` verifies the simulated payment and commits a confirmed,
paid purchase, but still accepts `userId` from the request because customer
authentication is not implemented. The current `verifyPayment()` always
succeeds. Its hook requires a server-populated customer `req.auth` matching
that user ID, then the notifier rechecks the committed purchase owner, payment
and status, and reads `USER.email`. `PATCH /api/admin/bookings/:id` commits
cancellation but has no server-enforced admin authentication and still uses a
browser-supplied branch scope for its business operation. Its email hook
requires a server-populated admin branch matching all affected tickets; the
notifier also checks the committed purchase branch and status. Without
`req.auth`, neither hook reads notification recipients or sends mail. These
email guards do **not** secure the underlying routes: the Backend Team must
enforce customer ownership and admin branch access independently.
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
The verification route, token column, and schema change are still only on
`FE/ticket-qr`; no migration was run for this email work. The public verifier
currently returns the ticket owner's name and payment details to anyone with
the URL, so the privacy gate must remain false until that response is reviewed.
The public HTTPS origin must point to a deployed app that serves `/verify/:token`
and its API; syntactic validation alone cannot prove reachability. The existing
customer authentication and post-commit delivery gates also remain in force.
Real automatic token-bearing delivery is not enabled here.

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

The script checks its CLI flag, recipient allowlist, SMTP settings, and all
three rendered templates before the first send. `npm test` exercises the same
workflow through an injected fake transport and never connects to SMTP. A
Gmail smoke test uses an IPv4 local binding and requires STARTTLS; on this
Windows host, run Node with `--use-system-ca` so its certificate validation can
use the trusted Windows CA store. Neither adjustment disables TLS checks. A
manual SMTP run checks service-level delivery only. All three controllers now
have guarded hooks; no request authentication middleware populates `req.auth`
yet, so automatic customer delivery remains disabled. Reschedule additionally
requires branch and seat safety and both delivery flags.

## Automatic event trigger readiness

The future Backend Team middleware contract is:

```js
req.auth = { userId: 8, role: "customer", branchId: null };
req.auth = { userId: 9, role: "admin", branchId: 3 };
```

The middleware must set this property only after verifying a server-issued
session or signed token and resolving the current `USER.user_id`, `role`, and
assigned `branch_id` from trusted server records. It must not copy identity
from request body/query parameters, unverified headers, or frontend
`localStorage`. `utils/notificationAuth.js` validates this shape and creates
the internal `{ verified: true, ... }` notifier context. It does not perform
authentication itself and does not make an unprotected route safe. If the
Backend Team chooses a different context, adapt this one small adapter rather
than changing the three notification services. Middleware must also enforce
ownership and branch permissions on the routes themselves.

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
checks, and mail failure containment. These are not live MySQL integration
tests. The login response currently returns identity fields to the browser
but does not authenticate later API requests. The simulated payment service
currently auto-approves; a later payment implementation must preserve its
`ok` contract.

`updateShowtime` already invokes the reschedule notifier after commit, with
an affected-booking snapshot before update. Its controller tests use a fake
database and transport. It now consumes the same `req.auth` adapter as the
booking hooks. In the running app, no middleware sets `req.auth`; the guard
therefore suppresses customer mail. Keep `EMAIL_DELIVERY_ENABLED=false` and
`RESCHEDULE_NOTIFICATIONS_ENABLED=false` in normal configuration. The deferred
checkout/reschedule concurrency contract and cinema seat validity issue above
also block live reschedule delivery. No real SMTP test is part of the automated
event tests.

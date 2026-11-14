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
public HTTPS `logoUrl`, `posterUrl`, or `ticketUrl`. No local asset path is
embedded in outgoing mail.

The admin showtime endpoint currently has no authentication middleware. Its
`req.authenticatedAdmin` field is therefore absent, and the notifier will not
read customer addresses or send mail. Before enabling live reschedule mail,
the Backend Team must provide a verified server-side
`{ verified: true, role: "admin", branchId }` context and enforce branch access
on the route. The browser's `branchId` is not proof of authorization.

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
by the same customer get separate notices. It marks the event in a process-local
set before starting delivery; overlapping calls for that event cannot both
send. A schedule-value hash would be a poor event ID because a later
A-to-B change following B-to-A is a new event. The UUID exists only in memory,
so this protection does not survive restarts, coordinate servers, or support
safe automatic retries after uncertain SMTP results. Do not treat it as
exactly-once delivery. The controller returns aggregate `sent`, `failed`, and
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
workers with a claim/lease before retrying an uncertain send.

`bookingNotificationService` prepares confirmation and cancellation messages
from committed `TOTAL_PURCHASE`, `TICKET`, `SCREENING`, and `USER` records. It
checks payment and purchase status, verified actor context, branch ownership,
and recipient syntax. It sends through the existing shared templates and
mailer, with one process-local attempt per notification type and purchase.
The fake-transport tests exercise both messages without customer data or SMTP.

Neither booking controller trigger is wired. `POST /api/bookings` verifies the
simulated payment and commits a confirmed, paid purchase, but accepts `userId`
from the request because customer authentication is not implemented. The
current `verifyPayment()` always succeeds. `PATCH /api/admin/bookings/:id`
commits cancellation but has no server-enforced admin authentication and uses
a browser-supplied branch scope. Sending automatically from either endpoint
would allow untrusted callers to trigger messages to database customers. Once
the Backend Team supplies verified customer/admin context and enforces the
admin branch on the route, call the relevant notifier *after commit*. The
notifier's `committed` input is an internal controller contract, not a way to
authenticate a request. Confirmation must use the existing booking reference
and a verified successful payment; cancellation must not promise a refund.
Only attach or link an e-ticket when Eli supplies a trusted ticket asset.
Process-local duplicate protection is not durable and requires the outbox
described above before reliable live retries.

The confirmation preparation now reads the e-ticket's purchase details from
committed purchase, ticket, movie, and snack records: rating, runtime, each
ticket's seat/type/price, snack subtotals, the derived booking fee, payment
method, discount note, and purchase time. It does not read QR columns absent
from this branch. The shared confirmation template already accepts an optional
public HTTPS `ticketUrl`, but the notifier does not supply one: Eli's
`verification_token` column, verification endpoint, and deployment origin are
only on `FE/ticket-qr`. Never manufacture a token, link to localhost, or imply
that a QR or PDF is attached. Eli's QR and PDF are generated in React, not as
backend files available to Nodemailer. The public verification response and
booking-token access need security review before a token-bearing email link
can be sent. No automatic booking trigger or real delivery is enabled here.

The schedule fields are MySQL `DATE` and `TIME`; the pool returns `DATE` as a
`YYYY-MM-DD` string. Pass those date and time strings to the shared template as
Philippine wall-clock values. Do not convert them through a server-local `Date`
or append a timezone offset, which could shift a midnight showtime to another
day. Agree on the database timezone contract before adding timestamp-based
event selection.

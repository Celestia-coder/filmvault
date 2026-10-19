# Database changelog

## 2026-10-19 - Week 4 alignment and validation

### Booking seed data and documentation

- Added distinct development `TOTAL_PURCHASE.reference_code` fixtures
  (`W4-P001` through `W4-P005`) to match the required, unique column while
  retaining all five purchases, six tickets, discounts, snacks, and booking
  scenarios.
- Added a primary-key `WHERE` condition to the final `UPDATE SCREENING` so
  `seed.sql` runs with MySQL Workbench Safe Update Mode enabled for the four
  seeded screenings.
- Completed `README.md` with Workbench setup, read-only checks, and a
  development-only reset/rebuild procedure. `reset.sql` itself was unchanged.

### Reported MySQL Workbench 8.0.46 validation

- In the disposable `filmvault_w4_validation_20261019` database, `schema.sql`
  created all 16 tables. The first seed run reached MySQL Error 1175 at its
  unkeyed screening update; the keyed update then succeeded and the transaction
  was committed.
- Confirmed 14 cinemas, 4,068 seats, branch/cinema capacities, four
  screenings, five purchases, six tickets, and 560 `SEATBOOKING` rows.
- Confirmed purchase totals against tickets and snacks, booked-seat counts
  against tickets (2, 1, 3, 0), and no ticket using a seat from another cinema.
- Verified the three Task 3 indexes and 19 foreign keys.
- Ran `reset.sql` in that disposable database: all 16 tables were removed.
  `schema.sql` recreated them, and the corrected `seed.sql` ran successfully
  after reset. The keyed screening update and `COMMIT` succeeded with Safe
  Update Mode enabled; final seed queries returned the expected seat and
  `SEATBOOKING` counts.
- The original unkeyed screening update raised MySQL Error 1175; it is no
  longer the update in `seed.sql`. Active-versus-expired hold timing and
  Backend booking workflows were not fully tested in this validation.

## 2026-10-16 - Database schema and cinema seat generation (`c9818b3`)

- Added unique cinema numbers within branches, seat and `SEATBOOKING` status
  checks, nullable `SEATBOOKING.held_by` with a user foreign key, required
  unique `TOTAL_PURCHASE.reference_code`, and ticket lookup indexes.
- Expanded the seed to 14 cinemas: three at Vista Mall Taguig (140 seats
  each), seven at Market! Market! (360 each), and four at Venice McKinley
  (282 each), totaling 4,068 generated seats. Updated all four screening
  capacities to 140 and generated one `SEATBOOKING` row per screening seat.
- Seat numbering is **provisional**, grouped into rows of 20. The final row
  and aisle layout still needs confirmation; this changelog does not mark it
  complete.

## 2026-10-14 - Initial Week 4 database work (`f748494`, `c8be41b`)

- Added `idx_screening_cinema_datetime` on
  `SCREENING(cinema_id, show_date, show_time)`,
  `idx_seatbooking_screening_status` on
  `SEATBOOKING(screening_id, status)`, and
  `idx_total_purchase_user_datetime` on
  `TOTAL_PURCHASE(user_id, purchase_datetime)`.
- Added realistic purchase, ticket, snack, cancellation, repeat-customer,
  seat-availability, and hold fixtures. Derived screening booked counts from
  tickets and used one `@seed_now` timestamp for relative fixtures.
- Added `reset.sql` with child-before-parent table drops. The fuller README
  was deferred at the time and completed on 2026-10-19.
- Historical verification of that earlier schema/seed revision reported 45
  runtime checks on an isolated MySQL 8.0.46 instance. Those checks predate
  the 2026-10-16 schema and seed changes and are separate from the October 19
  Workbench validation above.

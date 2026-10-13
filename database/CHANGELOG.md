# Database changelog

## 2026-10-14 - Week 4, Tasks 3-5

### Task 3: indexes and constraints

- Added `idx_screening_cinema_datetime` on
  `SCREENING(cinema_id, show_date, show_time)` for cinema schedules.
- Added `idx_seatbooking_screening_status` on
  `SEATBOOKING(screening_id, status)` for per-screening availability.
- Added `idx_total_purchase_user_datetime` on
  `TOTAL_PURCHASE(user_id, purchase_datetime)` for customer purchase history.
- Preserved every existing column, primary key, unique constraint, foreign key,
  and delete rule. Documented all 18 foreign keys and cascade restrictions.

### Task 4: seed scenarios

- Retained existing catalog, branch, cinema, user, and seat fixtures; made the
  four screenings occur tomorrow relative to the seed timestamp.
- Added three ticket types, three snacks, five purchases, six tickets, four
  snack-purchase rows, and all 40 valid screening/seat availability pairs.
- Included four confirmed purchases and one cancellation before ticket issuance,
  a repeat customer, multi-ticket and discounted purchases, purchases with and
  without snacks, shared screenings, and a customer with no purchase history.
- Seeded 30 available seats, two future holds, two expired holds, and six booked
  seats. Holds are relative to a single `@seed_now` timestamp.
- Derived screening booked counts from tickets (2, 1, 3, 0), with purchase totals
  equal to ticket prices plus snack subtotals.
- Wrapped seed writes in a transaction; documented the fresh-schema requirement.

### Task 5: reset and documentation

- Added `reset.sql` to drop FilmVault tables in child-before-parent order without
  disabling foreign key checks; rebuild with `schema.sql`, then `seed.sql`.
- Expanded the README with setup/reset instructions, index purposes, existing
  delete behavior, seed scenarios, availability semantics, and validation SQL.
- Kept `USER -> TOTAL_PURCHASE -> TICKET` and `SEATBOOKING` availability. No new
  tables or relationship redesigns were introduced.

### Verification

- Passed 45 runtime checks on an isolated MySQL 8.0.46 instance using InnoDB,
  foreign key checks enabled, and networking disabled.
- Compared the resulting schema with the original: all columns, defaults,
  primary/unique keys, foreign key columns, and delete/update rules match.
- Verified all three new indexes, the existing movie index, fixture counts,
  purchase totals, discount calculations, seat/cinema alignment, booked counts,
  cancellation and repeat-customer scenarios, and relative hold/screening times.
- Executed the README's availability and summary queries; all eight consistency
  queries returned zero mismatches both before and after reset/reseed.
- Confirmed duplicate seat positions, tickets, and availability pairs are
  rejected; orphan tickets and restricted parent deletes are rejected too.
- Confirmed the existing screening/seat availability cascades and movie cascade.
- Reset populated, empty, and partially created schemas with foreign key checks
  enabled, then rebuilt using the documented `SOURCE` commands and verified IDs.

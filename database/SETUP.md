# FilmVault database setup

These files contain no local connection settings or account credentials. Select
the intended MySQL 8.0 database in your SQL client before running a file. Stop
on the first SQL error; do not use the MySQL client's `--force` option.

## New, empty installation

1. Create and select a **new, empty** database using a name you have checked.
2. Run `schema.sql` once. It creates the tables and constraints expected by the
   integrated backend.
3. Run `reference_data.sql`. It adds the required Regular, Senior and PWD ticket
   types. Re-running this file does not add those names again.
4. Optionally run `seed.sql` **once on an empty database** for demo movies,
   branches, cinemas, seats, snacks and screenings. It contains no user accounts
   or password hashes. Its screening dates are fixed; check that they are still
   in the future before using them for booking tests.

Do not run `seed.sql` against an existing installation: its explicit movie,
branch and cinema IDs can conflict with existing rows. Create customer accounts
through the app. Admin account provisioning needs a separate approved process.

## Existing installation

Do not re-run `schema.sql` or `seed.sql`. Back up the database and first test the
migration on an isolated copy with representative rows. Inspect the selected
database name, then set the target guard to that **exact** name in the same SQL
session before sourcing the migration. Put these statements in a temporary
wrapper file outside the repository and run it with the MySQL client in
noninteractive batch mode from the repository root, without `--force`:

```sql
SELECT DATABASE();
SET @filmvault_target_schema = 'the_exact_selected_database_name';
SOURCE database/migrations/001_booking_compatibility.sql
```

`SOURCE` is a MySQL client command. Do not paste the wrapper into an interactive
prompt: the client must stop at the first error. In another SQL client, use its
equivalent stop-on-error batch mode and keep the selected schema and variable in
the same session. The migration refuses a missing or mismatched target name.
Before creating its procedure, it refuses an existing procedure named
`filmvault_migrate_booking_001` in that schema. Do not remove an existing
procedure without checking its origin and definition.
The migration checks existing column types, duplicate references, duplicate
ticket types, orphaned seat owners, ticket discounts and schema-wide foreign-key
constraint-name collisions before changing tables.
The account running it needs permission to create and drop the migration
procedure, alter tables and indexes, and insert required ticket types.
A successful run removes its procedure and can be repeated without
adding duplicate columns, indexes or ticket types. MySQL DDL commits implicitly:
stop on any error and inspect the schema before re-running. If an interrupted
run left the procedure behind, identify it as this migration's procedure and
review any partial changes before removing it and retrying.

The migration adds missing booking columns and keys, then required ticket types.
It never changes existing accounts, tickets, bookings or payment values. If an
old database lacks `reference_code`, existing purchases receive `NULL` there;
if it lacks payment or discount fields, those historical values remain `NULL`
rather than being guessed. New bookings explicitly write those values. Any
historical backfill requires separate review and approval.

After migration, verify the required columns in `SEATBOOKING` and
`TOTAL_PURCHASE`, the `held_by` foreign key, unique indexes on purchase
references and ticket type names, and exactly one each of Regular (0%), Senior
(20%) and PWD (20%). Compare the counts and original values of `USER`,
`TOTAL_PURCHASE`, `TICKET` and `SEATBOOKING` with the pre-migration snapshot.

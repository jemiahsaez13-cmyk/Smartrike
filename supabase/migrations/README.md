# Supabase Migrations

SQL migrations for the Smart Trike backend. Apply them **in numeric order**
(`001` → `036`) against the Smart Trike Supabase project (`ref: tvvfauetrcnxmtgvvshr`).

---

## ✅ Target project initialized

Migrations through `036` were applied to `tvvfauetrcnxmtgvvshr` on 2026-08-23.
Migrations `037` through `043` were applied to `tvvfauetrcnxmtgvvshr` on 2026-08-24
via the Node.js pg client (`scripts/run-migrations.mjs`).
The Supabase CLI reports matching local and remote versions.
Migration `043` adds `selected_payment_methods` (JSONB) and `appointment_date`
(timestamptz) to `franchise_applications`.

Migrations `044` through `058` add TODA associations/routes, Change of Unit
columns and images, separate payment-verification issuance, motor make/model
fields, and the `submit_change_of_unit_request` SECURITY DEFINER RPC.

Migration `059` rebuilds `enforce_mtop_workflow` with the Change of Unit bypass
guards baked in cleanly, and adds the `review_change_of_unit_request` SECURITY
DEFINER RPC for admin approval/rejection of COU requests.

---

## How to apply

Pick whichever matches the access you have.

### Option A — Supabase SQL Editor (no tooling needed)
1. Open the project → **SQL Editor** → **New query**.
2. Paste the entire contents of every migration, in numeric order.
3. Run each migration and mark its row applied after verification.

### Option B — Supabase CLI with a personal access token
```bash
# token from https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN=sbp_xxx        # PowerShell: $env:SUPABASE_ACCESS_TOKEN="sbp_xxx"
npx supabase login --token $SUPABASE_ACCESS_TOKEN
npx supabase link --project-ref tvvfauetrcnxmtgvvshr
npx supabase db push
```

### Option C — direct connection with the DB password
```bash
# password from Project Settings → Database
npx supabase db push --db-url "postgresql://postgres.tvvfauetrcnxmtgvvshr:<DB_PASSWORD>@<POOLER_HOST>:5432/postgres"
```

> Note on `db push`: migrations `001`–`002` use bare `CREATE TABLE` (not
> `IF NOT EXISTS`). If the live schema already exists and isn't tracked in
> `supabase_migrations.schema_migrations`, a full `db push` may error on those.
> In that case, apply **only** `020` and `021` via Option A.

## Verify it worked
```sql
-- tables exist
select to_regclass('public.emoney_accounts'), to_regclass('public.emoney_transactions');
-- RPC exists
select proname from pg_proc where proname = 'pay_trip_with_emoney';
-- migration 035 tables + passenger-safe lookup exist
select to_regclass('public.franchise_events'),
       to_regclass('public.association_inventory'),
       to_regclass('public.driver_violations');
select proname from pg_proc where proname = 'get_driver_public_franchise';
```

## Live driver availability (060)

Apply `060_live_driver_availability.sql` after the existing migrations before
releasing the updated app. It backfills a passenger-readable availability table,
synchronizes it transactionally when driver status/verification changes, and
adds it to Supabase Realtime. It does not expose private driver profiles.
This migration has not been applied by this change (management credentials unavailable).

Ride QR images and payment screenshots use data URIs in the tables created by
038, with optional QR support in 041; they do not require a Storage bucket.
The live REST endpoints for both payment tables were reachable during inspection;
authenticated save/submit/verify still requires a driver and passenger test session.

## Cancellation driver release (061)

Apply `061_release_driver_after_ride_cancellation.sql` to restore the assigned
driver's availability atomically after a pending/accepted ride is cancelled.
The client cancellation fix works with the existing passenger booking policy;
this trigger handles the cross-user driver update that passengers cannot perform.
It preserves cash/online payment details and existing payment review history.
Migration 038 already rejects pending payment submissions on cancellation.
061 has not been applied here because management credentials are unavailable.

## Missing passenger_name during proof submission (062)

Run `062_repair_ride_payment_submission.sql` in the project's SQL Editor to
restore `submit_ride_payment` to the schema from 038. The passenger/driver names
are display-only values resolved from `users`; they are not payment table columns.
This targeted repair can run independently of 060/061 when 038 is already present.
It preserves existing submissions, ownership checks, validation and duplicate guards.
It has not been applied here because database management credentials are unavailable.

After applying, submit proof for an assigned, unpaid online ride: the submission
must become pending; the ride must remain unpaid until driver/admin verification.
If the same missing-column error remains, inspect custom triggers (do not disable
payment security triggers) and use the error's SQL context to locate the writer:

```sql
select pg_get_functiondef('public.submit_ride_payment(uuid,uuid,text,text)'::regprocedure);
select t.tgname, pg_get_triggerdef(t.oid), pg_get_functiondef(t.tgfoid)
from pg_trigger t
where t.tgrelid = 'public.ride_payment_submissions'::regclass and not t.tgisinternal;
```

## Missing review_ride_payment in schema cache (063)

Run `063_restore_ride_payment_review_rpc.sql` in Supabase SQL Editor. It restores
`public.review_ride_payment(p_payment_id UUID, p_decision TEXT, p_reason TEXT DEFAULT NULL)`,
grants authenticated execution and reloads the PostgREST schema cache. The last
query reports the installed parameters and permission. It can run independently
of 060-062 if the schema/helpers from 038 exist. Management credentials are not
available here, so this repair has not been applied to the live project.

Verification is restricted to the assigned driver or an admin. A successful
verification atomically records the reviewer, marks the booking paid, credits
the driver's earnings and records the transaction. Repeat verification is rejected
to avoid double credit. Rejection requires a reason and does not settle the ride.

### Parameter-name conflict and verification audit

The corrected 062/063 scripts drop only their exact RPC overload inside the
transaction before recreating it. PostgreSQL rejects input-parameter renames
through CREATE OR REPLACE (42P13). There is no CASCADE: if a dependent object
blocks replacement, the transaction rolls back instead of removing that object.
Existing payment rows remain untouched, and execution grants are restored.
Re-run the **entire updated 063**, not just a standalone DROP statement.

063 also locks the booking before its proof (the same order used by submission)
and rejects review of cancelled, cash or already-paid bookings.

Validation: `scripts/test-supabase-repairs.cjs` runs real SQL in isolated PGlite
PostgreSQL using the repository's relevant table definitions, payment functions,
RLS policies and triggers. Install `@electric-sql/pglite` outside the app and set
`PGLITE_MODULE` to that package directory to run it. No live data is used.
Tests cover migrations 060-063 running repeatedly, legacy parameter replacement,
publication registration, authenticated read-only availability, proof submission,
authorized and unauthorized reviews, single earnings credit including completion,
rejection/resubmission, cash/online cancellation and dependency-safe rollback.
The existing application regression scripts also pass.

This does not verify unknown custom live triggers, Supabase's HTTP schema cache
or websocket delivery. `scripts/check-supabase-repairs.sql` is a read-only live
schema audit for signatures, grants, RLS, triggers, indexes and publications. It
also flags the legacy double-counting stats trigger addressed by migration 028.

## Customer live payment status (064)

Apply `064_publish_ride_payment_updates.sql` to publish booking and proof changes
through Supabase Realtime. It is idempotent and does not change records or RLS.
The customer payment observer updates both the sheet and trip banner, including
when the sheet is closed, with reconnect/foreground refresh and a 3-second polling
fallback. Polling works even before 064 is applied. Management access is not
available here, so 064 has not been applied to the live project.


## Reports and Violations (065)

Apply `065_link_reports_and_violations.sql` before using **Record Violation** in
Reports and Violations. This adds the source report relationship and an admin-only
RPC that creates the violation and marks the report actioned in one transaction.
Retries reuse the same violation. Reports against passengers remain reports and
can be reviewed, dismissed, or marked actioned without creating driver violations.
Violation resolution/dismissal remains visible on the linked report; an actioned
report means the report has been handled, while the violation tracks its outcome.

Validation: `scripts/test-report-violation.cjs` runs against isolated PGlite.
Set `PGLITE_MODULE` to an installed `@electric-sql/pglite` package directory.
It covers successful conversion, repeated migration, retry deduplication, admin
permissions, invalid reports, reviewed reports, and rollback of both writes.

Migration 065 has not been applied to the live project: this environment has no
Supabase management login. Apply the SQL using the project's Supabase SQL Editor
or your authenticated migration workflow. No live records were modified here.


## Driver and passenger violations (066)

Apply `065_link_reports_and_violations.sql`, then `066_passenger_violations.sql`.
Migration 066 supersedes the driver-only conversion behavior described above:
reports against passengers now create linked passenger violations, just as reports
against drivers create driver violations. Both conversions mark the report actioned
atomically, and retries reuse the existing violation.

The existing table gains `passenger_id`; exactly one of `driver_id`/`passenger_id`
must be present. Server validation checks the selected user's actual role and the
reported user when linked. Existing driver records and driver-only access stay
intact. Manual Record supports Driver/Passenger choices and role-filtered pickers.
Management exports identify the recorded user's role and name.

Validation: `scripts/test-report-violation.cjs` covers both migrations and roles;
`scripts/test-reports-ui.cjs` covers the explicit report actions;
`scripts/test-violation-role-picker.cjs` covers role switching, dropdown filtering,
presets, and both manual record payloads. UI tests use React/react-test-renderer
19.1 via `UI_TEST_MODULES`. No live database was modified; migration 066 still
needs to be applied through an authenticated Supabase management session.


## Violation notifications in the Account bell (067)

Apply `067_violation_notifications.sql` after 065 and 066. Manual records and
report conversions automatically notify only the driver/passenger recorded in
the violation. The notification includes type, incident date, current status,
details, and penalty. Changes update the same notice and make it unread again.
Existing violations are backfilled once; repeating the migration preserves read
state and creates no duplicates. Recipient RLS allows each user to read and mark
only their own notifications, while existing administrator access is retained.

The app displays violation details without truncation, updates the unread badge
on notification changes, and refreshes on Account focus, app resume, and realtime
reconnect. Notification state clears on account change and rejects stale fetches.

Validation: `scripts/test-report-violation.cjs` covers recipient targeting,
backfill, status updates, read persistence and driver/passenger RLS isolation.
`scripts/test-notification-ownership.cjs` covers client badge updates, duplicate
handling and account switching. Migration 067 has not been applied to the live
project because this environment has no Supabase management login.

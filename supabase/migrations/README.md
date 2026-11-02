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


## Security and workflow fixes (068)

Apply `068_security_and_workflow_fixes.sql` after 067. It is required by the
app changes shipped with it (announcements, admin delete/invite, MTOP document
re-upload) and closes several server-side gaps:

- Users can no longer edit their own `status`, `rating`, trip totals,
  earnings or `toda_membership`, or change a verified license/plate; only
  active verified drivers can go online.
- Bookings are re-priced on insert from `fare_matrix` (Asia/Manila peak
  hours), limited to one active ride per passenger, and follow a fixed status
  flow per role (pending→accepted→in-transit→completed; passenger may cancel
  before pickup). The assigned driver is notified when a passenger cancels.
- Notification inserts are limited to ride participants, new-request alerts to
  drivers, and admins. Announcements use the new `broadcast_ref` column.
- `admin_invites` + `handle_new_user`: the admin role is granted only to
  invited emails; sign-up values are clipped to column sizes.
- `admin_delete_user(uuid)` removes the Auth login and the profile.
- MTOP fees are set server-side, drivers cannot mark their own payment
  verified, and `resubmit_mtop_document(...)` replaces a rejected document.

The end of the file has an optional, commented-out cleanup for Auth logins
orphaned by the old profile-only delete. Preview before running it.


## Auto-verify drivers with MTOP + daily quota (069)

Apply `069_auto_verify_driver_on_mtop_and_daily_quota.sql` after 068.

- When an MTOP application becomes `approved` (payment verified) or `issued`,
  the driver's `verification_status` is set to `verified` automatically, so the
  admin no longer approves the account separately. Drivers who already hold an
  approved/issued MTOP are backfilled.
- Adds `users.daily_quota` (₱, 1–100,000). Drivers edit it from the Daily Goal
  card on the dashboard or Earnings screen; NULL falls back to ₱800.


## Cancellation reasons, confirmed violations, deactivation (077)

Apply `077_conduct_monitoring_and_deactivation.sql` after 076. The app build
that asks for a cancellation reason writes the new booking columns, so apply
this migration before shipping that build.

- `bookings` gains `cancelled_by`, `cancellation_reason`, `cancellation_valid`
  and `cancelled_at`. The server sets validity from the reason
  (`is_valid_cancellation_reason`) and locks the details once written.
- `driver_violations.status` adds `confirmed` (open → confirmed → resolved, or
  open → dismissed). Passengers can read their own violation rows.
- `users.status` adds `deactivated` with `deactivated_at`, `deactivated_by` and
  `deactivation_reason`. Only `admin_deactivate_user(uuid, text)` can set it; it
  cannot be reversed from the app, and `admin_delete_user` refuses deactivated
  accounts so their records are kept.


## Driver registration documents (078)

Apply `078_driver_registration_documents.sql` after 077, before shipping the
build with the document pickers on the driver sign-up form.

- `driver_documents`: one photo per document (driver's license, plate, OR, CR),
  each reviewed by an admin (pending / approved / rejected with remarks).
- `users.driver_documents_status` (missing / pending / approved / rejected) is
  kept by triggers; drivers cannot edit it.
- `submit_driver_documents(text, jsonb)` is the driver's only upload path; it
  also saves `home_address`. Approved documents are locked.
- Admins can verify a driver only after all four documents are approved. MTOP
  approval (069) still verifies drivers.
- Drivers are notified of each rejected document and of the application result.


## TODA capacity and flagged-account alerts (079)

Apply `079_toda_capacity_and_flag_alerts.sql` after 078.

- `toda_associations.approved_units` (NULL = not set). The TODA screen shows
  units holding an issued MTOP against it and warns when full.
- All active admins get a notification when an account reaches 3 confirmed
  violations, or a passenger reaches 3 cancellations without a valid reason,
  within the rolling 7 days (Asia/Manila). It fires once when the count
  reaches 3. Keep in step with `CONDUCT_FLAG_THRESHOLD` / `CONDUCT_WINDOW_DAYS`.


## Passenger fare discounts (080)

Apply `080_passenger_fare_discounts.sql` after 079, before shipping the build
with the "Fare discount" picker (a Senior/PWD/Student booking fails on a
database without these columns; regular bookings keep working).

- `bookings.passenger_type` (regular / senior / pwd / student),
  `discount_pct`, `discount_amount`. `total_fare` is net of the discount.
- `enforce_booking_insert` (068) now also applies the discount server-side:
  20% off one passenger's share (RA 9994, RA 10754, RA 11314). The rest of
  the function is unchanged. Keep in step with `PASSENGER_DISCOUNT_PCT`.


## Discount ID photo and fare revert (081)

Apply `081_discount_id_photo_and_revert.sql` after 080, before shipping the
build with the student ID picker (a Student booking still books without it,
but the ID photo upload fails).

- `booking_discount_ids`: one ID photo per discounted booking, outside
  `bookings` so it is not sent with every query. Visible to whoever can see the
  booking (passenger, assigned driver, drivers viewing the open request, admins).
- `attach_discount_id(uuid, text)`: the passenger's only upload path, while the
  booking is pending. The app requires it for Student.
- `revert_booking_discount(uuid, text)`: the assigned driver removes the
  discount during the ride when the ID is missing or not valid. `total_fare`
  goes back to the regular fare, `discount_revoked_at` / `discount_revoked_reason`
  are stamped and the passenger is notified. Refused once a ride payment was
  submitted or the ride is completed.
- `protect_booking_financial_fields` (040) also locks the discount columns
  against direct client updates.


## Body numbers per route, inactive body numbers (082)

Apply `082_body_number_routes_and_release.sql` after 081, before shipping the
build with the route picker and "Release body no." (issuing without a route,
and the rest of the app, keep working on a database without 082).

- `franchise_applications.route_id` → `toda_routes`: picked by the admin with
  the body number at MTOP issuance (required when the TODA has routes). A
  renewal keeps the route of the unit it renews. Drivers cannot set it.
- `body_number_released_at` / `_by` / `_release_reason`: a terminated or
  transferred unit keeps blocking its body number until an admin runs
  `release_body_number(uuid, text)` with a reason. Every record of that number
  in the TODA is stamped and kept as history.
- `idx_franchise_body_number` (072) now ignores released records, so a
  released number can be issued again. Refused while an active or open MTOP
  still holds the number.
- `enforce_mtop_workflow` is the 074 version plus these rules.


## Live admin notifications (083)

Apply `083_admin_live_notifications.sql` after 082. Until it is applied the
admin badges still work (they count pending work directly), but no alerts are
created.

Every active admin gets a notification (live bell badge, heads-up banner on
phones) when a driver or passenger account is created, a driver submits or
re-uploads registration photos, an MTOP application or renewal is filed, a
driver re-uploads an MTOP document, sends MTOP payment proof or books a payment
appointment, requests a Change of Unit, a holder requests a succession, or a
report is filed. Types start with `admin_`. Triggers never block the original
write.


## Driver sign-up without photos (084)

Apply `084_driver_signup_without_photos.sql` after 083. The license / plate /
OR / CR photos are required in the MTOP application, so the app no longer
asks for them at driver sign-up.

- `guard_driver_verification` (078) no longer requires four approved photos
  before an admin verifies a driver; MTOP approval still verifies (069).
- The "driver documents to review" admin alert (083) is removed; the
  new-driver alert points to the MTOP application.
- `driver_documents` and older uploads are kept; admins still see them on the
  driver profile.

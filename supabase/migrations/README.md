# Supabase Migrations

SQL migrations for the Smart Trike backend. Apply them **in numeric order**
(`001` → `024`) against the linked Supabase project (`ref: dauehvjvypzeouxxviom`).

---

## ⚠️ ACTION REQUIRED — pending migrations (needs Supabase access)

> The next developer with **Supabase access** (DB password _or_ a personal
> access token) must apply the migrations below to the **live** project. They
> have NOT been applied yet because the current environment only has the public
> anon key, which cannot run DDL (`CREATE TABLE` / `CREATE FUNCTION`).

| Migration | Purpose | Status |
|-----------|---------|--------|
| `020_create_emoney_tables.sql` | E-money wallet tables (`emoney_accounts`, `emoney_transactions`) + RLS + triggers | ✅ APPLIED 2026-06-29 |
| `021_emoney_trip_payment.sql` | `pay_trip_with_emoney()` RPC — atomic fare debit + driver payout on trip completion | ✅ APPLIED 2026-06-29 |
| `022_chat_participants_view_profiles.sql` | RLS so a booking's passenger & driver can read each other's profile (real names/photos in chat + Messages inbox) | ✅ APPLIED 2026-06-29 |
| `023_fix_users_policy_recursion.sql` | HOTFIX: 022's policy recursed (users→bookings→users) and broke ALL logins ("profile not found"); moved the check into a SECURITY DEFINER fn | ✅ APPLIED 2026-06-29 |
| `024_fix_booking_completion_payment_status.sql` | BUGFIX: completion trigger set `payment_status='paid'` (violates CHECK → every trip-complete failed 400) and pre-settled e-money so the wallet never debited. Now: 'completed', cash-only auto-settle | ✅ APPLIED 2026-06-29 |

**Until these are applied:** the e-money wallet screens and trip settlement will
silently fail / fall back to cash (`BookingService.completeTrip` swallows the
error on purpose so trip completion never blocks). The passenger "Paid ₱X via
GCash" confirmation will not appear. The Messages inbox & chat still work
without `022`, but the other party shows as "Your Driver" / "Your Passenger"
instead of their real name until it is applied.

After applying, tick the boxes above and commit.

---

## How to apply

Pick whichever matches the access you have.

### Option A — Supabase SQL Editor (no tooling needed)
1. Open the project → **SQL Editor** → **New query**.
2. Paste the **entire contents** of `020_create_emoney_tables.sql`, run it.
3. Paste the **entire contents** of `021_emoney_trip_payment.sql`, run it.
4. Both are safe to re-run (`IF NOT EXISTS` / `CREATE OR REPLACE`), except the
   plain `CREATE INDEX` / `CREATE TRIGGER` in `020` — if a partial run already
   created those, drop them first or ignore the "already exists" errors.

### Option B — Supabase CLI with a personal access token
```bash
# token from https://supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN=sbp_xxx        # PowerShell: $env:SUPABASE_ACCESS_TOKEN="sbp_xxx"
npx supabase login --token $SUPABASE_ACCESS_TOKEN
npx supabase link --project-ref dauehvjvypzeouxxviom
npx supabase db push
```

### Option C — direct connection with the DB password
```bash
# password from Project Settings → Database
npx supabase db push --db-url "postgresql://postgres.dauehvjvypzeouxxviom:<DB_PASSWORD>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"
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
```

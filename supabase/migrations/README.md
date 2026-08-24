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

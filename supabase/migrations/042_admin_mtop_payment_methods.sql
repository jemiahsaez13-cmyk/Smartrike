-- Migration 042: Admin MTOP payment methods
-- Stores the payment options the TODA admin configures for MTOP billing:
-- GCash, bank transfer, or face-to-face with address + optional map pin.

create table if not exists admin_mtop_payment_methods (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references auth.users(id) on delete cascade,
  method_type text not null check (method_type in ('gcash', 'bank', 'face_to_face')),
  display_name text not null,
  account_name text not null,
  -- gcash / bank fields
  account_number text,
  qr_code_url    text,
  -- face_to_face fields
  address        text,
  location_lat   double precision,
  location_lng   double precision,
  -- shared
  instructions   text,
  is_enabled     boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Admins may only read / write their own rows.
alter table admin_mtop_payment_methods enable row level security;

create policy "admin_mtop_payment_methods_select"
  on admin_mtop_payment_methods for select
  using (
    -- Admin owners see all their rows; authenticated users see enabled rows
    -- (so the billing modal can display options without knowing the admin id).
    auth.uid() = admin_id
    or (
      is_enabled = true
      and exists (
        select 1 from users where id = auth.uid()
      )
    )
  );

create policy "admin_mtop_payment_methods_insert"
  on admin_mtop_payment_methods for insert
  with check (
    auth.uid() = admin_id
    and exists (
      select 1 from users where id = auth.uid() and user_type = 'admin'
    )
  );

create policy "admin_mtop_payment_methods_update"
  on admin_mtop_payment_methods for update
  using (
    auth.uid() = admin_id
    and exists (
      select 1 from users where id = auth.uid() and user_type = 'admin'
    )
  );

create policy "admin_mtop_payment_methods_delete"
  on admin_mtop_payment_methods for delete
  using (
    auth.uid() = admin_id
    and exists (
      select 1 from users where id = auth.uid() and user_type = 'admin'
    )
  );

-- Index to speed up admin list queries.
create index if not exists idx_admin_mtop_payment_methods_admin
  on admin_mtop_payment_methods (admin_id);

-- Index to speed up "list all enabled" (billing modal).
create index if not exists idx_admin_mtop_payment_methods_enabled
  on admin_mtop_payment_methods (is_enabled)
  where is_enabled = true;

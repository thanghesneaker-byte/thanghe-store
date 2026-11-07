-- ThangHeStore V3 / admin-only order dashboard (demo stage).
-- Separate from public.orders/public.order_items to protect existing orders.
-- This script does NOT create real orders, charge money or alter product stock.
-- Run once in Supabase SQL Editor. Safe to rerun.

create table if not exists public.store_orders_v3 (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_phone text not null check (char_length(customer_phone) between 8 and 20),
  customer_address text not null check (char_length(customer_address) between 5 and 500),
  note text not null default '' check (char_length(note) <= 1000),
  items jsonb not null check (
    jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 30
  ),
  total_vnd bigint not null check (total_vnd >= 0),
  status text not null default 'pending' check (
    status in ('pending','confirmed','shipping','completed','cancelled')
  ),
  is_demo boolean not null default true check (is_demo = true),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_orders_v3_created_idx
  on public.store_orders_v3 (created_at desc);
create index if not exists store_orders_v3_status_idx
  on public.store_orders_v3 (status, created_at desc);

alter table public.store_orders_v3 enable row level security;

-- Do not expose this admin-only dataset to the anonymous role.
revoke all on public.store_orders_v3 from anon;
revoke all on public.store_orders_v3 from public;
grant select, insert on public.store_orders_v3 to authenticated;
-- Only permit status writes through direct browser clients; all other
-- order fields are immutable once the demo row exists.
grant update (status) on public.store_orders_v3 to authenticated;

drop policy if exists "store_orders_v3_admin_select" on public.store_orders_v3;
create policy "store_orders_v3_admin_select"
on public.store_orders_v3 for select to authenticated
using (exists (
  select 1 from public.admin_users au
  where au.user_id = (select auth.uid())
));

drop policy if exists "store_orders_v3_admin_insert_demo" on public.store_orders_v3;
create policy "store_orders_v3_admin_insert_demo"
on public.store_orders_v3 for insert to authenticated
with check (
  is_demo = true and exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid())
  )
);

drop policy if exists "store_orders_v3_admin_update_status" on public.store_orders_v3;
create policy "store_orders_v3_admin_update_status"
on public.store_orders_v3 for update to authenticated
using (exists (
  select 1 from public.admin_users au
  where au.user_id = (select auth.uid())
))
with check (
  is_demo = true and exists (
    select 1 from public.admin_users au
    where au.user_id = (select auth.uid())
  )
);

-- No DELETE policy or grants. The admin page does not delete orders.
-- No public INSERT policy: the checkout remains demo-only and cannot
-- submit an order to this table without an authenticated admin account.

comment on table public.store_orders_v3 is
 'Admin-only demo orders for ThangHeStore V3. Not a production checkout order table.';

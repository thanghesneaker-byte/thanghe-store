-- ThangHeStore V3: STAGED real-order backend. DO NOT ENABLE LIVE CHECKOUT YET.
-- Does not modify public.orders, public.order_items or store_orders_v3 (demo).
-- No inventory updates occur until an authorized admin confirms a real order.
-- Store no personal customer information during demo testing.
-- Server-only functions: service_role permissions; NEVER place service keys in client code.

create table if not exists public.store_checkout_orders_v3 (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  customer_name text not null check (char_length(btrim(customer_name)) between 2 and 120),
  customer_phone text not null check (customer_phone ~ '^0[0-9]{9}$'),
  customer_address text not null check (char_length(btrim(customer_address)) between 10 and 500),
  note text not null default '' check (char_length(note) <= 500),
  items jsonb not null check (
    jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 20
  ),
  total_vnd bigint not null check (total_vnd > 0 and total_vnd <= 500000000),
  status text not null default 'pending'
    check (status in ('pending','confirmed','shipping','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists store_checkout_orders_v3_latest
  on public.store_checkout_orders_v3(created_at desc);
create index if not exists store_checkout_orders_v3_status
  on public.store_checkout_orders_v3(status, created_at desc);

alter table public.store_checkout_orders_v3 enable row level security;
revoke all on public.store_checkout_orders_v3 from public, anon, authenticated;
grant select, insert, update on public.store_checkout_orders_v3 to service_role;

-- Atomic creation with server-retrieved price and available stock.
-- Pending orders do not reserve or deduct stock. Stock is deducted only
-- at confirmation, in the same database transaction.
create or replace function public.store_v3_place_checkout(
  p_request_id uuid,
  p_name text,
  p_phone text,
  p_address text,
  p_note text,
  p_items jsonb
) returns jsonb language plpgsql security invoker set search_path = ''
as $body$
declare
  v_id uuid;
  v_total bigint := 0;
  v_items jsonb := '[]'::jsonb;
  v_entry jsonb;
  v_product uuid;
  v_size text;
  v_qty integer;
  v_stock bigint;
  v_price bigint;
  v_name text;
  v_subtotal bigint;
  v_key text;
  v_seen text[] := array[]::text[];
begin
  if p_request_id is null then raise exception 'Invalid request ID'; end if;
  select o.id, o.total_vnd into v_id, v_total
    from public.store_checkout_orders_v3 o where o.request_id = p_request_id;
  if found then return jsonb_build_object('id',v_id,'total_vnd',v_total,'duplicate',true); end if;
  v_total := 0;

  if p_name is null or char_length(btrim(p_name)) not between 2 and 120
     or p_phone is null or p_phone !~ '^0[0-9]{9}$'
     or p_address is null or char_length(btrim(p_address)) not between 10 and 500
     or char_length(coalesce(p_note,'')) > 500 then
    raise exception 'Invalid customer details';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then
    raise exception 'Invalid order items';
  end if;

  for v_entry in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_entry) <> 'object'
      or coalesce(v_entry->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(v_entry->>'size','') !~ '^[0-9A-Za-z .-]{1,12}$'
      or coalesce(v_entry->>'qty','') !~ '^[1-9][0-9]?$' then
      raise exception 'Invalid item';
    end if;
    v_product := (v_entry->>'id')::uuid;
    v_size := v_entry->>'size';
    v_qty := (v_entry->>'qty')::integer;
    if v_qty > 10 then raise exception 'Item quantity is too high'; end if;
    v_key := v_product::text || '/' || v_size;
    if v_key = any(v_seen) then raise exception 'Duplicate size in order'; end if;
    v_seen := array_append(v_seen,v_key);

    select p.price_vnd::bigint, p.name into v_price, v_name
      from public.products p
      where p.id = v_product and p.is_active = true and p.deleted_at is null
        and p.price_vnd > 0 and p.price_vnd = trunc(p.price_vnd);
    if not found or v_price <= 0 then raise exception 'Product unavailable'; end if;

    select coalesce(sum(greatest(v.stock_quantity,0)),0)
      into v_stock from public.product_variants v
      where v.product_id = v_product and v.size = v_size;
    if v_qty > v_stock then raise exception 'Insufficient stock'; end if;

    v_subtotal := v_price * v_qty;
    v_total := v_total + v_subtotal;
    if v_total > 500000000 then raise exception 'Order exceeds limit'; end if;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'product_id',v_product,'name',v_name,'size',v_size,'quantity',v_qty,
      'price_vnd',v_price,'line_total_vnd',v_subtotal
    ));
  end loop;

  if array_length(v_seen,1) > 20 or
     (select coalesce(sum((e->>'quantity')::integer),0)
      from jsonb_array_elements(v_items) e) > 30 then
    raise exception 'Order quantity exceeds limit';
  end if;

  insert into public.store_checkout_orders_v3
    (request_id,customer_name,customer_phone,customer_address,note,items,total_vnd,status)
    values (p_request_id,btrim(p_name),p_phone,btrim(p_address),coalesce(p_note,''),v_items,v_total,'pending')
    on conflict (request_id) do nothing returning id into v_id;
  if v_id is null then
    select o.id, o.total_vnd into v_id, v_total
    from public.store_checkout_orders_v3 o where o.request_id=p_request_id;
  end if;
  return jsonb_build_object('id',v_id,'total_vnd',v_total,'duplicate',false);
end
$body$;

-- Confirming an order locks all size variants and decrements stock
-- atomically. Any shortfall raises an error and rolls back EVERY change.
-- Do not allow cancellation after confirmation in this initial version:
-- returns / refunds require a separate audited restocking workflow.
create or replace function public.store_v3_transition_checkout(
  p_order_id uuid, p_expected_status text, p_next_status text
) returns text language plpgsql security invoker set search_path = ''
as $body$
declare
  v_order public.store_checkout_orders_v3%rowtype;
  v_item jsonb;
  v_variant record;
  v_remaining integer;
  v_take integer;
begin
  select * into v_order from public.store_checkout_orders_v3
    where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status <> p_expected_status then raise exception 'Order status has changed'; end if;
  if not (
      (p_expected_status = 'pending' and p_next_status in ('confirmed','cancelled'))
      or (p_expected_status = 'confirmed' and p_next_status = 'shipping')
      or (p_expected_status = 'shipping' and p_next_status = 'completed')
  ) then raise exception 'Invalid status transition'; end if;

  if p_next_status = 'confirmed' then
    for v_item in
      select value from jsonb_array_elements(v_order.items)
      order by value->>'product_id', value->>'size'
    loop
      if not exists (
        select 1 from public.products p
        where p.id=(v_item->>'product_id')::uuid
          and p.is_active = true and p.deleted_at is null
      ) then raise exception 'Product unavailable'; end if;
      v_remaining := (v_item->>'quantity')::integer;
      for v_variant in
        select id, stock_quantity from public.product_variants
          where product_id=(v_item->>'product_id')::uuid
            and size=v_item->>'size'
          order by id for update
      loop
        v_take := least(v_remaining, greatest(v_variant.stock_quantity,0));
        if v_take > 0 then
          update public.product_variants
          set stock_quantity = stock_quantity - v_take
          where id = v_variant.id;
          v_remaining := v_remaining - v_take;
        end if;
        exit when v_remaining = 0;
      end loop;
      if v_remaining > 0 then raise exception 'Insufficient stock to confirm order'; end if;
    end loop;
  end if;
  update public.store_checkout_orders_v3
    set status=p_next_status, updated_at=now()
    where id=p_order_id;
  return p_next_status;
end
$body$;

-- PostgreSQL grants EXECUTE to PUBLIC on functions by default.
revoke all on function public.store_v3_place_checkout(uuid,text,text,text,text,jsonb)
  from public, anon, authenticated;
revoke all on function public.store_v3_transition_checkout(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.store_v3_place_checkout(uuid,text,text,text,text,jsonb)
  to service_role;
grant execute on function public.store_v3_transition_checkout(uuid,text,text)
  to service_role;

comment on table public.store_checkout_orders_v3 is
  'Staged V3 real checkout orders. Checkout disabled at application layer until explicitly approved.';

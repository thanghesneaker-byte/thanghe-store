
-- ThangHeStore V3: cancellation and exact stock restoration.
-- STAGED ONLY. Do not execute on live Supabase yet.
-- Existing confirmed orders without deduction records cannot auto-restock.

create table if not exists public.store_checkout_stock_movements_v3 (
  order_id uuid not null references public.store_checkout_orders_v3(id),
  variant_id uuid not null references public.product_variants(id),
  movement text not null check (movement in ('deduct', 'restore')),
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  primary key (order_id, variant_id, movement)
);

create table if not exists public.store_checkout_status_history_v3 (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.store_checkout_orders_v3(id),
  old_status text not null,
  new_status text not null,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists checkout_history_order_v3
  on public.store_checkout_status_history_v3(order_id, created_at);

alter table public.store_checkout_stock_movements_v3 enable row level security;
alter table public.store_checkout_status_history_v3 enable row level security;

revoke all on public.store_checkout_stock_movements_v3
  from public, anon, authenticated;
revoke all on public.store_checkout_status_history_v3
  from public, anon, authenticated;

grant select, insert on public.store_checkout_stock_movements_v3 to service_role;
grant select, insert on public.store_checkout_status_history_v3 to service_role;

-- Replace the existing transition function.
-- Record every exact variant deduction in the same transaction.
create or replace function public.store_v3_transition_checkout(
  p_order_id uuid,
  p_expected_status text,
  p_next_status text
) returns text
language plpgsql security invoker set search_path = ''
as $body$
declare
  v_order public.store_checkout_orders_v3%rowtype;
  v_item jsonb;
  v_variant record;
  v_remaining integer;
  v_take integer;
begin
  select * into v_order
  from public.store_checkout_orders_v3
  where id = p_order_id for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status <> p_expected_status then
    raise exception 'Order status has changed';
  end if;

  if not (
    (p_expected_status = 'pending'
      and p_next_status in ('confirmed', 'cancelled'))
    or (p_expected_status = 'confirmed'
      and p_next_status = 'shipping')
    or (p_expected_status = 'shipping'
      and p_next_status = 'completed')
  ) then
    raise exception 'Invalid status transition';
  end if;

  if p_next_status = 'confirmed' then
    for v_item in
      select value from jsonb_array_elements(v_order.items)
      order by value->>'product_id', value->>'size'
    loop
      if not exists (
        select 1 from public.products p
        where p.id = (v_item->>'product_id')::uuid
          and p.is_active = true
          and p.deleted_at is null
      ) then
        raise exception 'Product unavailable';
      end if;

      v_remaining := (v_item->>'quantity')::integer;

      for v_variant in
        select id, stock_quantity
        from public.product_variants
        where product_id = (v_item->>'product_id')::uuid
          and size = v_item->>'size'
        order by id for update
      loop
        v_take := least(
          v_remaining,
          greatest(v_variant.stock_quantity, 0)
        );

        if v_take > 0 then
          update public.product_variants
          set stock_quantity = stock_quantity - v_take
          where id = v_variant.id;

          insert into public.store_checkout_stock_movements_v3
            (order_id, variant_id, movement, quantity)
          values (p_order_id, v_variant.id, 'deduct', v_take);

          v_remaining := v_remaining - v_take;
        end if;

        exit when v_remaining = 0;
      end loop;

      if v_remaining > 0 then
        raise exception 'Insufficient stock to confirm order';
      end if;
    end loop;
  end if;

  update public.store_checkout_orders_v3
  set status = p_next_status, updated_at = now()
  where id = p_order_id;

  insert into public.store_checkout_status_history_v3
    (order_id, old_status, new_status, reason)
  values (
    p_order_id,
    p_expected_status,
    p_next_status,
    case when p_next_status = 'cancelled'
      then 'Cancelled while pending'
      else 'Admin status transition'
    end
  );

  return p_next_status;
end
$body$;

-- Cancellation with a required reason.
-- Only pending or confirmed orders can be cancelled.
-- Shipping/completed orders require a separate returns process.
create or replace function public.store_v3_cancel_checkout(
  p_order_id uuid,
  p_expected_status text,
  p_reason text
) returns text
language plpgsql security invoker set search_path = ''
as $body$
declare
  v_order public.store_checkout_orders_v3%rowtype;
  v_expected integer;
  v_deducted integer;
  v_restored integer;
  v_row record;
begin
  if p_expected_status not in ('pending', 'confirmed')
     or p_reason is null
     or char_length(btrim(p_reason)) not between 5 and 500 then
    raise exception 'Invalid cancellation request';
  end if;

  select * into v_order
  from public.store_checkout_orders_v3
  where id = p_order_id for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.status <> p_expected_status then
    raise exception 'Order status has changed';
  end if;

  if v_order.status = 'confirmed' then
    select coalesce(sum((e.value->>'quantity')::integer), 0)
    into v_expected
    from jsonb_array_elements(v_order.items) as e(value);

    select coalesce(sum(quantity), 0)
    into v_deducted
    from public.store_checkout_stock_movements_v3
    where order_id = p_order_id and movement = 'deduct';

    select coalesce(sum(quantity), 0)
    into v_restored
    from public.store_checkout_stock_movements_v3
    where order_id = p_order_id and movement = 'restore';

    -- Reject legacy orders without exact deduction records.
    if v_expected <= 0 or v_deducted <> v_expected
       or v_restored <> 0 then
      raise exception 'Unsafe restock: missing or inconsistent ledger';
    end if;

    for v_row in
      select variant_id, quantity
      from public.store_checkout_stock_movements_v3
      where order_id = p_order_id and movement = 'deduct'
      order by variant_id
    loop
      update public.product_variants
      set stock_quantity = stock_quantity + v_row.quantity
      where id = v_row.variant_id;

      if not found then
        raise exception 'Inventory variant missing';
      end if;

      insert into public.store_checkout_stock_movements_v3
        (order_id, variant_id, movement, quantity)
      values (
        p_order_id, v_row.variant_id, 'restore', v_row.quantity
      );
    end loop;
  end if;

  update public.store_checkout_orders_v3
  set status = 'cancelled', updated_at = now()
  where id = p_order_id;

  insert into public.store_checkout_status_history_v3
    (order_id, old_status, new_status, reason)
  values (
    p_order_id, p_expected_status, 'cancelled', btrim(p_reason)
  );

  return 'cancelled';
end
$body$;

-- Keep both RPCs unavailable to public browser roles.
revoke all on function public.store_v3_transition_checkout(uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.store_v3_cancel_checkout(uuid,text,text)
  from public, anon, authenticated;

grant execute on function public.store_v3_transition_checkout(uuid,text,text)
  to service_role;
grant execute on function public.store_v3_cancel_checkout(uuid,text,text)
  to service_role;

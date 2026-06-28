-- 상품·추천 seed 이후 SQL Editor에서 실행 (기존 DB에 추가)

-- ===== 주문 =====
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  total_amount integer not null check (total_amount >= 0),
  total_qty integer not null check (total_qty > 0),
  status text not null default 'completed' check (status in ('completed', 'failed', 'cancelled')),
  source text not null default 'kiosk',
  recommendation_note text,
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  vitamin_id bigint not null references public.vitamins (id),
  product_name text not null,
  category text not null default '',
  quantity integer not null check (quantity > 0),
  unit_price integer not null check (unit_price > 0),
  line_total integer not null check (line_total > 0)
);

create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists orders_created_idx on public.orders (created_at desc);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "orders_public_read" on public.orders;
create policy "orders_public_read"
  on public.orders for select to anon, authenticated using (true);

drop policy if exists "order_items_public_read" on public.order_items;
create policy "order_items_public_read"
  on public.order_items for select to anon, authenticated using (true);

-- 장바구니 결제 + 재고 차감 (anon 키로 호출)
create or replace function public.place_order(
  items jsonb,
  p_recommendation_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total integer := 0;
  v_qty integer := 0;
  item jsonb;
  v_vitamin_id bigint;
  v_quantity integer;
  v_price integer;
  v_stock integer;
  v_name text;
  v_category text;
begin
  if items is null or jsonb_array_length(items) = 0 then
    raise exception '장바구니가 비어 있습니다.';
  end if;

  for item in select * from jsonb_array_elements(items)
  loop
    v_vitamin_id := (item->>'vitamin_id')::bigint;
    v_quantity := (item->>'quantity')::integer;

    if v_quantity is null or v_quantity < 1 then
      raise exception '수량이 올바르지 않습니다.';
    end if;

    select price, stock, name, category
      into v_price, v_stock, v_name, v_category
    from public.vitamins
    where id = v_vitamin_id and is_active = true;

    if not found then
      raise exception '상품을 찾을 수 없습니다: %', v_vitamin_id;
    end if;

    if v_stock < v_quantity then
      raise exception '재고가 부족합니다: % (잔여 %)', v_name, v_stock;
    end if;

    v_total := v_total + (v_price * v_quantity);
    v_qty := v_qty + v_quantity;
  end loop;

  insert into public.orders (total_amount, total_qty, recommendation_note)
  values (v_total, v_qty, p_recommendation_note)
  returning id into v_order_id;

  for item in select * from jsonb_array_elements(items)
  loop
    v_vitamin_id := (item->>'vitamin_id')::bigint;
    v_quantity := (item->>'quantity')::integer;

    select price, name, category
      into v_price, v_name, v_category
    from public.vitamins
    where id = v_vitamin_id;

    insert into public.order_items (
      order_id, vitamin_id, product_name, category, quantity, unit_price, line_total
    ) values (
      v_order_id, v_vitamin_id, v_name, v_category, v_quantity, v_price, v_price * v_quantity
    );

    update public.vitamins
    set stock = stock - v_quantity, updated_at = now()
    where id = v_vitamin_id;
  end loop;

  return v_order_id;
end;
$$;

grant execute on function public.place_order(jsonb, text) to anon, authenticated;

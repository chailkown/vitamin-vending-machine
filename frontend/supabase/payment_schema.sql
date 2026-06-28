-- orders_schema.sql 실행 후 추가 실행 (결제 수단 컬럼 + place_order 갱신)

alter table public.orders
  add column if not exists payment_method text not null default 'card';

comment on column public.orders.payment_method is 'card | mobile | cash';

drop function if exists public.place_order(jsonb, text);

create or replace function public.place_order(
  items jsonb,
  p_recommendation_note text default null,
  p_payment_method text default 'card'
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
  v_payment text;
begin
  v_payment := coalesce(nullif(trim(p_payment_method), ''), 'card');
  if v_payment not in ('card', 'mobile', 'cash') then
    raise exception '지원하지 않는 결제 수단입니다: %', v_payment;
  end if;

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

  insert into public.orders (total_amount, total_qty, recommendation_note, payment_method)
  values (v_total, v_qty, p_recommendation_note, v_payment)
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

grant execute on function public.place_order(jsonb, text, text) to anon, authenticated;

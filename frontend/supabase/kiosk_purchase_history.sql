-- Non-destructive update. Run AFTER schema.sql, orders_schema.sql, payment_schema.sql
-- and health-app-web/supabase/app_schema.sql. Never re-run seed.sql on live inventory.
begin;

alter table public.vitamins add column if not exists dispenser_slot integer;
alter table public.vitamins drop constraint if exists vitamins_dispenser_slot_check;
alter table public.vitamins add constraint vitamins_dispenser_slot_check check (dispenser_slot between 1 and 20);
create unique index if not exists vitamins_dispenser_slot_unique on public.vitamins(dispenser_slot) where dispenser_slot is not null;
comment on column public.vitamins.dispenser_slot is 'Physical pouch slot 1..20; Pi owns Arduino pin/runtime mapping. NULL means not connected.';
comment on column public.vitamins.price is '1회분 파우치당 가격(원)';

alter table public.orders add column if not exists user_id text references public.app_users(user_id);
alter table public.orders add column if not exists request_id uuid;
alter table public.orders add column if not exists completed_at timestamptz;
alter table public.orders add column if not exists is_simulated boolean not null default false;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('dispensing','completed','failed','cancelled','review_required'));
alter table public.orders alter column status set default 'dispensing';
alter table public.order_items add column if not exists dispenser_slot integer;
create unique index if not exists orders_request_unique on public.orders(request_id) where request_id is not null;
create index if not exists orders_user_completed_idx on public.orders(user_id, completed_at desc) where status = 'completed';

-- Remove the old public-order read policies. New history access is a credential-checked RPC.
drop policy if exists orders_public_read on public.orders;
drop policy if exists order_items_public_read on public.order_items;
revoke all on public.orders, public.order_items from anon, authenticated;
-- Legacy RPCs mark completed before hardware; clients must not keep using them.
do $$ begin
  if to_regprocedure('public.place_order(jsonb,text)') is not null then
    revoke execute on function public.place_order(jsonb,text) from public, anon, authenticated;
  end if;
  if to_regprocedure('public.place_order(jsonb,text,text)') is not null then
    revoke execute on function public.place_order(jsonb,text,text) from public, anon, authenticated;
  end if;
end $$;

create or replace function public.place_kiosk_order(
  items jsonb, p_request_id uuid, p_user_id text default null,
  p_recommendation_note text default null, p_payment_method text default 'card'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_product public.vitamins%rowtype;
  v_item record;
  v_total integer := 0;
  v_qty integer := 0;
  v_snapshot jsonb := '[]'::jsonb;
begin
  if p_request_id is null then raise exception '주문 요청 ID가 없습니다.'; end if;
  -- Serialize identical retries before testing existence; preserves exactly one reservation.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into v_order from public.orders where request_id = p_request_id;
  if found then
    if v_order.user_id is distinct from p_user_id then raise exception '주문 사용자 불일치'; end if;
    return jsonb_build_object('order_id',v_order.id,'status',v_order.status,'total_amount',v_order.total_amount,
      'total_qty',v_order.total_qty,'items',(select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.order_items i where order_id=v_order.id));
  end if;
  if items is null or jsonb_typeof(items) <> 'array' then raise exception '장바구니 형식 오류'; end if;
  if jsonb_array_length(items) not between 1 and 24 then raise exception '장바구니 수량 오류'; end if;
  if p_payment_method is null or p_payment_method not in ('card','mobile','cash') then raise exception '결제 수단 오류'; end if;
  if p_user_id is not null and not exists (select 1 from public.app_users where user_id=p_user_id) then
    raise exception '앱 사용자 정보가 없습니다. 앱에서 클라우드 회원가입을 확인해주세요.';
  end if;
  if exists (select 1 from jsonb_array_elements(items) e where
    jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'vitamin_id') is distinct from 'number'
    or jsonb_typeof(e->'quantity') is distinct from 'number'
    or coalesce(e->>'vitamin_id','') !~ '^[1-9][0-9]*$'
    or coalesce(e->>'quantity','') !~ '^[1-9][0-9]*$') then raise exception '상품 또는 수량 오류'; end if;

  -- Aggregate duplicate products, then lock all products in stable ID order.
  for v_item in select (e->>'vitamin_id')::bigint as product_id, sum((e->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(items) e group by (e->>'vitamin_id')::bigint order by product_id
  loop
    if v_item.quantity not between 1 and 100 then raise exception '수량은 상품별 1~100 파우치입니다.'; end if;
    select * into v_product from public.vitamins where id=v_item.product_id and is_active=true for update;
    if not found then raise exception '상품을 찾을 수 없습니다: %',v_item.product_id; end if;
    if v_product.stock < v_item.quantity then raise exception '재고가 부족합니다: % (잔여 %)',v_product.name,v_product.stock; end if;
    v_total := v_total + v_product.price * v_item.quantity;
    v_qty := v_qty + v_item.quantity;
    v_snapshot := v_snapshot || jsonb_build_array(jsonb_build_object(
      'vitamin_id',v_product.id,'product_name',v_product.name,'category',v_product.category,
      'quantity',v_item.quantity,'unit_price',v_product.price,'line_total',v_product.price*v_item.quantity,
      'dispenser_slot',v_product.dispenser_slot));
  end loop;
  insert into public.orders(total_amount,total_qty,status,user_id,request_id,recommendation_note,payment_method)
    values(v_total,v_qty,'dispensing',p_user_id,p_request_id,p_recommendation_note,p_payment_method) returning * into v_order;
  insert into public.order_items(order_id,vitamin_id,product_name,category,quantity,unit_price,line_total,dispenser_slot)
    select v_order.id,x.vitamin_id,x.product_name,x.category,x.quantity,x.unit_price,x.line_total,x.dispenser_slot
    from jsonb_to_recordset(v_snapshot) as x(vitamin_id bigint,product_name text,category text,quantity integer,unit_price integer,line_total integer,dispenser_slot integer);
  update public.vitamins v set stock=v.stock-x.quantity,updated_at=now()
    from jsonb_to_recordset(v_snapshot) as x(vitamin_id bigint,quantity integer) where v.id=x.vitamin_id;
  return jsonb_build_object('order_id',v_order.id,'status','dispensing','total_amount',v_total,'total_qty',v_qty,'items',v_snapshot);
end $$;

create or replace function public.finish_kiosk_order(
  p_order_id uuid, p_request_id uuid, p_result text, p_simulated boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order public.orders%rowtype; v_item record;
begin
  if p_result is null or p_result not in ('completed','failed','review_required') then raise exception '주문 결과 오류'; end if;
  select * into v_order from public.orders where id=p_order_id and request_id=p_request_id for update;
  if not found then raise exception '주문 확인 실패'; end if;
  if v_order.status not in ('dispensing','review_required') and v_order.status <> p_result then raise exception '이미 확정된 주문입니다.'; end if;
  if v_order.status <> p_result then
    if p_result='failed' then
      -- Only use failed when the Pi confirms NOT A SINGLE pouch command started.
      for v_item in select vitamin_id,quantity from public.order_items where order_id=p_order_id order by vitamin_id loop
        update public.vitamins set stock=stock+v_item.quantity,updated_at=now() where id=v_item.vitamin_id;
      end loop;
    end if;
    update public.orders set status=p_result,completed_at=case when p_result='completed' then now() else null end,
      is_simulated=p_simulated where id=p_order_id returning * into v_order;
  end if;
  return jsonb_build_object('order_id',v_order.id,'status',v_order.status,'total_amount',v_order.total_amount,
    'total_qty',v_order.total_qty,'payment_method',v_order.payment_method);
end $$;

-- Minimal demo separation; NOT a replacement for Supabase Auth or secure password storage.
create or replace function public.get_app_purchase_history(p_user_id text,p_password text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.app_users where user_id=p_user_id and password=p_password) then
    raise exception '로그인 정보를 확인해주세요.';
  end if;
  return (select coalesce(jsonb_agg(record order by completed_at desc), '[]'::jsonb) from (
    select o.id,o.user_id,o.total_amount,o.total_qty,o.status,o.payment_method,o.created_at,o.completed_at,o.is_simulated,
      (select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'product_name',i.product_name,'quantity',i.quantity,
        'unit_price',i.unit_price,'line_total',i.line_total) order by i.id),'[]'::jsonb) from public.order_items i where i.order_id=o.id) as order_items
    from public.orders o where o.user_id=p_user_id and o.status='completed' order by o.completed_at desc limit 100
  ) record);
end $$;

revoke all on function public.place_kiosk_order(jsonb,uuid,text,text,text) from public;
revoke all on function public.finish_kiosk_order(uuid,uuid,text,boolean) from public;
revoke all on function public.get_app_purchase_history(text,text) from public;
grant execute on function public.place_kiosk_order(jsonb,uuid,text,text,text) to anon,authenticated;
grant execute on function public.finish_kiosk_order(uuid,uuid,text,boolean) to anon,authenticated;
grant execute on function public.get_app_purchase_history(text,text) to anon,authenticated;
commit;

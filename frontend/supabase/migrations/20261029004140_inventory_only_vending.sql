-- Upgrade the existing free-vending schema. No stock reset, account deletion,
-- health data transfer or changes to historical member orders.
begin;
-- Block new reservations while checking and changing slot assignments.
lock table private.kiosk_devices,public.orders,public.vitamins in access exclusive mode;
create table if not exists private.kiosk_cancelled_requests (
  request_id uuid primary key,
  device_id uuid not null references private.kiosk_devices(id),
  created_at timestamptz not null default now()
);
alter table private.kiosk_cancelled_requests enable row level security;
revoke all on private.kiosk_cancelled_requests from public,anon,authenticated;

create or replace function private.reserve_free_order(
 p_device_id uuid,p_device_token text,p_request_id uuid,items jsonb,p_qr_token text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare device private.kiosk_devices%rowtype; previous private.kiosk_requests%rowtype;
 product public.vitamins%rowtype; entry record; fingerprint text; total_qty integer:=0;
 snapshot jsonb:='[]'::jsonb; order_id uuid;
begin
 select * into device from private.kiosk_devices where id=p_device_id and enabled
   and token_hash=encode(sha256(convert_to(p_device_token,'UTF8')),'hex');
 if not found then raise exception '기기 인증 실패'; end if;
 if p_request_id is null then raise exception '요청 ID가 없습니다.'; end if;
 -- Kept in the signature for old callers only. Never resolve/store QR or member data.
 if items is null or jsonb_typeof(items)<>'array' then raise exception '상품 형식 오류'; end if;
 if jsonb_array_length(items) not between 1 and 5 then raise exception '한 번에 1~5개입니다.'; end if;
 if exists(select 1 from jsonb_array_elements(items) e where jsonb_typeof(e)<>'object'
   or jsonb_typeof(e->'vitamin_id') is distinct from 'number'
   or jsonb_typeof(e->'quantity') is distinct from 'number'
   or coalesce(e->>'vitamin_id','') !~ '^[1-9][0-9]*$'
   or coalesce(e->>'quantity','') !~ '^[1-5]$') then raise exception '상품 또는 수량 오류'; end if;
 select coalesce(sum((e->>'quantity')::integer),0) into total_qty from jsonb_array_elements(items) e;
 if total_qty not between 1 and 5 then raise exception '한 번에 1~5개입니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 if exists(select 1 from private.kiosk_cancelled_requests where request_id=p_request_id) then raise exception '취소된 요청입니다.'; end if;
 fingerprint:=encode(sha256(convert_to(items::text,'UTF8')),'hex');
 select * into previous from private.kiosk_requests where request_id=p_request_id;
 if found then
   if previous.device_id<>p_device_id or previous.fingerprint<>fingerprint then raise exception '요청 내용이 변경되었습니다.'; end if;
   return jsonb_build_object('order_id',previous.order_id,'status',(select status from public.orders where id=previous.order_id),'replayed',true);
 end if;
 if exists(select 1 from public.orders where request_id=p_request_id) then raise exception '이미 사용된 요청 ID'; end if;
 for entry in select (e->>'vitamin_id')::bigint product_id,sum((e->>'quantity')::integer)::integer quantity
   from jsonb_array_elements(items) e group by (e->>'vitamin_id')::bigint order by product_id loop
   select * into product from public.vitamins where id=entry.product_id and is_active for update;
   if not found then raise exception '비활성 또는 없는 상품입니다.'; end if;
   if product.dispenser_slot is null or not coalesce(product.dispenser_slot=any(device.slots),false) then raise exception '허용되지 않은 슬롯입니다.'; end if;
   if product.stock<entry.quantity then raise exception '재고가 부족합니다.'; end if;
   snapshot:=snapshot||jsonb_build_array(jsonb_build_object('vitamin_id',product.id,'product_name',product.name,'category',product.category,
     'quantity',entry.quantity,'dispenser_slot',product.dispenser_slot,'unit_price',0,'line_total',0));
 end loop;
 insert into public.orders(total_amount,total_qty,status,request_id,payment_method,kiosk_device_id)
   values(0,total_qty,'dispensing',p_request_id,'free',p_device_id) returning id into order_id;
 insert into public.order_items(order_id,vitamin_id,product_name,category,quantity,unit_price,line_total,dispenser_slot)
   select order_id,x.vitamin_id,x.product_name,x.category,x.quantity,0,0,x.dispenser_slot
   from jsonb_to_recordset(snapshot) x(vitamin_id bigint,product_name text,category text,quantity integer,dispenser_slot integer);
 update public.vitamins v set stock=v.stock-x.quantity,updated_at=now()
   from jsonb_to_recordset(snapshot) x(vitamin_id bigint,quantity integer) where v.id=x.vitamin_id;
 insert into private.kiosk_requests(request_id,device_id,fingerprint,order_id) values(p_request_id,p_device_id,fingerprint,order_id);
 return jsonb_build_object('order_id',order_id,'status','dispensing','items',snapshot,'total_qty',total_qty,'total_amount',0,'payment_method','free');
end $$;

create or replace function private.cancel_unreceived_free_order(p_device_id uuid,p_device_token text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 if not exists(select 1 from private.kiosk_devices where id=p_device_id and enabled
   and token_hash=encode(sha256(convert_to(p_device_token,'UTF8')),'hex')) then raise exception '기기 인증 실패'; end if;
 if p_request_id is null then raise exception '요청 ID가 없습니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 if exists(select 1 from private.kiosk_requests where request_id=p_request_id)
   or exists(select 1 from public.orders where request_id=p_request_id) then
   return jsonb_build_object('status','review_required');
 end if;
 select device_id into owner_id from private.kiosk_cancelled_requests where request_id=p_request_id;
 if found and owner_id<>p_device_id then raise exception '기기 요청 불일치'; end if;
 insert into private.kiosk_cancelled_requests(request_id,device_id) values(p_request_id,p_device_id) on conflict(request_id) do nothing;
 return jsonb_build_object('status','cancelled');
end $$;
create or replace function public.cancel_unreceived_free_order(p_device_id uuid,p_device_token text,p_request_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select private.cancel_unreceived_free_order(p_device_id,p_device_token,p_request_id)
$$;
revoke all on function public.cancel_unreceived_free_order(uuid,text,uuid),private.cancel_unreceived_free_order(uuid,text,uuid) from public;
grant execute on function public.cancel_unreceived_free_order(uuid,text,uuid),private.cancel_unreceived_free_order(uuid,text,uuid) to anon,authenticated;

-- Slot plan by stable catalog names, never by generated user/device identifiers.
-- Keep the existing C/D3 slots, then assign the remaining 18 products.
create temporary table vending_slot_plan(name text primary key,slot integer unique) on commit drop;
insert into vending_slot_plan values
 ('Doctor''s Best Quali-C',1),('Swanson Vitamin D3',2),
 ('Doctor''s Best Fully Active B-Complex',3),('Solgar B-Complex 100',4),
 ('Nature Made Vitamin C',5),('NOW Foods Vitamin D3',6),
 ('Life Extension Magnesium Citrate',7),('Doctor''s Best High Absorption Magnesium',8),
 ('Sports Research Triple Strength Omega-3',9),('NOW Foods Omega-3',10),
 ('Doctor''s Best High Absorption CoQ10',11),('Qunol Ubiquinol',12),
 ('California Gold Nutrition Lutein Plus',13),('Doctor''s Best Lutein with Zeaxanthin',14),
 ('Jarrow Dophilus EPS',15),('Culturelle Daily Probiotic',16),
 ('Solgar Zinc Picolinate 15mg',17),('Solgar Zinc Picolinate 22mg',18),
 ('NOW Foods Beta-Glucan',19),('NOW Foods Beta Glucan 250mg',20);
do $$ begin
 if exists(select 1 from public.orders where status in ('dispensing','review_required')) then raise exception '먼저 미확정 배출을 복구하세요.'; end if;
 if (select count(*) from public.vitamins v join vending_slot_plan p on p.name=v.name where v.is_active)<>20 then raise exception '20상품 구성을 확인하세요.'; end if;
end $$;
update public.vitamins v set dispenser_slot=null from vending_slot_plan p where v.name=p.name;
update public.vitamins v set dispenser_slot=p.slot from vending_slot_plan p where v.name=p.name;
update private.kiosk_devices set slots=array(select generate_series(1,20)) where enabled;
commit;

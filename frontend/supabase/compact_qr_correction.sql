begin;
alter table public.orders add column if not exists qr_user_identifier text;
create or replace function private.reserve_free_order(p_device_id uuid,p_device_token text,p_request_id uuid,items jsonb,p_qr_token text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare device private.kiosk_devices%rowtype; old private.kiosk_requests%rowtype; fingerprint text;
 receipt jsonb; profile jsonb; uid uuid; entry record; total_qty integer:=0;
begin
 select * into device from private.kiosk_devices where id=p_device_id and enabled
 and token_hash=encode(sha256(convert_to(p_device_token,'UTF8')),'hex');
 if not found then raise exception '기기 인증 실패'; end if;
 if p_request_id is null then raise exception '요청 ID가 없습니다.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));
 fingerprint:=encode(sha256(convert_to(items::text||coalesce(p_qr_token,''),'UTF8')),'hex');
 select * into old from private.kiosk_requests where request_id=p_request_id;
 if found then
  if old.device_id<>p_device_id or old.fingerprint<>fingerprint then raise exception '요청 내용이 변경되었습니다.'; end if;
  return jsonb_build_object('order_id',old.order_id,'status',(select status from public.orders where id=old.order_id),'replayed',true);
 end if;
 if exists(select 1 from public.orders where request_id=p_request_id) then raise exception '이미 사용된 요청 ID'; end if;
 if p_qr_token is not null then
  profile:=p_qr_token::jsonb;
  if jsonb_typeof(profile)<>'object' or (select count(*) from jsonb_object_keys(profile))<>11
    or not (profile ?& array['id','n','a','g','h','w','s','al','c','ag','m'])
    or jsonb_typeof(profile->'id')<>'string' or length(profile->>'id') not between 1 and 100 then raise exception 'QR 형식 오류'; end if;
  if (profile->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id into uid from auth.users where id=(profile->>'id')::uuid;
  end if;
 end if;
 if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items) not between 1 and 20 then raise exception '상품 형식 오류'; end if;
 for entry in select (e->>'vitamin_id')::bigint product_id,(e->>'quantity')::integer quantity from jsonb_array_elements(items) e loop
  if entry.quantity is null or entry.quantity not between 1 and 5 then raise exception '한 상품은 1~5개입니다.'; end if;
  total_qty:=total_qty+entry.quantity;
  if not exists(select 1 from public.vitamins v where v.id=entry.product_id and v.is_active and v.dispenser_slot=any(device.slots)) then raise exception '아직 모터가 연결되지 않은 상품입니다.'; end if;
 end loop;
 if total_qty>5 then raise exception '한 번에 최대 5개까지 배출합니다.'; end if;
 receipt:=public.place_kiosk_order(items,p_request_id,null,null,'cash');
 update public.orders set member_user_id=uid,kiosk_device_id=p_device_id,payment_method='free',total_amount=0,qr_user_identifier=profile->>'id' where id=(receipt->>'order_id')::uuid;
 update public.order_items set unit_price=0,line_total=0 where order_id=(receipt->>'order_id')::uuid;
 insert into private.kiosk_requests values(p_request_id,p_device_id,fingerprint,(receipt->>'order_id')::uuid);
 return receipt||jsonb_build_object('total_amount',0,'payment_method','free');
end $$;
revoke execute on function public.issue_member_qr(),public.resolve_member_qr(text),private.issue_member_qr(),private.resolve_member_qr(text) from anon,authenticated;
commit;

begin;
create schema if not exists private;
revoke all on schema private from public;
create table private.member_qr_tokens (
 user_id uuid primary key references auth.users(id) on delete cascade,
 token_hash text unique not null,
 created_at timestamptz not null default now()
);
create table private.kiosk_devices (
 id uuid primary key, token_hash text not null, enabled boolean not null default false,
 slots integer[] not null default '{1,2}'
);
create table private.kiosk_requests (
 request_id uuid primary key, device_id uuid not null references private.kiosk_devices(id),
 fingerprint text not null, order_id uuid not null references public.orders(id)
);
revoke all on private.member_qr_tokens,private.kiosk_devices,private.kiosk_requests from public,anon,authenticated;
alter table private.member_qr_tokens enable row level security;
alter table private.kiosk_devices enable row level security;
alter table private.kiosk_requests enable row level security;
alter table public.orders add column member_user_id uuid references auth.users(id);
alter table public.orders add column kiosk_device_id uuid;
create index orders_member_completed_idx on public.orders(member_user_id,completed_at desc) where status='completed';
drop policy if exists member_order_read on public.orders;
drop policy if exists member_order_item_read on public.order_items;
create policy member_order_read on public.orders for select to authenticated using (member_user_id=(select auth.uid()) and status='completed');
create policy member_order_item_read on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and o.member_user_id=(select auth.uid()) and o.status='completed'));
create function private.issue_member_qr() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); secret text:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
begin
 if uid is null or not exists(select 1 from public.member_health_profiles where user_id=uid) then raise exception '건강정보 저장 후 로그인해주세요.'; end if;
 insert into private.member_qr_tokens(user_id,token_hash) values(uid,encode(sha256(convert_to(secret,'UTF8')),'hex'))
 on conflict(user_id) do update set token_hash=excluded.token_hash,created_at=now();
 return jsonb_build_object('type','vitamin-token','version',1,'token',secret);
end $$;
create function private.resolve_member_qr(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception '유효하지 않은 QR입니다.'; end if;
 select h.qr_payload||jsonb_build_object('id',h.user_id::text) into payload
 from private.member_qr_tokens t join public.member_health_profiles h on h.user_id=t.user_id
 where t.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
 if payload is null then raise exception 'QR이 변경되었거나 유효하지 않습니다. 휴대폰에서 새 QR을 만드세요.'; end if;
 return payload;
end $$;
create function private.invalidate_member_qr() returns trigger language plpgsql security definer set search_path='' as $$
begin delete from private.member_qr_tokens where user_id=new.user_id; return new; end $$;
create trigger member_qr_invalidate after update on public.member_health_profiles for each row execute function private.invalidate_member_qr();
create function public.issue_member_qr() returns jsonb language sql security invoker set search_path='' as $$ select private.issue_member_qr() $$;
create function public.resolve_member_qr(p_token text) returns jsonb language sql security invoker set search_path='' as $$ select private.resolve_member_qr(p_token) $$;
create function private.reserve_free_order(p_device_id uuid,p_device_token text,p_request_id uuid,items jsonb,p_qr_token text default null) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if p_qr_token is not null then profile:=private.resolve_member_qr(p_qr_token); uid:=(profile->>'id')::uuid; end if;
 if items is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items) not between 1 and 20 then raise exception '상품 형식 오류'; end if;
 for entry in select (e->>'vitamin_id')::bigint product_id,(e->>'quantity')::integer quantity from jsonb_array_elements(items) e loop
  if entry.quantity is null or entry.quantity not between 1 and 5 then raise exception '한 상품은 1~5개입니다.'; end if;
  total_qty:=total_qty+entry.quantity;
  if not exists(select 1 from public.vitamins v where v.id=entry.product_id and v.is_active and v.dispenser_slot=any(device.slots)) then raise exception '아직 모터가 연결되지 않은 상품입니다.'; end if;
 end loop;
 if total_qty>5 then raise exception '한 번에 최대 5개까지 배출합니다.'; end if;
 receipt:=public.place_kiosk_order(items,p_request_id,null,null,'cash');
 update public.orders set member_user_id=uid,kiosk_device_id=p_device_id,payment_method='free',total_amount=0 where id=(receipt->>'order_id')::uuid;
 update public.order_items set unit_price=0,line_total=0 where order_id=(receipt->>'order_id')::uuid;
 insert into private.kiosk_requests values(p_request_id,p_device_id,fingerprint,(receipt->>'order_id')::uuid);
 return receipt||jsonb_build_object('total_amount',0,'payment_method','free');
end $$;
create function private.finish_free_order(p_device_id uuid,p_device_token text,p_order_id uuid,p_request_id uuid,p_result text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.kiosk_devices where id=p_device_id and enabled and token_hash=encode(sha256(convert_to(p_device_token,'UTF8')),'hex')) then raise exception '기기 인증 실패'; end if;
 if not exists(select 1 from private.kiosk_requests where device_id=p_device_id and request_id=p_request_id and order_id=p_order_id) then raise exception '기기 주문 불일치'; end if;
 return public.finish_kiosk_order(p_order_id,p_request_id,p_result,false);
end $$;
create function public.reserve_free_order(p_device_id uuid,p_device_token text,p_request_id uuid,items jsonb,p_qr_token text default null) returns jsonb language sql security invoker set search_path='' as $$ select private.reserve_free_order(p_device_id,p_device_token,p_request_id,items,p_qr_token) $$;
create function public.finish_free_order(p_device_id uuid,p_device_token text,p_order_id uuid,p_request_id uuid,p_result text) returns jsonb language sql security invoker set search_path='' as $$ select private.finish_free_order(p_device_id,p_device_token,p_order_id,p_request_id,p_result) $$;
revoke all on function public.issue_member_qr(),private.issue_member_qr(),public.resolve_member_qr(text),private.resolve_member_qr(text),private.invalidate_member_qr(),public.reserve_free_order(uuid,text,uuid,jsonb,text),private.reserve_free_order(uuid,text,uuid,jsonb,text),public.finish_free_order(uuid,text,uuid,uuid,text),private.finish_free_order(uuid,text,uuid,uuid,text) from public;
grant usage on schema private to anon,authenticated;
grant execute on function public.issue_member_qr(),private.issue_member_qr() to authenticated;
grant execute on function public.resolve_member_qr(text),private.resolve_member_qr(text),public.reserve_free_order(uuid,text,uuid,jsonb,text),private.reserve_free_order(uuid,text,uuid,jsonb,text),public.finish_free_order(uuid,text,uuid,uuid,text),private.finish_free_order(uuid,text,uuid,uuid,text) to anon,authenticated;
update public.vitamins set dispenser_slot=case id when 3 then 1 when 5 then 2 end where id in (3,5);
commit;
revoke execute on function public.place_kiosk_order(jsonb,uuid,text,text,text),public.finish_kiosk_order(uuid,uuid,text,boolean),public.get_app_purchase_history(text,text) from public,anon,authenticated; revoke all on public.app_users,public.app_admins,public.app_health_profiles,public.app_qr_payloads from anon,authenticated;
begin; alter table public.order_items drop constraint order_items_line_total_check, drop constraint order_items_unit_price_check; alter table public.order_items add constraint order_items_line_total_check check(line_total>=0), add constraint order_items_unit_price_check check(unit_price>=0); commit;
create function private.lookup_free_order(p_device_id uuid,p_device_token text,p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ declare result jsonb; begin if not exists(select 1 from private.kiosk_devices where id=p_device_id and enabled and token_hash=encode(sha256(convert_to(p_device_token,'UTF8')),'hex')) then raise exception '기기 인증 실패';end if;perform pg_advisory_xact_lock(hashtextextended(p_request_id::text,0));select jsonb_build_object('order_id',r.order_id,'status',o.status) into result from private.kiosk_requests r join public.orders o on o.id=r.order_id where r.device_id=p_device_id and r.request_id=p_request_id;return coalesce(result,'{}'::jsonb);end $$;
create function public.lookup_free_order(p_device_id uuid,p_device_token text,p_request_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.lookup_free_order(p_device_id,p_device_token,p_request_id) $$;
revoke all on function public.lookup_free_order(uuid,text,uuid),private.lookup_free_order(uuid,text,uuid) from public;
grant execute on function public.lookup_free_order(uuid,text,uuid),private.lookup_free_order(uuid,text,uuid) to anon,authenticated;

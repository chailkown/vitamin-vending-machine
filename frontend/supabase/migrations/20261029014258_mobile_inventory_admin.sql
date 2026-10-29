begin;
create table private.mobile_admin_accounts (
 username text primary key, password_hash text not null, enabled boolean not null default true,
 failures integer not null default 0, locked_until timestamptz
);
create table private.mobile_admin_sessions (
 token_hash text primary key, username text not null references private.mobile_admin_accounts(username),
 expires_at timestamptz not null
);
create table private.inventory_changes (
 request_id uuid primary key, username text not null, product_id bigint not null references public.vitamins(id),
 fingerprint text not null, before_stock integer not null, after_stock integer not null,
 created_at timestamptz not null default now()
);
alter table private.mobile_admin_accounts enable row level security;
alter table private.mobile_admin_sessions enable row level security;
alter table private.inventory_changes enable row level security;
revoke all on private.mobile_admin_accounts,private.mobile_admin_sessions,private.inventory_changes from public,anon,authenticated;

create function private.mobile_admin_login(p_username text,p_password text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare account private.mobile_admin_accounts%rowtype; token text;
begin
 select * into account from private.mobile_admin_accounts where username=p_username for update;
 if not found or not account.enabled then return jsonb_build_object('error','아이디 또는 비밀번호를 확인해주세요.'); end if;
 if account.locked_until>now() then return jsonb_build_object('error','로그인 시도가 많습니다. 5분 후 다시 시도해주세요.'); end if;
 if p_password is null or length(p_password)>128 or extensions.crypt(p_password,account.password_hash)<>account.password_hash then
  update private.mobile_admin_accounts set failures=case when failures>=4 then 0 else failures+1 end,
    locked_until=case when failures>=4 then now()+interval '5 minutes' else null end where username=p_username;
  return jsonb_build_object('error','아이디 또는 비밀번호를 확인해주세요.');
 end if;
 update private.mobile_admin_accounts set failures=0,locked_until=null where username=p_username;
 delete from private.mobile_admin_sessions where expires_at<=now();
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into private.mobile_admin_sessions values(encode(sha256(convert_to(token,'UTF8')),'hex'),p_username,now()+interval '2 hours');
 return jsonb_build_object('token',token,'expiresIn',7200);
end $$;

create function private.mobile_admin_action(p_token text,p_action text,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text; product public.vitamins%rowtype; previous private.inventory_changes%rowtype;
 rid uuid; fingerprint text; amount integer; expected integer; next_stock integer; result jsonb;
begin
 select a.username into actor from private.mobile_admin_sessions s join private.mobile_admin_accounts a using(username)
 where s.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and s.expires_at>now() and a.enabled;
 if actor is null then raise exception '관리자 세션이 만료되었습니다. 다시 로그인해주세요.'; end if;
 if p_action='logout' then
  delete from private.mobile_admin_sessions where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex');
  return jsonb_build_object('ok',true);
 elsif p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'category',category,'stock',stock,'dispenser_slot',dispenser_slot) order by dispenser_slot,id),'[]'::jsonb) into result from public.vitamins where is_active;
  return result;
 elsif p_action in ('add','set') then
  if jsonb_typeof(p_data) is distinct from 'object' or jsonb_typeof(p_data->'quantity') is distinct from 'number'
   or jsonb_typeof(p_data->'expected') is distinct from 'number' or jsonb_typeof(p_data->'id') is distinct from 'number'
   or (p_data->>'quantity') !~ '^[0-9]{1,6}$' or (p_data->>'expected') !~ '^[0-9]{1,6}$'
   or (p_data->>'id') !~ '^[1-9][0-9]*$' then raise exception '재고 수량은 0~999999 정수로 입력해주세요.'; end if;
  rid:=(p_data->>'requestId')::uuid;
  if rid is null then raise exception '요청 ID가 없습니다.'; end if;
  fingerprint:=p_action||':'||p_data::text;
  perform pg_advisory_xact_lock(hashtextextended(rid::text,17));
  select * into previous from private.inventory_changes where request_id=rid;
  if found then
   if previous.username<>actor or previous.fingerprint<>fingerprint then raise exception '요청 내용이 변경되었습니다.'; end if;
   return jsonb_build_object('ok',true,'stock',previous.after_stock,'replayed',true);
  end if;
  -- Fail immediately on concurrent dispensing locks rather than waiting in a lock cycle.
  lock table public.orders in share mode nowait;
  if exists(select 1 from public.orders where status in ('dispensing','review_required')) then raise exception '진행 중이거나 확인이 필요한 배출이 있습니다. 배출 정리 후 재고를 수정해주세요.'; end if;
  select * into product from public.vitamins where id=(p_data->>'id')::bigint and is_active for update nowait;
  if not found then raise exception '활성 상품을 찾을 수 없습니다.'; end if;
  expected:=(p_data->>'expected')::integer; amount:=(p_data->>'quantity')::integer;
  if product.stock<>expected then raise exception '다른 구매나 수정으로 재고가 바뀌었습니다. 새로고침 후 다시 입력해주세요.'; end if;
  if p_action='add' and amount<1 then raise exception '입고 수량은 1개 이상입니다.'; end if;
  next_stock:=case when p_action='add' then product.stock+amount else amount end;
  if next_stock not between 0 and 999999 then raise exception '재고 수량 범위를 벗어났습니다.'; end if;
  update public.vitamins set stock=next_stock,updated_at=now() where id=product.id;
  insert into private.inventory_changes(request_id,username,product_id,fingerprint,before_stock,after_stock) values(rid,actor,product.id,fingerprint,product.stock,next_stock);
  return jsonb_build_object('ok',true,'stock',next_stock);
 elsif p_action='machine_save' then
  if coalesce(length(trim(p_data->>'id')),0) not between 1 and 100
    or coalesce(length(trim(p_data->>'name')),0) not between 1 and 100
    or coalesce(length(trim(p_data->>'address')),0) not between 1 and 500
    or jsonb_typeof(p_data->'lat') is distinct from 'number' or jsonb_typeof(p_data->'lng') is distinct from 'number'
    or (p_data->>'lat')::numeric not between -90 and 90 or (p_data->>'lng')::numeric not between -180 and 180
    or coalesce(p_data->>'status','') not in ('운영중','점검중','중지') then raise exception '자판기 위치 입력을 확인해주세요.'; end if;
  insert into public.app_vending_machines(machine_id,name,address,latitude,longitude,status) values(p_data->>'id',p_data->>'name',p_data->>'address',(p_data->>'lat')::double precision,(p_data->>'lng')::double precision,p_data->>'status')
  on conflict(machine_id) do update set name=excluded.name,address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude,status=excluded.status,updated_at=now();
  return jsonb_build_object('ok',true);
 elsif p_action='machine_delete' then
  delete from public.app_vending_machines where machine_id=p_data->>'id';
  if not found then raise exception '삭제할 자판기가 없습니다. 새로고침해주세요.'; end if;
  return jsonb_build_object('ok',true);
 end if;
 raise exception '지원하지 않는 관리자 작업입니다.';
end $$;
create function public.mobile_admin_login(p_username text,p_password text) returns jsonb language sql security invoker set search_path='' as $$select private.mobile_admin_login(p_username,p_password)$$;
create function public.mobile_admin_action(p_token text,p_action text,p_data jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.mobile_admin_action(p_token,p_action,p_data)$$;
revoke all on function private.mobile_admin_login(text,text),public.mobile_admin_login(text,text),private.mobile_admin_action(text,text,jsonb),public.mobile_admin_action(text,text,jsonb) from public;
grant usage on schema private to anon,authenticated;
grant execute on function private.mobile_admin_login(text,text),public.mobile_admin_login(text,text),private.mobile_admin_action(text,text,jsonb),public.mobile_admin_action(text,text,jsonb) to anon,authenticated;
commit;

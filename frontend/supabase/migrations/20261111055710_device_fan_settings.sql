begin;
create table private.device_fan_settings (
 machine_id text primary key references public.app_vending_machines(machine_id),
 device_id uuid not null unique references private.kiosk_devices(id),
 temperature_on integer not null default 30 check (temperature_on between 2 and 80),
 humidity_on integer not null default 70 check (humidity_on between 5 and 100),
 updated_at timestamptz not null default now()
);
alter table private.device_fan_settings enable row level security;
revoke all on private.device_fan_settings from public,anon,authenticated;

create function private.admin_fan_settings(p_token text,p_machine_id text,p_settings jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result private.device_fan_settings%rowtype;
begin
 if not exists(select 1 from private.mobile_admin_sessions s join private.mobile_admin_accounts a using(username)
  where s.token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') and s.expires_at>now() and a.enabled)
 then raise exception '관리자로 다시 로그인해주세요.'; end if;
 if p_settings is not null then
  if jsonb_typeof(p_settings) is distinct from 'object' then raise exception '설정 형식 오류'; end if;
  if p_settings - 'temperatureOn' - 'humidityOn' <> '{}'::jsonb
   or jsonb_typeof(p_settings->'temperatureOn') is distinct from 'number'
   or jsonb_typeof(p_settings->'humidityOn') is distinct from 'number'
   or (p_settings->>'temperatureOn') !~ '^[0-9]{1,2}$'
   or (p_settings->>'humidityOn') !~ '^[0-9]{1,3}$'
  then raise exception '온도와 습도는 정수로 입력해주세요.'; end if;
  if (p_settings->>'temperatureOn')::integer not between 2 and 80
   or (p_settings->>'humidityOn')::integer not between 5 and 100
  then raise exception '온도 2~80℃, 습도 5~100%% 범위를 확인해주세요.'; end if;
  update private.device_fan_settings set temperature_on=(p_settings->>'temperatureOn')::integer,
   humidity_on=(p_settings->>'humidityOn')::integer,updated_at=now() where machine_id=p_machine_id;
 end if;
 select * into result from private.device_fan_settings where machine_id=p_machine_id;
 if not found then raise exception '연결된 자판기 설정이 없습니다.'; end if;
 return jsonb_build_object('temperatureOn',result.temperature_on,'humidityOn',result.humidity_on);
end $$;

create function private.get_device_fan_settings(p_device_id uuid,p_device_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result private.device_fan_settings%rowtype;
begin
 if not exists(select 1 from private.kiosk_devices where id=p_device_id and enabled
  and token_hash=encode(sha256(convert_to(p_device_token,'UTF8')),'hex'))
 then raise exception '기기 인증 실패'; end if;
 select * into result from private.device_fan_settings where device_id=p_device_id;
 if not found then raise exception '연결된 자판기 설정이 없습니다.'; end if;
 return jsonb_build_object('temperatureOn',result.temperature_on,'humidityOn',result.humidity_on);
end $$;
create function public.admin_fan_settings(p_token text,p_machine_id text,p_settings jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$select private.admin_fan_settings(p_token,p_machine_id,p_settings)$$;
create function public.get_device_fan_settings(p_device_id uuid,p_device_token text)
returns jsonb language sql security invoker set search_path='' as $$select private.get_device_fan_settings(p_device_id,p_device_token)$$;
revoke all on function private.admin_fan_settings(text,text,jsonb),public.admin_fan_settings(text,text,jsonb),
 private.get_device_fan_settings(uuid,text),public.get_device_fan_settings(uuid,text) from public;
grant usage on schema private to anon,authenticated;
grant execute on function private.admin_fan_settings(text,text,jsonb),public.admin_fan_settings(text,text,jsonb),
 private.get_device_fan_settings(uuid,text),public.get_device_fan_settings(uuid,text) to anon,authenticated;
commit;

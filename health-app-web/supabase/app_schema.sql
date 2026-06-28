-- 앱 사용자/건강정보/QR payload 테이블
-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.app_users (
  user_id text primary key,
  password text not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.app_health_profiles (
  user_id text primary key references public.app_users (user_id) on delete cascade,
  name text not null,
  age integer not null check (age between 1 and 120),
  gender text not null check (gender in ('남성', '여성')),
  height integer not null check (height between 80 and 230),
  weight integer not null check (weight between 20 and 200),
  smoking_status boolean not null default false,
  alcohol_level text not null default '안 함',
  conditions text[] not null default array['해당 없음'],
  allergies text not null default '해당 없음',
  medications text not null default '해당 없음',
  qr_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_qr_payloads (
  qr_id uuid primary key default gen_random_uuid(),
  user_id text not null references public.app_users (user_id) on delete cascade,
  payload_hash text not null,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists app_qr_payloads_user_idx on public.app_qr_payloads (user_id, created_at desc);

create table if not exists public.app_vending_machines (
  machine_id text primary key,
  name text not null,
  address text not null,
  latitude double precision not null,
  longitude double precision not null,
  status text not null default '운영중',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users enable row level security;
alter table public.app_health_profiles enable row level security;
alter table public.app_qr_payloads enable row level security;
alter table public.app_vending_machines enable row level security;

drop policy if exists "app_users_demo_all" on public.app_users;
create policy "app_users_demo_all"
  on public.app_users for all to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "app_health_profiles_demo_all" on public.app_health_profiles;
create policy "app_health_profiles_demo_all"
  on public.app_health_profiles for all to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "app_qr_payloads_demo_all" on public.app_qr_payloads;
create policy "app_qr_payloads_demo_all"
  on public.app_qr_payloads for all to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "app_vending_machines_demo_all" on public.app_vending_machines;
create policy "app_vending_machines_demo_all"
  on public.app_vending_machines for all to anon, authenticated
  using (true)
  with check (true);

comment on table public.app_users is '졸업작품 앱 사용자 계정 데모 테이블';
comment on table public.app_health_profiles is '앱 개인 건강정보 및 QR payload 저장';
comment on table public.app_qr_payloads is 'QR 발급 이력 및 만료 정보';
comment on table public.app_vending_machines is '앱 지도와 관리자 화면에서 사용하는 자판기 위치 관리';

insert into public.app_vending_machines (
  machine_id,
  name,
  address,
  latitude,
  longitude,
  status
)
values
  ('vm-001', '영양제 자판기 1', '서일대학교 정문 인근', 37.5869, 127.0978, '운영중'),
  ('vm-002', '영양제 자판기 2', '서일대학교 후문 인근', 37.5856, 127.0957, '운영중'),
  ('vm-003', '영양제 자판기 3', '서원대학교 인근', 36.6252, 127.4822, '운영중')
on conflict (machine_id)
do update set
  name = excluded.name,
  address = excluded.address,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  status = excluded.status,
  updated_at = now();

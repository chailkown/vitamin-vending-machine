create table public.member_health_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 100),
 age integer not null check(age between 1 and 120),
 gender text not null check(gender in ('남성','여성')),
 height integer not null check(height between 80 and 230),
 weight integer not null check(weight between 20 and 200),
 smoking_status boolean not null,
 alcohol_level text not null,
 conditions text[] not null default '{}',
 allergies text not null,
 medications text not null,
 qr_payload jsonb not null check(jsonb_typeof(qr_payload) = 'object'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.member_health_profiles enable row level security;
revoke all on public.member_health_profiles from anon, authenticated;
grant select, insert, update on public.member_health_profiles to authenticated;
grant all on public.member_health_profiles to service_role;
create policy member_profile_read on public.member_health_profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy member_profile_insert on public.member_health_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy member_profile_update on public.member_health_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select on public.orders,public.order_items to authenticated;
create policy member_order_read on public.orders for select to authenticated using (user_id=(select auth.uid())::text and status='completed');
create policy member_order_item_read on public.order_items for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and o.user_id=(select auth.uid())::text and o.status='completed'));

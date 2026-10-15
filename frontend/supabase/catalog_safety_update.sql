-- Run after kiosk_purchase_history.sql. No deletion, reseeding, stock changes or slot reassignment.
begin;
alter table public.vitamins add column if not exists allergen_verified boolean not null default false;
alter table public.vitamins add column if not exists allergen_codes integer[] not null default '{}';
alter table public.vitamins add column if not exists allergen_source_url text;
alter table public.vitamins add column if not exists allergen_checked_at timestamptz;
comment on column public.vitamins.allergen_verified is '관리자가 실제 파우치 전체 원료와 교차접촉 표시를 확인했을 때만 true. 빈 배열만으로 무알레르기 보증 금지.';
comment on column public.vitamins.allergen_codes is 'healthCatalog.json 알레르기 코드: 원료 및 교차접촉 포함. 미검증 시 allergen_verified=false.';

update public.vitamins set is_active=false, updated_at=now()
where category in ('밀크시슬','비타민 E') or nutrient_id in (
  select id from public.nutrients where code in ('milk_thistle','vitamin_e')
);
-- Other inactive products remain inactive. With the original seed, 24 -> 20 active products.
commit;

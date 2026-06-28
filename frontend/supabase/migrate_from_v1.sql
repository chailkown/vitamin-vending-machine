-- 이전 vitamins 단일 테이블만 있던 경우: 아래 실행 후 schema.sql → seed.sql 순서로 다시 실행

drop table if exists public.symptom_nutrients cascade;
drop table if exists public.symptoms cascade;
drop table if exists public.symptom_categories cascade;
drop table if exists public.vitamins cascade;
drop table if exists public.nutrients cascade;

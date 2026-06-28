-- schema.sql 실행 후 seed.sql 실행
-- 기존 vitamins 테이블만 있었다면: drop table public.vitamins cascade; 후 schema.sql 부터 다시 실행

-- ========== 1. 영양소 마스터 (슬라이드 1) ==========
insert into public.nutrients (id, code, name, purpose, help_summary, precautions, sort_order) values
(1, 'vitamin_b_complex', '비타민 B-Complex', '에너지 대사 및 신경 기능 지원', '만성 피로, 집중력 저하, 신경 피로', '다른 B군 보충제·에너지음료와 중복 섭취 시 B6·B3 과다 위험. 장기 고용량 섭취 시 말초신경 이상, 홍조, 감각 이상 보고. 저녁 늦게 섭취 시 불면 유발 가능.', 1),
(2, 'vitamin_c', '비타민 C', '면역력 강화 및 항산화 작용', '감기 예방, 회복 지연, 피로', '고용량 섭취 시 설사, 복부 팽만, 위장 자극 가능. 위염·위궤양 병력 시 공복 섭취 주의. 신장결석 병력 시 장기 고용량 권장 안 함.', 2),
(3, 'vitamin_d3', '비타민 D3', '면역 조절 및 근육·뼈 기능 보조', '면역 저하, 근육 약화, 관절 부담', '지용성 비타민으로 체내 축적 가능. 장기 고용량 시 고칼슘혈증, 신장 부담 위험. 신장 질환자나 칼슘 제제 병용 시 전문가 상담 권장.', 3),
(4, 'magnesium', '마그네슘', '근육 이완 및 신경 안정', '근육통, 쥐, 스트레스, 수면 문제', '과다 섭취 시 설사, 복부 경련 흔함. 신장 기능 저하 환자는 고마그네슘혈증 위험. 일부 항생제와 병용 시 흡수 저해 가능.', 4),
(5, 'omega_3', '오메가-3', 'EPA·DHA 공급을 통한 염증 완화', '관절 뻐근함, 눈 건조, 피로', '항응고제·아스피린 복용 시 출혈 위험 증가 가능. 수술 예정자는 1~2주 전 중단 권장. 위장 민감자는 트림, 속쓰림 가능.', 5),
(6, 'coq10', '코엔자임 Q10', '미토콘드리아 에너지 생성 보조', '기력 저하, 피로, 심한 활동 후 회복', '혈압 강하 작용으로 저혈압 환자/약 복용자 주의. 드물게 속쓰림, 위장 불편. 항응고제 효과 약화 가능성 있음.', 6),
(7, 'lutein_zeaxanthin', '루테인/제아잔틴', '황반 보호 및 눈 피로 완화', 'PC·스마트폰 사용 후 눈 피로', '지용성으로 식사와 함께 섭취 권장. 장기 고용량 시 피부 황변 보고(독성은 낮음). 다른 지용성 비타민과 과도 중복 불필요.', 7),
(8, 'probiotics', '프로바이오틱스', '장내 균형 및 면역 보조', '변비, 설사, 장 트러블', '면역 저하 환자나 중증 질환자는 균혈증 위험으로 상담 필요. 항생제 복용 시 최소 2시간 간격 권장.', 8),
(9, 'zinc', '아연', '면역 기능 및 상처 회복 지원', '감기 잦음, 상처 회복 지연', '장기 고용량 시 구리 결핍, 위장 장애 가능. 공복 섭취 시 메스꺼움 발생 가능. 다른 미네랄과 동시 고용량 섭취 주의.', 9),
(10, 'milk_thistle', '밀크시슬', '간 세포 보호 및 회복 보조', '음주 후 피로, 간 부담', '간 대사 효소(CYP450) 영향으로 특정 약물과 상호작용 가능. 임신·수유부나 호르몬 민감 질환자는 상담 권장.', 10),
(11, 'vitamin_e', '비타민 E', '항산화 및 세포막 보호', '산화 스트레스, 간 피로', '지용성으로 장기 고용량 시 출혈 위험 증가 가능. 항응고제 복용자 주의. 고용량은 심혈관 이점이 없을 수 있음.', 11),
(12, 'beta_glucan', '베타글루칸', '면역 세포 활성화 보조', '면역력 저하, 잦은 감기', '면역계 자극으로 자가면역 질환 환자 증상 악화 가능성. 면역억제제 복용 중인 경우 전문의 상담 권장.', 12)
on conflict (id) do update set
  code = excluded.code, name = excluded.name, purpose = excluded.purpose,
  help_summary = excluded.help_summary, precautions = excluded.precautions, sort_order = excluded.sort_order;

-- ========== 2. 증상 카테고리·세부 증상 (슬라이드 2) ==========
insert into public.symptom_categories (id, code, title, emoji, sort_order) values
(1, 'energy', '피로 / 에너지 부족', '😴', 1),
(2, 'immunity', '감기·면역력 저하', '🛡️', 2),
(3, 'eye', '눈 / 시력 문제', '👀', 3),
(4, 'muscle', '근육 / 신경 문제', '💪', 4),
(5, 'joint', '관절 / 뼈 문제', '🦴', 5),
(6, 'digest', '소화 / 장 건강 문제', '🍽️', 6),
(7, 'liver', '간 / 문제', '🫀', 7)
on conflict (id) do update set title = excluded.title, emoji = excluded.emoji, sort_order = excluded.sort_order;

insert into public.symptoms (id, code, category_id, label, sort_order) values
(1, 'energy-a', 1, '아침에 일어나도 피곤하고 무기력함', 1),
(2, 'energy-b', 1, '오후가 되면 집중력과 기력이 떨어짐', 2),
(3, 'energy-c', 1, '야근이나 밤샘 후 회복이 느림', 3),
(4, 'energy-d', 1, '가벼운 활동에도 쉽게 지침', 4),
(5, 'imm-a', 2, '계절 변화 시 잦은 감기', 1),
(6, 'imm-b', 2, '작은 상처나 염증이 느리게 회복됨', 2),
(7, 'imm-c', 2, '질병에 안걸리게 면역력을 늘리고 싶음', 3),
(8, 'eye-a', 3, 'PC/스마트폰 장시간 사용 후 눈 피로', 1),
(9, 'eye-b', 3, '책이나 근거리 작업 후 초점이 잘 안 맞음', 2),
(10, 'eye-c', 3, '눈이 건조하고 충혈됨', 3),
(11, 'mus-a', 4, '운동 후 근육통이 심하고 회복이 느림', 1),
(12, 'mus-b', 4, '손·발이 저리거나 감각 이상이 가끔 나타남', 2),
(13, 'mus-c', 4, '스트레스나 긴장으로 근육이 자주 뭉침', 3),
(14, 'jnt-a', 5, '오래 걷거나 계단을 오를 때 무릎·허리가 뻐근', 1),
(15, 'jnt-b', 5, '가벼운 충격에도 뼈 통증이 느껴짐', 2),
(16, 'jnt-c', 5, '가벼운 활동에도 관절 통증이 나타남', 3),
(17, 'dig-a', 6, '변비나 설사가 자주 발생함', 1),
(18, 'dig-b', 6, '식사 후 더부룩하고 트림이 잦음', 2),
(19, 'dig-c', 6, '기름진 음식 섭취 후 소화가 잘 안 됨', 3),
(20, 'liv-a', 7, '술이나 기름진 음식 섭취 후 피로가 심함', 1),
(21, 'liv-b', 7, '간 회복과 해독이 필요하다고 느껴짐', 2),
(22, 'liv-c', 7, '약물 장기 복용으로 간 부담이 우려됨', 3)
on conflict (id) do update set label = excluded.label, category_id = excluded.category_id, sort_order = excluded.sort_order;

-- 증상 → 영양소 (sort_order = 슬라이드 표 순서)
delete from public.symptom_nutrients;
insert into public.symptom_nutrients (symptom_id, nutrient_id, sort_order) values
(1, 1, 1), (1, 4, 2),
(2, 1, 1), (2, 6, 2), (2, 4, 3),
(3, 1, 1), (3, 5, 2), (3, 4, 3),
(4, 1, 1), (4, 4, 2), (4, 6, 3),
(5, 2, 1), (5, 3, 2), (5, 9, 3), (5, 12, 4),
(6, 2, 1), (6, 9, 2),
(7, 2, 1), (7, 3, 2), (7, 8, 3), (7, 12, 4),
(8, 7, 1), (8, 5, 2),
(9, 7, 1), (9, 1, 2),
(10, 7, 1),
(11, 4, 1), (11, 3, 2), (11, 5, 3),
(12, 1, 1), (12, 4, 2),
(13, 4, 1), (13, 1, 2),
(14, 3, 1), (14, 5, 2),
(15, 3, 1),
(16, 5, 1), (16, 3, 2),
(17, 8, 1), (17, 4, 2),
(18, 8, 1),
(19, 8, 1),
(20, 1, 1), (20, 10, 2),
(21, 10, 1), (21, 11, 2),
(22, 1, 1), (22, 10, 2);

-- ========== 3. 제품 24종 (슬라이드 3) ==========
insert into public.vitamins (
  id, nutrient_id, name, category, price, serving_content, form, remarks, image_url, description, stock
) values
(1, 1, 'Doctor''s Best Fully Active B-Complex', '비타민 B-Complex', 160,
 'B1 50mg / B2 50mg / B6(P-5-P) 25mg / B12 500mcg', '캡슐', '활성형 B군 구성',
 '/screen/Doctor''s Best Fully Active B-Complex iHerb.webp', '에너지 대사 및 신경 기능 지원', 100),
(2, 1, 'Solgar B-Complex 100', '비타민 B-Complex', 150,
 'B1 100mg / B2 100mg / B6 100mg / B12 100mcg', '정제', '고함량 설계',
 '/screen/Solgar B-Complex 100 iHerb.webp', '에너지 대사 및 신경 기능 지원', 100),
(3, 2, 'Doctor''s Best Quali-C', '비타민 C', 150,
 '비타민 C 1000mg', '정제', 'Quali-C 원료 사용',
 '/screen/Doctor''s Best Quail-C iHerb.webp', '면역력 강화 및 항산화 작용', 100),
(4, 2, 'Nature Made Vitamin C', '비타민 C', 140,
 '비타민 C 500mg', '정제', '저용량 데일리용',
 '/screen/Nature Made Vitamin C 1000mg Amazon.jpeg', '면역력 강화 및 항산화 작용', 100),
(5, 3, 'Swanson Vitamin D3', '비타민 D3', 90,
 '비타민 D3 2000IU', '캡슐', '저용량 설계',
 '/screen/Swanson Vitamin D3 5000 IU iHerb.webp', '면역 조절 및 근육·뼈 기능 보조', 100),
(6, 3, 'NOW Foods Vitamin D3', '비타민 D3', 95,
 '비타민 D3 1000IU', '소프트젤', '지용성 형태',
 '/screen/NOW Foods Vitamin D3 5000 IU iHerb.webp', '면역 조절 및 근육·뼈 기능 보조', 100),
(7, 4, 'Life Extension Magnesium Citrate', '마그네슘', 180,
 '마그네슘 300mg', '정제', '시트레이트',
 '/screen/Life Extension Magnesium Citrate iHerb.avif', '근육 이완 및 신경 안정', 100),
(8, 4, 'Doctor''s Best High Absorption Magnesium', '마그네슘', 120,
 '마그네슘 200mg', '정제', '글리시네이트/리시네이트',
 '/screen/Doctor''s Best High Absorption Magnesium iHerb.webp', '근육 이완 및 신경 안정', 100),
(9, 5, 'Sports Research Triple Strength Omega-3', '오메가-3', 220,
 'EPA 690mg / DHA 260mg', '소프트젤', '고농축',
 '/screen/Sports Research Triple Strength Omega-3 iHerb.avif', 'EPA·DHA 공급을 통한 염증 완화', 100),
(10, 5, 'NOW Foods Omega-3', '오메가-3', 130,
 'EPA 180mg / DHA 120mg', '소프트젤', '기본형',
 '/screen/NOW Foods Omega-3 1000 mg iHerb.webp', 'EPA·DHA 공급을 통한 염증 완화', 100),
(11, 6, 'Doctor''s Best High Absorption CoQ10', '코엔자임 Q10', 240,
 'CoQ10 100mg', '소프트젤', 'BioPerine 함유',
 '/screen/Doctor''s Best High Absorption CoQ10 iHerb.webp', '미토콘드리아 에너지 생성 보조', 100),
(12, 6, 'Qunol Ubiquinol', '코엔자임 Q10', 260,
 '유비퀴놀 100mg', '소프트젤', '활성형',
 '/screen/Qunol Ubiquinol.webp', '미토콘드리아 에너지 생성 보조', 100),
(13, 7, 'California Gold Nutrition Lutein Plus', '루테인/제아잔틴', 200,
 '루테인 10mg / 제아잔틴 2mg', '소프트젤', '저용량',
 '/screen/California Gold Nutrition Lutein Plus.webp', '황반 보호 및 눈 피로 완화', 100),
(14, 7, 'Doctor''s Best Lutein with Zeaxanthin', '루테인/제아잔틴', 210,
 '루테인 20mg / 제아잔틴 4mg', '소프트젤', '황반 복합',
 '/screen/Doctor''s Best Lutein with Zeaxanthin.webp', '황반 보호 및 눈 피로 완화', 100),
(15, 8, 'Jarrow Dophilus EPS', '프로바이오틱스', 190,
 '50억 CFU (8종)', '캡슐', '장 안정형',
 '/screen/Jarrow Dophilus EPS.webp', '장내 균형 및 면역 보조', 100),
(16, 8, 'Culturelle Daily Probiotic', '프로바이오틱스', 170,
 '100억 CFU (1종)', '캡슐', 'LGG 균주',
 '/screen/Culturelle Daily Probiotic.webp', '장내 균형 및 면역 보조', 100),
(17, 9, 'Solgar Zinc Picolinate 15mg', '아연', 120,
 '15 mg', '정제', '일상 보충용',
 '/screen/Solgar Zinc Picolinate 15mg.webp', '면역 기능 및 상처 회복 지원', 100),
(18, 10, 'California Gold Nutrition Milk Thistle 150mg', '밀크시슬', 150,
 '150 mg', '캡슐', '가벼운 간 관리',
 '/screen/California Gold Nutrition Milk Thistle 150mg.webp', '간 세포 보호 및 회복 보조', 100),
(19, 9, 'Solgar Zinc Picolinate 22mg', '아연', 130,
 '22 mg', '정제', '흡수율 높음',
 '/screen/Solgar Zinc Picolinate 22mg.webp', '면역 기능 및 상처 회복 지원', 100),
(20, 10, 'California Gold Nutrition Milk Thistle 300mg', '밀크시슬', 165,
 '300 mg', '캡슐', '고함량, 간 피로 관리',
 '/screen/California Gold Nutrition Milk Thistle 300mg.webp', '간 세포 보호 및 회복 보조', 100),
(21, 11, 'Swanson Vitamin E', '비타민 E', 110,
 '67 mg (100 IU)', '소프트젤', '항산화 입문용',
 '/screen/Swanson Vitamin E.webp', '항산화 및 세포막 보호', 100),
(22, 11, 'Solgar Natural Vitamin E', '비타민 E', 200,
 '268 mg (400 IU)', '소프트젤', 'd-알파 토코페롤',
 '/screen/Solgar Natural Vitamin E.webp', '항산화 및 세포막 보호', 100),
(23, 12, 'NOW Foods Beta-Glucan', '베타글루칸', 140,
 '100 mg', '캡슐', '면역 기초 관리',
 '/screen/NOW Foods Beta-Glucan.webp', '면역 세포 활성화 보조', 100),
(24, 12, 'NOW Foods Beta Glucan 250mg', '베타글루칸', 175,
 '250 mg', '캡슐', '면역 강화 고함량',
 '/screen/NOW Foods Beta Glucan 250mg.webp', '면역 세포 활성화 보조', 100)
on conflict (id) do update set
  nutrient_id = excluded.nutrient_id, name = excluded.name, category = excluded.category,
  price = excluded.price, serving_content = excluded.serving_content, form = excluded.form,
  remarks = excluded.remarks, image_url = excluded.image_url, description = excluded.description,
  stock = excluded.stock, is_active = true, updated_at = now();

select setval(pg_get_serial_sequence('public.nutrients', 'id'), (select coalesce(max(id), 1) from public.nutrients));
select setval(pg_get_serial_sequence('public.symptom_categories', 'id'), (select coalesce(max(id), 1) from public.symptom_categories));
select setval(pg_get_serial_sequence('public.symptoms', 'id'), (select coalesce(max(id), 1) from public.symptoms));
select setval(pg_get_serial_sequence('public.vitamins', 'id'), (select coalesce(max(id), 1) from public.vitamins));

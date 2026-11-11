# QR 추천 설명 및 우선순위 보완

## 변경 범위

기존 상황별 영양소 연결과 20개 활성 상품 구성을 유지한다. 비활성 밀크시슬·비타민 E를 되살리지 않는다. 현재 활성 상품은 B군, C, D3, 마그네슘, 오메가-3, CoQ10, 루테인/제아잔틴, 프로바이오틱스, 아연, 베타글루칸 각 2개다.

`personalizedRecommendation.js`가 전체 활성 상품에 설명·주의사항을 붙이고 기존 상황에 속한 상품만 정렬한다. 기존 `recommendationSafety.js`의 검토용 accepted/hold 결과는 유지한다. 구매 화면은 기존처럼 relatedItems를 사용하며, 이번 변경으로 건강정보에 따른 판매 제한을 추가하지 않는다. 재고·슬롯·주문 중 제약은 그대로다.

정렬은 알레르기 주의 단계 → 약물 주의 단계 → 질환 주의 단계 → 기존 상황 내 영양소 순서 → 같은 영양소의 함량 비교 순이다. 숫자는 화면 정렬 정책이며 의학적 위험 확률이나 치료 효과 점수가 아니다. 알려진 위험과 안전성 미확인을 구별한다. 다른 성분의 mg나 유산균의 CFU를 서로 비교하지 않는다. 모든 상품에 같은 주의가 있으면 순서가 같을 수 있다.

## 화면

- 이름 아래 핵심 설명 3개 문단: 관련 성분의 역할, 중요한 주의사항 또는 비교 근거, 입력한 신체정보.
- 기존 펼침 영역: 비교 방식, 신체조건 해석, 상품별 이유·함량 비교·주의사항·출처.
- 구매 버튼은 이 설명이나 주의 단계에 의존하지 않는다.
- 글의 실제 줄 수는 화면 폭에 따라 달라진다. 상세는 기존 구매 영역 스크롤을 사용하며 중첩 스크롤은 없앴다.

## 근거 확인: 2026-11-11

아래 자료는 성분의 일반 근거다. 해당 기관이 우리 상품이나 정렬 알고리즘을 검증한 것은 아니다.

| 확인 항목 | 반영 내용 | 근거 |
|---|---|---|
| 알레르기 12개 선택지 | 전체 원료·교차접촉 표시 확인. 미확인과 표시 충돌 구별. 상품명만으로 안전 판정하지 않음 | [FDA Food Allergies](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies) |
| 신장질환·항생제·골다공증약·PPI | Mg 축적, 약물 흡수/간격, 장기 PPI와 Mg 상태 안내 | [NIH ODS Magnesium](https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/) |
| 항생제·페니실라민·철분제 | 아연 흡수/병용 주의. 장기 과다 섭취 관련 구리 부족 안내 | [NIH ODS Zinc](https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/) |
| 고칼슘혈증·티아지드계 이뇨제 | 비타민 D와 칼슘 증가 주의 | [NIH ODS Vitamin D](https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/) |
| 신장결석·철 과다증·흡연 | 비타민 C 보충량 확인, 흡연자 섭취기준 비교 | [NIH ODS Vitamin C](https://ods.od.nih.gov/factsheets/VitaminC-HealthProfessional/) |
| 항응고·항혈소판제·심방세동 | 오메가-3 용량/병용 확인. 일반 용량의 출혈 위험을 단정하지 않음 | [NIH ODS Omega-3](https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/) |
| 와파린·인슐린·스타틴 | CoQ10 상호작용, 스타틴만으로 효과를 가정하지 않음 | [NCCIH CoQ10](https://www.nccih.nih.gov/health/coenzyme-q10) |
| B군·항경련제 | B6 중복량·신경 이상 및 약물 주의. B군 전체 함량을 하나로 합산하지 않음 | [NIH ODS Vitamin B6](https://ods.od.nih.gov/factsheets/VitaminB6-HealthProfessional/) |
| 면역저하·면역억제제 | 프로바이오틱스 감염 위험 및 균주별 근거 차이 | [NCCIH Probiotics](https://www.nccih.nih.gov/health/probiotics-usefulness-and-safety) |
| 황반변성 | 단일 루테인 상품과 AREDS2 복합제 구별 | [NEI AREDS2](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/age-related-macular-degeneration/nutritional-supplements-age-related-macular-degeneration) |
| 갑상선질환·레보티록신 | 약 성분/부원료 및 간격 확인 | [NHS Levothyroxine](https://www.nhs.uk/medicines/levothyroxine/) |
| 당뇨·간질환 | 치료·간 해독을 이유로 상품 추가하지 않음 | [NCCIH Diabetes](https://www.nccih.nih.gov/health/diabetes-and-dietary-supplements-what-you-need-to-know), [NCCIH Milk Thistle](https://www.nccih.nih.gov/health/milk-thistle) |
| 나머지 넓은 약물 분류·암 치료·임신/수유·수술 | 구체적 약물/상태가 없어 개별 확인 안내. 임의의 효과나 병용 안전성을 만들지 않음 | [NCCIH Supplements](https://www.nccih.nih.gov/health/using-dietary-supplements-wisely/) |

## 신체조건 반영

나이·성별에 따라 NIH 성인 식사 포함 섭취기준(C, D, Mg, 아연)을 조회하고 등록 함량과 비교한다. 이는 한국 개인 맞춤 처방량이나 파우치 복용 지시가 아니다. 성인 기준을 적용할 수 없는 연령·임신/수유에는 숫자 비교를 하지 않는다. 흡연은 C 비교 기준에 반영한다.

키·체중은 BMI 계산과 영양상태 안내에 사용한다. 저체중이면 식사량·최근 체중 변화를, BMI 30 이상이면 비타민 D 상태와 체중만으로 고함량을 정하지 않는다는 내용을 표시한다. [CDC BMI](https://www.cdc.gov/bmi/adult-calculator/)는 진단 자체가 아닌 선별 지표다. 20세 미만·임신/수유에는 일반 성인 BMI 해석을 하지 않는다. 키·체중 변화만으로 상품 함량을 올리거나 내리지 않는다.

## 검증 및 남은 확인

- React 테스트: 기존 14개 + 신규 20개 = 34개 통과. 실제 제품 선택 순서·펼침 내용·장바구니 동작 포함.
- 기존 통합 테스트 31개 통과. 상황별 후보, QR 형식, 사용자 정보, 기존 안전 검토 결과 회귀 확인.
- 모바일 선택 코드 전체 및 활성 20상품, 복합 조건의 우선순위, 함량 불명확 데이터, 나이·성별·BMI 분기 확인.
- 실제 장비 배포·QR 스캐너·배출·터치스크린 육안 검증은 하지 않았다.
- QR은 기존처럼 질환·약물·알레르기 각각 하나만 전달한다. 모든 동반 질환·병용약을 알고 있다는 의미가 아니다.
- 제품의 serving_content와 알레르기 메타데이터는 실제 파우치 표시와 별도 대조가 필요하다. 확인하지 않은 라벨을 검증 완료로 바꾸지 않았다.

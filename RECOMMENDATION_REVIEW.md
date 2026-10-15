# 20상품 구성 및 추천 정책 변경 보고서

검토일: 2026-10-14. NIH ODS·NCCIH·NEI, FDA, NHS 공식 자료를 교차 확인했다. 이 문서는 구현 검토 기록이며 임상 검증이나 의료진의 승인 기록은 아니다.

## 상품 구성

기본 24상품에서 아래 4상품만 **비활성화**한다. 상품 삭제, 재고 초기화, 주문 이력 삭제, 슬롯 재번호 부여는 하지 않는다. 영양소 마스터 12종도 유지한다.

| 비활성 종류 | 상품 ID | 상품 |
|---|---|---|
| 밀크시슬 | 18, 20 | California Gold Nutrition Milk Thistle 150mg / 300mg |
| 비타민 E | 21, 22 | Swanson Vitamin E / Solgar Natural Vitamin E |

이는 ‘인체에 덜 중요한 영양소’ 순위가 아니라 **일반 이용자가 스스로 이용하는 졸업작품 자판기의 판매 우선순위**다. 밀크시슬의 간질환 개선 근거는 충분하지 않고, 비타민 E의 고용량 일반 보충과 항응고 치료 병용에는 검토가 필요해 보류했다. 나머지 20상품이 모든 사람에게 필요하거나 안전하다는 뜻도 아니다. 근거: [NCCIH 밀크시슬](https://www.nccih.nih.gov/health/milk-thistle), [NIH ODS 비타민 E](https://ods.od.nih.gov/factsheets/VitaminE-HealthProfessional/).

`productPolicy.js`가 목록·카테고리·검색·ID 조회·추천에 같은 정책을 적용한다. 주문 서비스도 비활성 상품을 거절한다. DB의 정상 조회 결과가 빈 배열이면 샘플로 되살리지 않는다. 신규 seed는 20상품으로 시작하며 기존 DB에는 `catalog_safety_update.sql`을 적용한다. 서버 주문 RPC는 기존의 `is_active=true` 검사를 사용하므로 SQL 적용 후 비활성 상품 주문도 거절된다.

## 입력 정보와 QR

- 질환·건강상태 20종: 기존 7종에 만성 신장질환, 신장결석, 고칼슘혈증, 철 과다증, 출혈질환, 심방세동, 면역저하, 암 치료, 임신·수유, 수술 예정, 골다공증, 갑상선질환, 황반변성을 추가했다.
- 알레르기 12종: 기존 5종에 생선, 대두, 달걀, 밀, 땅콩, 참깨, 국화과 식물을 추가했다.
- 약물 분류 19종: 기존 넓은 분류 5종은 호환성을 위해 남기고 와파린, 항혈소판제, 티아지드계 이뇨제, 퀴놀론·테트라사이클린계 항생제, 비스포스포네이트, 면역억제제, 항암제, 인슐린, 레보티록신, 항경련제, 스타틴, PPI, 페니실라민, 철분제를 추가했다.
- 질환뿐 아니라 약물·알레르기도 여러 항목을 선택할 수 있고, 쉼표로 구분한 직접 입력을 함께 보존한다. 정확히 등록된 일부 별칭만 코드로 변환하며 약 이름을 임의로 추측하지 않는다. 미등록 항목은 99로 전달하고 추천을 보류한다.
- 두 앱의 `healthCatalog.json`은 동일한 코드 정의를 사용하며 테스트로 일치 여부를 확인한다. 독립 빌드 프로젝트라 파일은 각 앱에 한 벌씩 있고, 변경 시 함께 갱신해야 한다.
- QR의 type/version·필수 필드·타입·범위 검증을 유지하고, 원본 문자열과 코드 배열의 불일치 및 ‘해당 없음’과 다른 항목의 동시 표기를 거절한다. 기존 코드 번호를 재사용하지 않는다. 새로 분류된 항목을 예전 앱에서 99로 생성한 QR은 건강정보 앱에서 다시 생성해야 한다.
- 시간 제한은 추가하지 않았다. `expiresAt`·`issuedAt`을 만들지 않으며 기존 시간 필드는 판독 여부에 영향을 주지 않는다. 키오스크 60초 미사용·홈·정상 완료 확인 초기화는 별개로 유지한다.

## 추천 흐름의 변화

기존의 ‘간질환 → 밀크시슬/E’, ‘당뇨/고혈압/BMI 상승 → Mg/오메가-3’, ‘음주 → 간 해독 보충제’를 제거했다. 피로·저림·눈 불편·소화 불편만으로 영양 결핍이나 치료 대상을 확정하지 않는다.

`식사 보완 검토` 항목을 추가했다. 과일·채소, 비타민 D 식품, 통곡물·콩·견과류, 생선, 육류·해산물·콩 섭취 부족에 대해 C/D/Mg/EPA·DHA/아연의 일반 정보를 제공한 뒤 QR 주의사항과 상품 라벨을 검토한다. 개인별 처방·복용량을 계산하거나 효과를 보장하지 않는다. 기존 증상 선택 항목은 상담·근거 안내로 남긴다.

검토 정책은 로컬 버전 `reviewed-policy-2026-10`이 기준이다. 과거 Supabase `symptom_nutrients` 매핑으로 덮어쓰지 않는다. 상품·재고는 여전히 Supabase에서 조회한다.

| 조건 | 구현한 동작 | 근거와 해석 |
|---|---|---|
| 신장질환, 면역저하/면역억제, 암 치료, 임신·수유, 수술 예정, 19세 미만 | 자동 추천 보류 | 상태·용량·약물·상품 검토가 필요한 이용자에 대한 **앱 운영 정책**. 모든 보충제의 절대금기라는 의미는 아님 |
| 신장결석·철 과다증 | C 자동 추천 제외 | [ODS C](https://ods.od.nih.gov/factsheets/VitaminC-HealthProfessional/): 결석 위험은 상황별 근거가 다르며, 철 과다증에서는 고용량 장기 섭취 주의 |
| 고칼슘혈증·티아지드계 이뇨제 | D 자동 추천 제외 | [ODS D](https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/): 칼슘 상승 및 병용 검토 |
| 와파린 | E·CoQ10·오메가-3 자동 추천 제외 | [ODS E](https://ods.od.nih.gov/factsheets/VitaminE-HealthProfessional/), [NCCIH CoQ10](https://www.nccih.nih.gov/health/coenzyme-q10), [ODS 오메가-3](https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/). 일반 용량 오메가-3의 임상적 출혈 증가를 확정하지 않고 병용 모니터링 필요성을 반영 |
| 항혈소판제·출혈질환·심방세동 | 관련 E/오메가-3 후보 보류 | 고용량 연구를 일반 용량의 보편적 금기로 확대하지 않으며, 검토 불가 상황에서 자동 판매 추천을 하지 않는 정책 |
| 일부 항생제·비스포스포네이트·페니실라민 | 해당 Mg/아연 제외 | [ODS Mg](https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/), [ODS 아연](https://ods.od.nih.gov/factsheets/Zinc-HealthProfessional/): 흡수와 복용 간격 문제. 자판기가 복용 시각을 지정하지 않음 |
| 인슐린 | CoQ10 제외 | [NCCIH CoQ10](https://www.nccih.nih.gov/health/coenzyme-q10) 상호작용 가능성 |
| 항경련제·손발 저림 | B군 자동 추천 보류 | [ODS B6](https://ods.od.nih.gov/factsheets/VitaminB6-HealthProfessional/): 약물 상호작용 및 장기 고함량 B6 신경 손상 위험. 현재 B군 상품 표기량 25/100mg과 실제 파우치 함량은 별도 확인 필요 |
| 레보티록신·철분제 | 개별 약/미네랄 조합 검토 | [NHS 레보티록신](https://www.nhs.uk/medicines/levothyroxine/), [NHS 철분제](https://www.nhs.uk/medicines/ferrous-sulfate/taking-ferrous-sulfate-with-other-medicines-and-herbal-supplements/). 레보티록신은 전체 복합제 원료를 모르는 상태여서 자동 추천 보류 |
| PPI·스타틴 | 정보 안내, 결핍·CoQ10 필요성을 자동 판정하지 않음 | ODS Mg·NCCIH CoQ10. 약 복용 사실만으로 보충 필요성을 확정하지 않음 |
| 눈 피로·건조·황반변성 | 단일 루테인을 AREDS2와 동일시하지 않음 | [NEI AREDS2](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/age-related-macular-degeneration/nutritional-supplements-age-related-macular-degeneration): 특정 단계·정확한 복합제 조건 필요 |
| 변비/설사·면역저하 | 유산균을 일괄 추천하지 않음 | [NCCIH 프로바이오틱스](https://www.nccih.nih.gov/health/probiotics-usefulness-and-safety): 균주·질환별 근거와 감염 위험 검토 |
| 당뇨 | 치료 목적의 보충제 자동 추가 없음 | [NCCIH 당뇨와 보충제](https://www.nccih.nih.gov/health/diabetes-and-dietary-supplements-what-you-need-to-know) |
| 알레르기 | 상품 전체 원료·교차접촉 라벨 확인 | [FDA 식품 알레르기](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies). 생선과 갑각류를 같은 알레르기로 취급하지 않음 |

여러 질환·약물의 제한을 모두 합친다. 상담 보류는 추천 후보보다 우선하며, 제외 사유를 덮어쓰지 않는다. 넓은 약물 분류만 선택한 경우 또는 미등록 직접 입력은 전문가 확인 전 보류한다. 전체적인 배경 근거는 [NCCIH 보충제 사용 안내](https://www.nccih.nih.gov/health/using-dietary-supplements-wisely/)다.

## 제품 알레르기와 화면 처리

DB에 `allergen_verified`, `allergen_codes`, `allergen_source_url`, `allergen_checked_at`을 추가한다. 관리자가 **판매하는 실제 파우치의 전 원료 및 교차접촉 표시**를 확인한 경우에만 검증 완료로 설정한다. 미검증·잘못된 코드/출처/날짜·알레르기 일치 상품은 제외한다. 제품명만으로 ‘무알레르기’를 추측하지 않는다. 현재 기본 상품에는 검증된 라벨 정보를 임의로 채워 넣지 않았다.

추천 결과가 비어 있어도 추천 탭과 이유를 보여주며 첫 번째 일반 상품 카테고리로 이동하지 않는다. QR이 있는 세션에서 다른 상품 탭을 누르더라도 알려진 제한에 해당하는 상품은 담기 버튼을 비활성화한다. QR 없이 직접 구매하는 흐름은 개인 건강정보를 검토하지 않는다. 이 프런트엔드 규칙은 서버의 인증·의학적 안전성 검증을 대신하지 않는다.

## 적용 및 검증

- 모바일·키오스크 코드를 함께 업데이트한다.
- 기존 DB에는 `kiosk_purchase_history.sql` 적용 후 `catalog_safety_update.sql`을 추가 실행한다. 원격 Supabase에는 아직 적용하지 않았다. 기존 DB에 seed를 다시 실행하지 않는다.
- 실제 슬롯 1~20 매핑과 파우치 함량·라벨 검토는 운영 데이터 작업으로 남아 있다. 라벨 확인 없이 `allergen_verified=true`로 설정하지 않는다.
- 로컬 통합 테스트: 23개. 20상품, 비활성 ID/검색/빈 DB 결과, 새 선택 항목 QR 왕복, 시간 경과 후 재사용, 코드/문자열 불일치 거절, 복수 약물 제한, 위험 상태 보류, 라벨 미검증·알레르기 일치, 정상 후보, 구형 증상 매핑 배제, 메모리 PostgreSQL 비활성 상품 주문 거절·반복 migration·재고 보존을 확인했다.
- React 화면 테스트: 6개. 기존 세션·주문 보호 4개와 빈 추천 결과 안내·다른 탭에서 QR 제한 유지 2개를 확인했다.
- 모바일 Vite 빌드·ESLint, 키오스크 CRA 프로덕션 빌드, `git diff --check`를 통과했다. CRA의 오래된 Browserslist 데이터와 Node deprecation 경고는 남아 있으며 빌드 오류는 아니다.
- 이번 브라우저 시각 검사는 자동화 도구의 URL 정책 차단으로 진행하지 못했다. 실제 브라우저에서 검증 완료했다고 보고하지 않는다.

미구현/미확인 범위: 전 약물·상품의 완전한 상호작용 DB, 실제 파우치 성분·용량 확인, 의료진의 규칙 검토, 실물 스캐너·모터·원격 DB 통합 검증. 온라인 자료를 반영한 보수적 시연용 정책으로, 모든 조합의 안전성을 보장하지 않는다.

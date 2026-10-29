# 상황별 관련 후보 표시

27개 세부 상황(식사 보완5, 기존 상황22)에 모두 영양제 정보 후보를 연결했다. Supabase 상품 조회 후 현재 활성 상품에서 고르므로 비활성 상품은 되살리지 않는다. 품절·제품 부족 시 후보 수는 달라질 수 있다.

`relatedItems`는 화면에 표시할 참고 후보, `items`는 제한 검사를 통과한 상품이다. 두 목록을 구분해 추천 보류 시에도 관련 정보를 보여주며 담기 버튼은 막는다. 추천 보류 상태에서 다른 카테고리로 바꿔도 배출 제한을 유지한다.

피로는 마그네슘/C, 면역 관련은 C/아연, 근육 기능은 마그네슘, 뼈 건강은 D를 일반 식사 보완 후보로 표시한다. 증상 치료나 결핍 진단을 의미하지 않는다. 눈 증상·장 증상·간 우려·저림·가벼운 충격의 뼈 통증은 관련 정보를 제공하되 자동 추천·배출은 보류한다. 간 항목에는 해독 제품 대신 일반 식사 보완 정보임을 명시한다.

QR의 나이·질환·약물·알레르기 제한과 B6 고함량·미검증 알레르기 라벨 제한을 유지했다. 키·체중·성별 기반 용량 계산이나 추천 순위를 새로 구현한 것은 아니다. 회원 기록·지도·관리자 기능은 이번 변경 범위가 아니다.

화면 위에는 상황 설명을 짧게 표시하고 자세한 근거는 접힌 영역에 둔다. 모든 상황 후보 존재, 건강조건 제외, 보류 상품 표시, 카테고리 변경 시 담기 차단을 자동 검증했다. 통합31개 + React7개 통과. 실물 스캐너·모터 테스트는 이번에 수행하지 않았다.

근거 확인: [NIH ODS 마그네슘](https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/), [NEI AREDS2 적용 범위](https://www.nei.nih.gov/eye-health-information/clinical-trials/age-related-eye-disease-studies-aredsareds2/aredsareds2-frequently-asked-questions), [NCCIH 프로바이오틱스](https://www.nccih.nih.gov/health/tips/things-to-know-about-probiotics). 이 자료는 영양소 정보와 제한의 근거이며 27개 상황 매핑을 임상 검증한 자료는 아니다.

최신 배포 묶음은 `.deploy/recommendation-20261029.zip`이다. 압축을 풀어 `bash ~/recommendation-20261029/install.sh`로 기존 Pi에 업데이트한다. 기존 device.json이 필요하며, 이번 추천 변경을 위해 Mega를 다시 업로드할 필요는 없다.

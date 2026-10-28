# 맞춤형 영양제 파우치 자판기

건강정보·QR·구매내역을 관리하는 `health-app-web`과 자판기 키오스크 `frontend`로 구성된다. Android 앱은 `health-app-web/android`의 Capacitor 래퍼를 사용한다. 판매·배출 단위는 **1회분 파우치**다.

## 로컬 실행

각 폴더에서 `npm ci` 후 실행한다. Node 22.12 이상을 권장한다.

- 건강 앱: `cd health-app-web`, `npm run dev` → 포트 3001
- 키오스크: `cd frontend`, `npm start` → 포트 3000
- 환경변수는 각 `.env.example`을 참고해 `.env`에 설정한다.
- 각 폴더에서 `npm run build`로 웹 배포 번들을 만든다.
- Android: 건강 앱 폴더에서 `npm run android:sync`, `npm run android:open`. APK 빌드는 Java 21 / Android SDK가 필요하다.

모바일 프로필은 명시적인 저장 버튼으로 사용자별 로컬 저장과 Supabase 저장을 수행한다. 키오스크 사용자 상태는 홈·60초 미사용·완료 확인 시 초기화하며 DB 재고/주문은 지우지 않는다.

## Supabase 업데이트

처음 설치: `frontend/supabase/schema.sql` → `seed.sql` → `orders_schema.sql` → `payment_schema.sql` → `health-app-web/supabase/app_schema.sql` → `frontend/supabase/kiosk_purchase_history.sql` → `frontend/supabase/catalog_safety_update.sql` 순서로 실행한다.

기존 DB라면 미적용된 **`kiosk_purchase_history.sql`과 `catalog_safety_update.sql`을 순서대로 추가 적용**한다. 먼저 `app_schema.sql`의 사용자 테이블이 존재해야 한다. 기존 재고에 `seed.sql`을 재실행하면 재고가 100으로 바뀌므로 실행하지 않는다. 새 SQL은 기존 주문/상품을 삭제하지 않는다. 구형 `place_order`의 공개 실행 권한은 제거하며, 앱도 새 RPC만 호출한다.

## 상품 구성과 추천 정책

기본 24상품 중 밀크시슬·비타민 E 각각 2상품을 비활성화하여 20상품을 표시한다. 영양소 12종 정의와 과거 상품 기록은 유지한다. 원격 DB에 새 SQL을 적용해야 DB에서도 비활성화되며, 프런트엔드에서는 같은 정책을 먼저 적용한다. 기존 슬롯 번호는 바꾸지 않으므로 실제 20슬롯 매핑은 운영자가 확인한다.

질환 20종·알레르기 12종·약물 분류 19종을 지원하며 모바일에서 복수 선택할 수 있다. 추천은 검토된 로컬 정책을 기준으로 하므로 과거 DB의 증상 매핑을 다시 사용하지 않는다. 근거와 제외·보류 사유는 화면에 표시한다. 자세한 출처와 한계는 `RECOMMENDATION_REVIEW.md`를 참고한다. QR에는 시간 제한이 없고 키오스크 세션의 60초 미사용 초기화는 별도로 유지한다.

두 앱은 같은 Supabase 프로젝트를 사용한다. 휴대폰과 자판기는 서로 다른 네트워크여도 인터넷으로 Supabase에 접근할 수 있다. 앱 구매내역 조회에는 자판기 로컬 API가 필요하지 않다. 원격 DB의 키·설정·권한과 실제 Wi-Fi/LTE 연결은 별도 확인해야 한다.

## 배출 연결

`frontend/HARDWARE.md`를 참고한다. 기본값에서는 DB 또는 배출 API가 없으면 주문이 실패한다. `REACT_APP_DISPENSE_MODE=simulation`은 **개발 서버에서만** 허용되며 DB는 여전히 필요하다. 시뮬레이션 기록은 구매내역에 시연으로 구분한다. 결제 수단 UI는 여전히 시연 단계이며 실제 카드 승인 연동은 별도 작업이다.

## 검증

- 건강 앱: `npm run lint`, `npm run test:integration`
- 키오스크: `npm test -- --watchAll=false --runInBand`

통합 테스트는 메모리 PostgreSQL에서 실행하므로 원격 재고나 사용자 DB를 수정하지 않는다. 과거 실제 재고를 차감하던 주문 검사 도구는 `frontend/scripts/test-order-local.mjs`로 교체했다. `npm run db:test-order`도 같은 안전한 로컬 통합 테스트를 실행한다(건강 앱 의존성 설치 필요).

이번 수정과 검증 범위는 `CHANGE_REPORT.md`에 기록했다. 현재 인증은 평문 비밀번호·공개 앱 RLS를 사용하는 졸업작품 데모이며, QR 구조 검증은 인증/서명 검증을 대신하지 않는다. 실제 개인정보 대신 테스트 데이터를 사용한다.

> 2026-10-28 추가: 사용자 요청으로 현재 공개 설정만 담긴 두 `.env`와 소스 백업 6개를 Git에 포함했습니다. 범위와 구분은 [LOCAL_BACKUPS.md](../LOCAL_BACKUPS.md)를 참고하세요. 기기 인증키·실행 journal은 포함하지 않습니다.

# 현재 DB 연결과 적용 기록

2026-10-28 기준. 같은 Supabase 프로젝트를 두 웹과 Pi gateway가 사용합니다. `.env`와 기기 비밀 설정은 Git에 올리지 않습니다.

## 데이터와 권한

- `vitamins`: 활성 상품20개. 상품/영양소/상황 공개 조회, 재고 쓰기는 서버 함수 경로.
- `member_health_profiles`: Auth UUID별 건강정보, authenticated 본인 SELECT/INSERT/UPDATE RLS.
- `orders.member_user_id`: 신규 Auth 회원 이용내역 연결.
- `orders.qr_user_identifier`: 전달된 11필드 QR의 식별자 기록. QR 자체를 서명된 인증서로 간주하지 않음.
- `orders.payment_method='free'`, orders/order_items 금액0. 실제 결제 처리는 없음.
- `private.kiosk_devices`: 기기 인증값 해시·허용 슬롯.
- `private.kiosk_requests`: 기기·요청ID·내용 fingerprint·주문 연결, 중복 방지.
- 이전 `app_users` 등 임시 테이블/기록은 보존하며 웹 직접 접근은 차단.

브라우저는 키오스크의 로컬 `/api/order`를 호출합니다. 기기 비밀값은 Pi에서만 사용합니다. 구형 place/finish/history RPC의 anon/authenticated 직접 실행 권한은 회수했습니다. QR 해석에는 DB의 issue/resolve_member_qr를 사용하지 않으며 이 함수의 웹 실행 권한도 회수했습니다.

## 적용 기록

회원 Auth/RLS, 무료 배출, 11필드 QR 정정은 현재 프로젝트 DB에 이미 적용·시험했습니다. 관련 기록:

1. `health-app-web/supabase/member_auth_schema.sql`
2. `frontend/supabase/free_vending_schema.sql`
3. `frontend/supabase/compact_qr_correction.sql` — 서버 QR을 철회한 최종 정정

위 파일은 단일 명령의 신규 DB bootstrap이 아닙니다. 선행 테이블/함수가 필요하고 재실행에 안전하지 않은 구문이 포함됩니다. **기존 DB에 seed.sql이나 과거 권한 SQL을 다시 실행하지 않습니다.** 설치 스크립트는 DB 초기화를 수행하지 않습니다.

실제 DB의 무료 주문/재고/회원 내역/중복 방지 시험은 트랜잭션 롤백으로 원래 재고·주문을 보존했습니다. 새 DB로 옮길 때의 통합 bootstrap/마이그레이션 자동화는 별도 작업입니다.

## 환경변수

모바일은 VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY, 키오스크는 REACT_APP_SUPABASE_URL/REACT_APP_SUPABASE_ANON_KEY 공개 키를 사용합니다. Pi 설정 예제는 `deployment/device.example.json`입니다. secret/service_role 키를 웹 변수에 넣지 않습니다.

상태와 현장 검증 잔여 항목은 [STATUS.md](../STATUS.md)를 참고합니다.

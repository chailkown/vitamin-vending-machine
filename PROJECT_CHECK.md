# Capstone 프로젝트 점검 문서

## 1) 프로젝트 개요
- 이 프로젝트는 React 기반의 **영양제 자판기 프론트엔드**입니다.
- 사용자는 `직접 구매` 또는 `맞춤형 추천` 흐름으로 영양제를 탐색하고 장바구니에 담아 결제 단계로 이동할 수 있습니다.
- 데이터는 Supabase 테이블(`vitamins`)을 우선 사용하고, 조회 실패 시 샘플 데이터로 동작하도록 구성되어 있습니다.

## 2) 폴더 구조
- `frontend/`: 메인 애플리케이션 코드
  - `src/`: React 소스 코드
  - `public/`: 정적 리소스 및 HTML 엔트리
  - `package.json`: 의존성/스크립트 정의
- `screen/`: 상품 이미지 등 정적 자산

## 3) 기술 스택
- **언어**: JavaScript
- **프레임워크**: React (`react`, `react-dom`)
- **빌드/개발 도구**: Create React App (`react-scripts`)
- **패키지 매니저**: npm (`package-lock.json` 존재)
- **백엔드 연동**: Supabase (`@supabase/supabase-js`)

## 4) 핵심 화면 및 흐름
- 엔트리: `frontend/src/index.js`
- 화면 제어: `frontend/src/App.js`
  - `main` -> `purchase` 또는 `recommend` 상태 전환 방식
- 메인 화면: `frontend/src/pages/MainScreen.js`
  - 직접 구매 / 맞춤형 추천 진입 버튼 제공
- 추천 화면: `frontend/src/pages/RecommendScreen.js`
  - 증상 카테고리 선택 -> 권장 영양소/상품 제시 -> 조합 담기
  - QR 스캔 확인 모달 및 스캔 시뮬레이션 로직 포함
- 구매 화면: `frontend/src/pages/PurchaseScreen.js`
  - 카테고리별 제품 목록, 장바구니 수량 조절, 합계 계산, 구매 처리(현재 알림/로그 기반)

## 5) 데이터 계층
- Supabase 클라이언트: `frontend/src/config/supabase.js`
  - `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY` 환경변수 사용
  - 미설정 시 기본값으로 폴백
- 비타민 서비스: `frontend/src/services/vitaminService.js`
  - 전체 조회, 카테고리 조회, 검색, 추가/수정/삭제 함수 제공
  - 오류 또는 빈 결과 시 샘플 데이터 반환

## 6) 실행 방법
1. 터미널에서 `frontend` 폴더로 이동
2. 의존성 설치: `npm install`
3. 개발 서버 실행: `npm start`
4. 빌드: `npm run build`
5. 테스트: `npm test`

## 7) 현재 상태 점검 요약
- 장점
  - 주요 사용자 플로우가 분명하고 화면 분리가 잘 되어 있음
  - Supabase 실패 시 폴백 로직이 있어 데모 안정성이 높음
- 보완 필요
  - 루트/앱 수준의 공식 README가 부재
  - 테스트 코드(`*.test.*`, `*.spec.*`)가 확인되지 않음
  - 구매 처리 로직이 실제 결제 API 연동 전 단계(TODO 상태)
  - Supabase 기본 키 하드코딩 폴백은 배포 시 보안 검토 필요

## 8) DB 연동 (2025-06)
- `frontend/DATABASE.md` — Supabase 설정·SQL·테스트 가이드
- `frontend/supabase/schema.sql`, `seed.sql` — 테이블·시드(상품 20종)
- `frontend/.env.example` — 환경변수 템플릿
- `npm run db:test` — 연결 확인 스크립트

## 9) 주문 기능 (2025-06)
- `frontend/supabase/orders_schema.sql` — orders / place_order RPC
- `frontend/src/services/orderService.js` — 구매 화면 연동
- Supabase SQL Editor에서 `orders_schema.sql` 실행 필요

## 10) 결제 UI (2025-06)
- `PaymentModal` — 카드/모바일/현금 선택 + 결제 시뮬레이션
- `payment_schema.sql` — `payment_method` 컬럼 (Supabase에서 실행 필요)

## 11) 다음 추천 작업
- `payment_schema.sql` Supabase 실행
- QR 스캔 실제 카메라 연동 (추천 화면)
- `health-app-web` ↔ 자판기 연동

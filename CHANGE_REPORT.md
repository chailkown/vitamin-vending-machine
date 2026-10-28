# 최근 변경 이력

## 2026-10-28: 회원·QR·무료 배출 통합

- Supabase Auth 회원가입/이메일 인증/로그인과 본인 건강정보 DB 저장·복원 연결. 평문 로컬 인증 fallback 제거.
- 사용자 최종 규격으로 QR 정정: id,n,a,g,h,w,s,al,c,ag,m만 전달, c/ag/m 각각 단일 숫자, 시간·만료·type/version/서버 코드 없음.
- QR PNG 생성/이미지 저장, 독립 해독기 시험, HID Unicode escape 지원. 서버 발급/조회 방식은 철회하고 해당 함수 실행 권한 회수.
- 무료 배출로 전환: 금액/결제 수단 UI 제거, 최대5개, 미연결 상품 비활성.
- Pi gateway: 기기 인증, DB 예약/확정, Mega 응답 확인, SQLite 영속 중복 방지, 미확정 결과 잠금·관리자 복구.
- 신규 Auth 회원의 이용내역 연결과 무료 금액 0 기록. 구형 임시 계정/주문 기록은 보존.
- 키오스크 화면/장바구니/추천 버튼 축소, 세부 상황 후 QR로 이동, 긴 안내 접기, 오른쪽 여백 반영.
- 배포 패키지/설치/사용자 systemd 서비스/브라우저 시작/나중 작동 시간 설정 도구 준비.
- 자동 시험43개와 두 앱 빌드 통과. DB 시험 변경은 롤백. 최신 Pi 설치·실물 통합은 미완료.

완료/남은 작업을 구분한 현재 기준은 [STATUS.md](STATUS.md), 설치는 [deployment/README.md](deployment/README.md)입니다.

---

## 이전 변경 기록 (현재 요구사항과 다를 수 있음)

# TXT 요청 수정 결과

최신 후속 변경: 20상품 구성·질환/약물/알레르기 확장·추천 정책 재검토는 [RECOMMENDATION_REVIEW.md](RECOMMENDATION_REVIEW.md)를 우선 참고한다. 아래 초기 구현의 질환별 추가 추천 설명은 새 정책으로 대체됐다.

작업일: 2026-10-14 / 기준 커밋 `69641ec`  
요청 문서: `CODEX_PROMPT_수정본_Supabase_구매내역추가.txt`  
기존 디자인과 React 화면 구조를 유지했다. 실제 앱 소스와 주문 SQL을 수정했고, 원격 배포·원격 DB 실행은 하지 않았다.

후속 요청 반영: QR 30초 만료 정책을 제거했다. QR은 건강정보 전달용으로 계속 재사용하며, 키오스크의 60초 미사용·홈 이동·정상 완료 확인에 따른 세션 초기화는 유지한다. 발급/만료 시각을 생성하지 않고 기존 QR의 시간 필드도 사용 가능 여부에 영향을 주지 않는다.

## 1. 수정한 파일 목록

### 모바일 건강정보 앱

| 파일 | 변경 이유·내용 |
|---|---|
| `health-app-web/src/App.jsx` | 사용자별 프로필 복원·명시 저장, 다중 질환·약물 QR, 시간 제한 없는 QR 표시, 구매내역 화면, 필수 설정 우회 방지, 비동기 사용자 전환 보호 |
| `health-app-web/src/App.css` | 디자인 유지하며 입력/프로필/홈/구매내역 세로 스크롤, QR 이미지·구매 카드, 좁은 화면 헤더 보완 |
| `health-app-web/src/services/profileStorage.js` (추가) | 프로필 저장/복원 키를 한 함수로 통일 |
| `health-app-web/src/services/qrProfile.js` (추가) | 기존 compact 필드 유지, 배열·원본 문자열·버전 추가, 시간에 독립적인 payload 생성 |
| `health-app-web/src/services/qrImage.js` (추가) | qrcode로 PNG Data URL 생성, 용량 초과/생성 실패를 사용자 오류로 처리 |
| `health-app-web/src/qrVersion6.js` (삭제) | 오류가 있던 자체 QR/RS 계산 제거 |
| `health-app-web/src/services/healthDb.js` | 구매내역 RPC 연결, 프로필 저장시 불필요한 QR 이력 insert 제거 |
| `health-app-web/package.json`, `package-lock.json` | qrcode 1.5.4, 독립 디코더/PNG/메모리 PostgreSQL 테스트 의존성, 통합 테스트 명령 |
| `health-app-web/tests/integration.mjs` (추가) | QR·프로필·상품·주문·재고·배출 결과·구매내역 통합 시험 |

### 키오스크

| 파일 | 변경 이유·내용 |
|---|---|
| `frontend/src/App.js` | 공통 resetKiosk, 화면 remount, 홈/60초 미사용/완료 확인 초기화, 주문 중 이동·idle 초기화 차단 |
| `frontend/src/services/kioskSession.js` (추가) | 정확한 임시 키 삭제, 입력 이벤트별 idle 타이머와 cleanup |
| `frontend/src/services/qrPayload.js` (추가) | 우리 시스템 QR의 버전·필수 필드·타입·범위·배열 검증, 시간 검사 없음 |
| `frontend/src/services/recommendationService.js` | 기존 추천 유지, 다중 질환/알레르기/약물 코드 적용, 직접 입력 원본과 미지원 경고 보존 |
| `frontend/src/pages/RecommendScreen.js` | 기본 개인 데모 QR 제거, 검증 실패 차단, USB HID 입력/Enter 연결, 언마운트 후 비동기 이동 방지 |
| `frontend/src/services/vitaminService.js` | 카테고리 샘플 필터 오류 수정, 폴백 금지 옵션 일관성 보완 |
| `frontend/src/pages/PurchaseScreen.js` | 상품 필터 단순화·조회 경합 제거, 재고/수량 상한, DB 오류 표시, QR 사용자 ID 주문 전달, 중복 주문/홈 이동 차단 |
| `frontend/src/components/PaymentModal.js` | 처리 중 닫기 차단, 즉시 중복 클릭 방지, 정상 완료 확인에서 reset, 불확실 결과 재시도 차단 |
| `frontend/src/services/orderService.js` | DB 없는 성공 삭제, 예약→배출→완료 확정, 서버 확정 금액 표시, 복구 참조 보존 |
| `frontend/src/services/dispenserService.js` (추가) | Pi API 인터페이스, 슬롯/수량 전달, 응답·타임아웃 분리, 개발 한정 시뮬레이션 |
| `frontend/supabase/kiosk_purchase_history.sql` (추가) | 기존 orders/items 확장, 사용자 연결·요청 UUID·상품 슬롯, 재고 잠금·중복 합산·멱등성·완료/실패/확인필요, 구매내역 RPC |
| `frontend/src/App.test.js` (추가) | 실제 React 주문 UI·홈 초기화·idle·연속 클릭·실패 유지 시험 |
| `frontend/scripts/test-order.mjs` (삭제), `test-order-local.mjs` (추가), `frontend/package.json` | 과거 원격 재고를 차감하던 검사 명령을 로컬 메모리 DB 테스트로 교체 |
| `frontend/.env.example` | 배출 API 주소와 개발 모드 명시 |
| `frontend/supabase/schema.sql`, `frontend/DATABASE.md` | 파우치당 가격 문구로 정정 |

### 설명·검증 자료

- `README.md` 추가: 앱 실행, DB 설치·업데이트 순서, 테스트, 네트워크 구조.
- `frontend/HARDWARE.md` 추가: 20슬롯 매핑, Pi API 계약, Arduino 응답 기준, 복구 한계.
- `PROJECT_ANALYSIS.md`의 하드웨어 단위 정정. 나머지는 수정 전 커밋의 역사적 분석임을 명시.
- `analysis/verify-current.mjs`: 최신 테스트 실행 진입점. 오래된 `verify.mjs`는 제거하고 수정 전 원시 결과 `verification.txt`는 그대로 유지.
- `analysis/mobile-qr.png`: 만료 정책 변경 전 테스트 계정의 QR 표시 캡처. 현재의 시간 제한 없는 UI를 나타내는 이미지는 아니다. 실제 개인정보를 사용하지 않았다.

## 2. 문제별 수정 내용

### QR·모바일 프로필

- 자체 QR 알고리즘을 삭제하고 [node-qrcode 공식 API](https://github.com/soldair/node-qrcode)의 PNG Data URL 방식으로 교체했다. 한글 JSON을 UTF-8로 생성하며 큰 payload/라이브러리 오류를 화면에 표시한다.
- 기존 `id/n/a/g/h/w/s/al` 필드는 유지했다. `type:'vitamin-health'`, `version:2`를 추가하고 `c/ag/m`을 코드 배열로 바꿨다. `conditions/allergies/medications` 원본 문자열 배열도 함께 유지한다. `issuedAt`과 `expiresAt`은 생성하지 않는다.
- QR 카운트다운·만료 표시·시간 검사를 제거했다. 동일 건강정보는 동일 payload를 만들고, 건강정보 변경 시 현재 프로필 기준으로 QR 이미지를 다시 생성한다. 새로고침은 현재 payload 이미지를 다시 생성한다.
- null/배열/숫자/빈 객체/잘못된 JSON/누락·잘못된 타입·범위·버전은 거부한다. 시간 필드가 없어도 정상 구조의 version 2 QR은 허용하며, 기존 시간 필드는 무시한다.
- 복수 질환은 모두 추천에 반영한다. 직접 입력 약물은 QR와 안내에 남기되 알려지지 않은 항목의 자동 상호작용 검사는 하지 않는다고 표시한다.
- 사용자별 저장/복원 키를 `getProfileStorageKey`로 통일하고 자동 저장 effect를 제거했다. 저장 버튼을 누르기 전의 빈 기본값/미저장 편집은 기존 저장값을 덮지 않는다.
- 새로고침·다시 로그인·A/B 전환을 확인했다. 필수 프로필이 없으면 QR/홈으로 이동할 수 없다. 로그아웃 이후 도착한 이전 저장/복원 응답은 현재 화면·사용자 상태를 덮지 않는다.

### 키오스크 초기화

- 홈/처음으로, 60초 미사용, 정상 완료 후 확인 버튼에서 resetKiosk를 호출한다.
- reset은 현재 추천과 화면을 초기화하고 컴포넌트를 remount한다. 자식의 QR 입력·프로필·장바구니·선택 상품·상세 모달·주문 영수증 상태가 함께 사라진다.
- sessionStorage는 명시한 키오스크 임시 키만 삭제한다. `localStorage.clear()`는 사용하지 않는다. 상품 DB·재고·사용자 구매 기록은 지우지 않는다.
- click/touchstart/keydown/input이 타이머를 갱신한다. 홈에서 반복 reset은 없고 effect가 이벤트/타이머를 정리한다.
- **주문 처리 중은 idle 초기화 예외**다. 홈과 모달 닫기도 막고 브라우저 unload 방지 요청을 건다. 브라우저 강제 종료·전원 차단 자체를 막을 수는 없다.
- 결과 확인이 필요한 주문의 opaque requestId는 별도의 복구 참조로 남긴다. 건강정보나 구매내역을 키오스크에 영구 저장하는 기능은 아니다. 이 참조가 있으면 새로운 주문을 막고 관리자 확인을 요청한다.

### 주문·재고·구매내역

- DB 없으면 실패. 구형 place_order 폴백도 제거했다. 구형 RPC는 배출 전에 completed를 기록하므로 새 클라이언트에서 호출하지 않는다.
- 기존 `orders / order_items`를 그대로 사용한다. 주문에 QR의 사용자 ID와 고유 requestId를 연결한다. QR 없이 직접 구매하면 사용자 ID가 NULL인 게스트 주문이며 앱의 개인 구매내역에는 연결되지 않는다.
- SQL에서 중복 상품을 합산하고 상품 ID 순서로 `FOR UPDATE` 잠금 후 재고를 검증한다. 같은 트랜잭션에서 가격·슬롯 snapshot, dispensing 주문, 품목, 재고 차감을 저장한다. [PostgreSQL 행 잠금 문서](https://www.postgresql.org/docs/17/explicit-locking.html)를 기준으로 적용했다.
- 요청 UUID를 멱등성 키로 사용해 같은 예약을 두 번 생성하지 않는다. UI의 즉시 ref guard와 isOrdering 상태도 중복 클릭을 막는다.
- Pi API가 모든 Arduino 배출 명령을 확인한 후에만 completed로 확정한다. 미시작이 확실한 실패는 failed와 재고 복원을 같은 트랜잭션에서 처리한다.
- 부분 배출/타임아웃/응답 분실은 review_required. 재고 자동 복원·완료 표시·자동 재배출을 하지 않는다. 배출 후 DB 확정 실패도 주문 완료로 표시하지 않는다.
- 서버가 계산한 확정 가격·수량을 영수증에 사용한다. 완료 주문만 앱 구매내역에 날짜·품목·파우치 수량·구매 당시 금액을 최신순으로 표시한다. 개발 시뮬레이션 기록은 시연으로 구분한다.
- 기존 공개 주문 읽기 정책/테이블 권한을 제거하고, 기존 데모 계정 비밀번호를 서버에서 확인하는 구매내역 RPC를 사용한다. 클라이언트도 현재 user_id/completed를 다시 확인한다. **전체 앱 인증/RLS 보안 문제가 해결됐다는 의미는 아니다.**

### 하드웨어·UI

- 상품별 `dispenser_slot` 1~20을 추가했다. 실제 핀/시간은 Pi의 기존 제어 코드가 관리한다. 물리 매핑을 추측해 넣지 않고 기본값은 미연결 NULL로 둔다.
- 배출 URL이 없으면 실패한다. 명시적 simulation도 development에서만 허용하고 DB는 필요하다. production에서는 simulation 설정으로 하드웨어를 우회할 수 없다.
- 앱의 프로필·입력·홈·구매내역 영역에 내부 세로 스크롤을 허용했다. 기본 스타일은 유지했다. 실제 Android 키보드 상태 검증은 별도다.
- 상품 가격과 판매 단위는 1회분 파우치로 표시/정정했다. seed의 상품·가격 숫자는 임의로 바꾸지 않았다. 실제 파우치 구성과 판매가격 검수는 필요하다.

## 3. 실제 테스트 결과

**자동 테스트 20개 통과: 통합 16개 + 키오스크 React 4개. QR 만료 정책 변경 후 모바일/키오스크 production build와 모바일 ESLint도 통과.**

통합 테스트는 PGlite의 실제 PostgreSQL 엔진으로 제공 SQL을 적용했다. 서비스 호출 일부는 네트워크/하드웨어 mock을 사용했다. React 시험은 QR 추천 진입부를 test fixture로 대체하고 실제 구매 화면/결제 모달/App 초기화를 검증했다. 실물과 Supabase 클라우드까지 시험했다고 주장하지 않는다.

| TXT 항목 | 결과 | 실제 검증 범위 |
|---|---|---|
| 1 프로필 저장→새로고침 | PASS | 브라우저 저장/새로고침/마이페이지 값 확인 + 저장 helper 시험 |
| 2 A/B 분리·A 재로그인 | PASS | 별도 테스트 origin에서 A/B 가입·저장·전환·A 복원 확인 |
| 3 질환 2개 QR 포함 | PASS | 브라우저·producer/parser·양쪽 질환 추천 규칙 |
| 4 직접 입력 약물 보존 | PASS | 브라우저에서 `고혈압약, 직접입력약` 입력·복원·payload 확인 |
| 5 한글 QR 생성 | PASS | 실제 PNG 생성→독립 jsQR 디코더로 원문 일치 + 브라우저 QR 표시 |
| 6 정상 QR parser | PASS | version2 producer 결과를 키오스크 parser에 전달 |
| 7 null/{} /[] /42/잘못된 JSON | PASS | 모두 거부, 필드/타입/버전 오류도 거부 |
| 8 QR 시간 제한 제거 | PASS | 동일 QR을 가상 시계 1분·1일·1년 후에도 허용, 기존 시간 필드 무시, 건강정보 수정 시 payload 변경 |
| 9 비타민 C 카테고리 | PASS | 모든 샘플 카테고리 각각 2개, 실제 로컬 SQL 경로에서도 C만 2개 |
| 10 QR→추천→홈 초기화 | PASS | React 구매 화면·장바구니·QR 표시 제거·키 삭제·다음 구매 빈 cart |
| 11 1분 idle | PASS | React fake timers의 실제 60초 경계, 활동시 연장, cleanup 시험 |
| 12 성공→재고 차감→reset | PASS(로컬) / 실물 미검증 | 로컬 SQL 예약/완료 + React 완료 확인/reset. 실제 모터 없음 |
| 13 reset 후 차감 재고 유지 | PASS(로컬) | stock 10→8 확인, reset은 DB를 호출하지 않음, 차감값 보존 |
| 14 DB 실패시 완료 금지 | PASS | 서비스 DB 미설정·DB 오류 + React 실패 표시/cart 유지 |
| 15 연속 클릭 1회 | PASS | React 동일 이벤트 연속 click 1호출 + 서비스 guard + DB requestId 재호출 재고 불변 |
| 16 기록 저장·reset 후 유지 | PASS(로컬) / 원격 미검증 | SQL completed·품목·user_id 저장, reset 후 내역 잔존 |
| 17 현재 사용자 구매내역 | PASS(로컬) / 실제 Android 미검증 | A 기록/B 빈 결과/비밀번호 오류 차단/공개 직접 SELECT 차단, 서비스 교차 사용자 필터 |
| 18 서로 다른 네트워크 | PASS(구조 확인) / 외부망 미검증 | 두 앱은 독립적으로 Supabase HTTPS 사용. 실제 Wi-Fi/LTE·키·RLS 설정은 미검증 |

추가 검증: SQL 업데이트 재실행, 실패 확정 2회시 복원 1회, 재고 초과·중복 상품 합산 거부, unknown 배출을 완료 기록에서 제외, production simulation 차단. 마지막 `git diff --check`에서 공백 오류가 없었다.

실행 명령:

```text
health-app-web: node --test tests/integration.mjs
health-app-web: node node_modules/eslint/bin/eslint.js .
health-app-web: node node_modules/vite/bin/vite.js build
frontend: node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand
frontend: node node_modules/react-scripts/bin/react-scripts.js build
```

현재 환경의 파일 접근 제한 때문에 의존성 실행에 승인된 sandbox 외 실행을 사용했다. npm 잠금 파일을 유지/갱신했으며 임의 대규모 버전 업그레이드는 하지 않았다. 앱 소스는 로컬 개발 서버에 반영돼 있다.

## 4. 남은 문제: 코드 미완성과 실물 검증 구분

### 설정/연결 작업이 필요한 것

- **원격 Supabase 미적용:** `.env`와 프로젝트 관리 접근이 제공되지 않아 원격 SQL을 실행하지 않았다. `frontend/supabase/kiosk_purchase_history.sql`을 기존 스키마/앱 사용자 테이블 뒤에 적용하고 두 앱의 URL·키를 같은 프로젝트로 설정해야 한다. 새 SQL 전까지 새 주문 RPC는 정상 작동하지 않는다.
- **실제 Pi API 서버 미구현/미연결:** 프론트 인터페이스와 API 계약은 구현했다. 기존 별도 Arduino 제어 코드는 저장소에서 찾지 못했다. 그 코드를 Pi API에 연결하고 orderId 중복 방지를 구현해야 한다. 대규모 배출 로그 시스템은 추가하지 않았다.
- **슬롯 미설정:** 실제 20개 모터에 연결할 상품을 골라 dispenser_slot을 설정해야 한다. 미연결 상품은 활성 판매 목록에서 제외해야 한다.
- **실제 결제 SDK/단말 미연결:** 결제 수단 선택은 여전히 시연 UI다. 카드 승인 사실을 확인하는 API는 이번 TXT의 전체 인증/운영 전환 범위 밖이다.
- **자동 장애 복구 미구현:** 부분 배출·전원 끊김의 재고 정산은 관리자 확인이 필요하다. 단순 재시도나 pending 키 삭제로 해결하지 않는다. 상세 배출 로그는 추가하지 않았다.

### 실물이 있어야 확인할 것

- MQ160W USB HID 모드, 입력창 포커스, Enter 종결, 한글 JSON 인코딩, 전체 payload 길이 인식.
- Raspberry Pi의 브라우저·로컬 API·인터넷 연결과 CORS/localhost 설정.
- Arduino Mega 핀/동작시간, MOSFET·12V DC 모터·전원, 실제 1회분 파우치 배출 수량.
- 실제 배출 명령 전달/응답과 부분 실패. 배출 센서가 없으면 성공 판정은 명령 확인까지만 가능하다.
- 휴대폰 LTE와 Pi Wi-Fi 각각에서 같은 클라우드 주문/재고 조회.
- Android 키보드가 올라간 작은 화면 스크롤과 QR 스캔, Capacitor APK 빌드/설치. 이번 환경에는 Java 실행 도구가 발견되지 않아 APK 빌드를 하지 않았다. 공유 웹 번들 빌드는 통과했다.

## 5. 기존 앱 동작에 영향을 줄 변경

1. 만료정보 없는 version 2 QR도 정상 처리한다. 필수 건강정보·type/version 검증은 유지하므로 이 구조를 갖추지 못한 구형 QR은 앱에서 다시 생성해야 한다.
2. 구매내역 SQL 적용이 필요하다. 구형 주문 RPC 공개 권한은 철회된다. 과거 사용자 ID 없는 주문을 임의 사용자에게 귀속시키지 않았다.
3. DB/배출 API 없이 성공하던 시연은 사라졌다. 상품 샘플 조회는 유지되지만 주문에는 DB가 필요하다.
4. 프로필 편집은 저장 버튼을 누른 경우만 영구 보존한다. DB 저장 실패는 로컬 저장 여부와 클라우드 오류를 구분한다.
5. 홈·idle·완료 확인은 키오스크 전체 사용자 상태를 지운다. 주문 실패시 cart는 유지된다. 처리 중/복구 필요 주문은 재주문을 막는다.
6. 개발 배출 시뮬레이션은 명시적인 development 설정에서만 가능하며 DB 구매 기록에는 시연 여부가 남는다.
7. `npm run db:test-order`는 실제 재고를 차감하지 않는 로컬 시험으로 바뀌었다.
8. 일반 앱 사용자의 구매내역은 최대 최근 100개 completed 주문을 표시한다. 게스트 주문·실패·처리중·확인필요는 개인 완료 내역에 표시하지 않는다.

## 6. 시연에 영향을 줄 중요한 잔여 문제

- **평문 비밀번호·anon 전체 허용 앱 RLS·프론트 isAdmin 판정은 여전히 데모 구조다.** 새 주문 테이블 공개 읽기를 좁히고 서버 구매내역 RPC를 두었지만, 기존 app_users의 공개 권한으로 비밀번호를 얻을 수 있다면 인증 체크를 우회할 수 있다. 실제 개인정보로 사용하지 않는다. Supabase Auth 전환과 사용자 소유 RLS는 후속 작업이다.
- **QR은 서명된 신원 증명이 아니다.** 구조 검사만 하며 사용자가 JSON의 ID를 위조할 수 있다. 안전한 사용자-구매 연결은 서버 발급 서명 토큰 단계가 필요하다. 이번 범위에서는 요구된 최소 계정 분리를 구현했다.
- **센서 없는 배출 완료는 실제 수령 증명이 아니다.** API accepted는 모든 명령 응답 확인으로 제한해야 한다. 네트워크 오류 후 무조건 재배출/재고 복원하면 중복 또는 재고 오류가 생긴다.
- **재고 seed 재실행 주의:** 기존 seed는 재고를 100으로 바꾼다. 새 업데이트 SQL은 재고를 초기화하지 않는다. 운영 설치 순서를 README에 명시했다.
- **상품 24종/모터 20개 차이:** 물리 연결할 20상품과 각 파우치 구성·가격을 확인해야 한다. null 슬롯은 하드웨어 주문이 실패하도록 처리했다.
- **의존성 점검 후속 필요:** 설치 시 npm audit 요약은 건강 앱 12건(critical 2), 키오스크 97건(critical 3)을 보고했다. 개발 도구/전이 의존성을 포함한 수치이고 실제 운영 악용 경로까지 검증한 것은 아니다. 시연 기능 변경과 섞어 강제 버전 업그레이드는 하지 않았다.

이번 수정은 실제 결제·하드웨어 연결이 완료됐다는 보고가 아니다. 앱/키오스크 코드와 안전한 주문·구매내역 연결 지점, SQL, 로컬 검증까지 완료했다. 원격 설정과 실물 배출 검증을 해야 전체 시연 흐름을 확인할 수 있다.

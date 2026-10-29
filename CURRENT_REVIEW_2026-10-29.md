> 수정 전 감사 기록입니다. 후속 수정과 현재 상태는 [SOFTWARE_HANDOFF.md](SOFTWARE_HANDOFF.md)를 참고하세요.

# 최신 코드·문서·DB 점검 결과

점검일: 2026-10-29 (한국시간). 기준: `main`의 `c8e9af6`.

`394d5f6` 이후 `febdc6d`, `c8e9af6`를 fetch하고 fast-forward로 가져왔다. 기존 미추적 `analysis/mobile-qr.png`는 보존했다. 이번 작업은 현황 점검이며 앱 소스·DB·모터 설정을 변경하지 않았다. 이 보고서와 네트워크 없는 재현 스크립트만 추가했다. GitHub에 다시 푸시하지 않았다.

## 판단

**두 웹과 무료 배출 백엔드 및 현재 Supabase 설정은 상당 부분 구현돼 있다. 남은 핵심은 일부 코드 문제 수정, 빌드 재현성 확보, 최신 Pi 배포와 실물 통합 검증이다.**

이전 대화의 “원격 DB 미적용 / Pi 서버 미구현”은 이제 현재 상태가 아니다. 현재 원격 DB를 읽기 전용으로 확인했고, Python gateway도 저장소에 있다. 다만 “20상품 등록”은 “20개 모터 연결 완료”를 뜻하지 않는다.

| 영역 | 확인한 현재 상태 | 완료로 볼 수 없는 범위 |
|---|---|---|
| 모바일 회원 | Supabase Auth 가입·인증·로그인·로그아웃, JWT로 본인 정보 접근 | 실제 아이폰 이메일 인증·재로그인 현장 시험 |
| 건강정보 | DB 조회/저장, 실패 표시, 저장 전 QR 진입 제한, 사용자 변경 시 상태 제거 | 단일 선택과 안내 문구의 불일치 |
| QR | 정확한 11필드를 생성, c/ag/m 각각 숫자 하나, ASCII Unicode escape, PNG, 무기한 재사용 | parser와 gateway의 추가 필드 허용 기준 불일치, 실물 HID 입력 |
| 추천 | 로컬 규칙 기반. 식사 보완 5항목, 건강조건별 제외/보류와 근거 표시 | 의료진 검증·실제 파우치 라벨/함량 확정은 별도 |
| 키오스크 | 직접 선택·추천·최대 5개·무료 배출 확인·60초 세션 초기화 | 실제 터치 패널 가독성/스캐너/실물 배출 |
| 배출 서버 | 기기 인증, 재고 예약, serial STARTED/DONE, 결과 확정, SQLite 실행 journal | 미도착 요청의 브라우저 잠금 복구 경로 누락 |
| DB | 회원 본인 RLS, 20개 활성 상품, 2개 슬롯, 구형 RPC 권한 회수 확인 | 재고 실측 정산, 제품 라벨 데이터, 새 DB 구축 자동화 |
| 배포 | 패키징·설치·systemd·브라우저 자동 시작 스크립트 | 이 컴퓨터의 모바일 clean install 실패, Pi 최신 설치 여부 미검증 |

## 최신 요구사항으로 읽어야 하는 부분

- 결제는 사용자가 제외한 기능이다. PG/카드 결제를 남은 필수 작업으로 다시 넣지 않는다.
- 모바일은 같은 공유기에서 접속하는 웹이다. Android 폴더는 남아 있지만 APK 배포가 현재 완료 기준은 아니다.
- QR은 `id,n,a,g,h,w,s,al,c,ag,m`이다. type/version/token/만료시간을 요구하지 않는다.
- 질환·알레르기·약물은 각 1개 코드다. 이전 복수 코드 QR 정책과 다르다. 실제 복수 질환 전체를 검토하는 시스템이라고 설명하면 안 된다.
- 예전 QR 이미지는 건강정보 수정 후에도 그 당시 값을 계속 전달한다. 현재 설계의 의도이며 DB의 최신 프로필과 자동 동기화되는 QR이 아니다.
- SQLite는 재고 DB가 아니라 중복 배출 방지와 장애 복구용 실행 기록이다. 재고 기준은 Supabase다.

## 원격 Supabase 읽기 전용 확인

두 `.env`가 가리키는 프로젝트와 연결된 `vitamin-vending-machine` 프로젝트가 일치했다. 개인 건강정보·이메일·비밀번호·기기 토큰을 조회하지 않고, 집계·상품 슬롯·정책·권한·함수 정의만 읽었다. 주문 생성·재고 차감·SQL 적용·모터 명령은 실행하지 않았다.

| 항목 | 2026-10-29 조회 결과 |
|---|---|
| 전체 상품 / 활성 상품 | 24 / 20 |
| 활성 상품 중 슬롯 지정 | 2 |
| 상품 ID3 | 슬롯1, 문서상 비타민 C / Mega D3 |
| 상품 ID5 | 슬롯2, 문서상 비타민 D3 / Mega D4 |
| 기기 허용 슬롯 | 활성 기기 설정에 `[1,2]` |
| 활성 상품 알레르기 검증 완료 | 0 |
| member_health_profiles | RLS 활성, authenticated 본인 SELECT/INSERT/UPDATE |
| orders / order_items | RLS 활성, 본인 completed 주문만 조회 |
| 구형 app_users 등 개인정보 테이블 | anon SELECT/UPDATE 권한 없음 |
| 구형 place_order/place_kiosk_order/finish_kiosk_order | anon/authenticated 직접 실행 불가 |
| 서버 QR issue/resolve 함수 | anon/authenticated 실행 불가 |
| 무료 reserve/finish/lookup 함수 | 공개 API 역할이 호출할 수 있으나 함수 내부에서 기기 비밀값 검증 |

Supabase 보안 Advisor에는 `RLS enabled, no policy` INFO 7건이 있었다. private 내부 테이블 및 접근을 막은 구형 테이블이므로 공개 읽기를 허용하라는 뜻이 아니다. [Advisor 설명](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Advisor 결과만으로 모든 보안 검증을 완료했다고 판단하지 않는다.

알레르기 검증 완료가 0이므로 현재 식품 알레르기를 선택한 사용자에게 상품 후보가 모두 제외될 수 있다. 실제 코드의 의도된 보류이며 규칙을 느슨하게 풀어서 해결할 항목이 아니다. 실제 제품 전체 성분과 교차접촉 표시를 확인한 후 데이터 등록이 필요하다.

## 먼저 보완할 문제

### 1. 서버에 도착하지 않은 요청은 현재 복구 절차로 잠금을 풀 수 없음

근거: `frontend/src/services/orderService.js:9`, `pi_gateway/server.py:52`, `pi_gateway/recover.py:18`.

브라우저는 요청 전에 localStorage에 requestId를 저장한다. 서버에 도달하기 전 연결이 끊어져도 이 값이 남는다. 서버 journal에 해당 ID가 없으면 status는 `known:false, requiresReview:true`이고 브라우저는 이후 모든 재시도를 차단한다. 관리자 recover 도구도 journal에 행이 없으면 “기록이 없습니다”로 종료한다. 따라서 문서에 적힌 복구 도구만으로 이 경우를 처리할 수 없다.

`node analysis/review-20261029.mjs`에서 서버 미도착을 가정한 fetch 실패와 unknown 응답으로 반복 잠금을 재현했다. 실제 통신이나 모터를 사용하지 않았다.

필요 작업: 로컬 실행 기록·DB 요청 상태·진행 중 요청을 함께 확인하여 **미접수임을 확정한 요청을 취소/정리하는 관리자 경로**를 만들고, 그 후 브라우저 잠금을 해제한다. unknown을 무조건 지우거나 자동 재배출하는 방식은 사용하지 않는다.

### 2. 모바일의 문서상 clean install을 현재 Windows에서 재현하지 못함

`pnpm dlx npm@11 ci --ignore-scripts --no-audit --no-fund` 실행 시 npm 11.21.1이 다음 오류를 반환했다.

```text
npm ci can only install packages when package.json and package-lock.json are in sync
Missing: @emnapi/core@1.11.3 from lock file
Missing: @emnapi/runtime@1.11.3 from lock file
```

기존 로컬 node_modules에는 새 모바일 의존성 `@supabase/supabase-js`도 없어서 Vite 빌드가 import resolve 오류로 실패했다. Supabase 패키지는 최신 package.json에는 등록돼 있다. 이전 컴퓨터에서 빌드됐다는 문서를 부정하는 것은 아니지만, **이 체크아웃에서 문서의 설치 순서로 새 모바일 패키지를 만들 수 있다는 검증은 실패**했다.

필요 작업: 지원 Node/npm 버전을 고정하고 잠금 파일을 보완한 뒤 깨끗한 설치 → lint → 테스트 → build를 다시 확인한다. 이번 검토에서는 lockfile을 자동 수정하지 않았다.

### 3. QR parser는 통과시키지만 배출 서버는 거절하는 입력이 있음

근거: `frontend/src/services/qrPayload.js:5`, `pi_gateway/server.py:61`.

키오스크 parser는 필수 값만 검증하고 추가 필드를 허용하며 `raw:p`를 그대로 배출에 전달한다. gateway는 키 집합이 정확히 11개가 아니면 거절한다. 정상 QR에 `extra` 또는 예전 timestamp 필드를 하나 붙이면 추천 단계는 성공하지만 무료 배출 단계에서 형식 오류가 난다. 새 앱의 정상 생성값은 11개여서 기본 경로에는 해당하지 않는다.

재현 스크립트에서 12필드 입력의 parser 성공 및 raw 보존을 확인했다. gateway의 정확한 11필드 조건과 대조했다.

필요 작업: 입력 단계에서 추가 필드를 거절하거나, 시간 정책을 바꾸지 않고 검증된 11필드로 정규화하는 등 양쪽 계약을 맞춘다. QR 시간을 만료 기준으로 사용하지 않는다.

### 4. 단일 선택인데 화면은 “모두 선택 / 쉼표 구분”이라고 안내

근거: `health-app-web/src/App.jsx:156`, `:1063`, `:1081`.

실제 버튼은 한 값으로 교체하고 저장 검증도 단일 값만 허용한다. 하지만 약물·알레르기 화면은 모두 선택하도록 안내하고 직접 입력 placeholder는 쉼표 구분을 요구한다. 사용자가 안내대로 입력하면 저장 오류가 난다. 최신 단일 선택 규격에 맞게 문구를 바꿔야 한다.

### 5. 현재 자동 DB 테스트가 신규 무료 배출 SQL 전체를 실행하지 않음

근거: `health-app-web/tests/integration.mjs:259` 부근.

PGlite 테스트는 구형 기본 schema/seed/orders/payment/app_schema/kiosk_purchase_history/catalog_safety까지 적용한다. 신규 member_auth_schema/free_vending_schema/compact_qr_correction을 적용해 Auth RLS·무료 예약·회원 내역 전체를 회귀 검사하지는 않는다. Python의 DB는 fake이며 React 추천 화면과 주문 서비스도 mock이다.

43개 통과는 유효한 결과지만 최신 흐름 전체의 종단간 검증 43개라는 뜻은 아니다. 특히 React QR fixture에는 `qrData`가 없고 주문 인자의 qrProfile이 null인 것을 확인하므로 실제 스캔→회원 주문 연결을 이 테스트가 증명하지 않는다.

필요 작업: 실제 신규 SQL을 포함한 격리 DB 회귀 시험, QR 원문 전달, 기기 인증 실패, 회원 A/B 분리, 무료 금액 0, 5개 상한, 미접수/부분 배출/확정 응답 유실 복구를 추가한다. 이번에는 원격 DB 변경 시험을 수행하지 않았다.

## 추가로 남아 있는 구현·정리

- **Mega 펌웨어 소스 미포함:** Git 추적 `.ino`가 없다. gateway의 `MOTOR20_V1`, RUN/STARTED/DONE 규약은 읽을 수 있지만 실제 펌웨어 출력 매핑·정지 동작을 이 저장소로 재검토/재업로드할 수 없다. 업로드한 소스와 보드/라이브러리/버전을 함께 보관해야 한다.
- **지도 미설정:** 현재 모바일 `.env`에 Kakao 키가 없다. UI도 키 필요 메시지를 표시하는 구조다. 지도까지 시연한다면 키·웹 origin 등록 및 실제 좌표 확인이 필요하다.
- **관리자 UI는 운영 기능이 아님:** `memberSession`은 항상 `isAdmin:false`; 기존 관리자 화면 코드가 남아 있으나 정상 회원 진입 경로가 없다. 위치 쓰기 DB 정책도 현재는 없다. 기존 숨겨진 CRUD의 catch는 실패에도 성공 문구를 만들므로 그대로 활성화하면 안 된다. 재고 관리자 UI도 구현 완료로 볼 수 없다.
- **미사용 코드 정리:** PaymentModal, 옛 dispenserService, profileStorage, 서버 QR 함수/테이블 및 과거 백업은 현재 주 경로와 구분해야 한다. 특히 구형 SQL 재실행은 현재 권한을 다시 열 수 있다.
- **새 DB 재구축:** 최신 SQL은 적용 이력 모음이며 완전한 bootstrap이 아니다. 기존 app_admins 등 선행 구조와 현장 적용 변경을 정리한 마이그레이션이 필요하다. 기존 DB에 seed를 재실행하지 않는다.
- **회원 식별 한계:** QR ID는 서명된 신원 증명이 아니다. UUID가 실제 Auth 회원과 같으면 주문 내역에 연결하지만 제시자가 그 회원인지 인증하지 않는다. 현재 문서도 이 한계를 인정한다. 서버 발급 토큰으로 임의 변경하지 않았으며 발표에서도 본인 인증 QR이라고 설명하지 않는다.
- **물리 검증 한계:** DONE은 모터 명령 종료이며 실제 파우치 낙하 감지가 아니다. 센서나 수령구 확인 없이는 실제 수량을 증명하지 못한다. 부분 배출은 품목별 정산 절차가 추가로 필요하다.

## 읽은 Markdown 19개와 해석

Git 추적 Markdown을 기준으로 백업 안의 6개까지 읽었다. 의존성 node_modules 문서는 프로젝트 문서 수에 포함하지 않았다.

| 문서 | 판단 |
|---|---|
| README.md | 현재 진입점. 무료 배출·11필드·설치/시험 안내. clean install 문제는 이번 확인 결과 추가 필요 |
| STATUS.md | 현재 운영 기준. DB 완료/Pi 설치 미확인 구분은 적절. 이번 코드 문제와 지도·라벨 상태 보완 필요 |
| PROJECT_CHECK.md | STATUS로 연결하는 최신 요약 |
| QR_PROTOCOL.md | 현재 QR 규격과 신원 인증 한계를 명시. parser/gateway 계약 차이 보완 필요 |
| LOCAL_BACKUPS.md | 공개 환경설정·소스 백업의 Git 포함 범위. 비밀 기기 설정은 미포함 |
| CHANGE_REPORT.md | 상단 10/28 이력 우선. 아래 10/14 결제·복수 QR·DB 미적용은 과거 기록 |
| PROJECT_ANALYSIS.md | 최초 코드 분석. 현재 상태 판단의 근거로 그대로 사용하면 안 됨 |
| RECOMMENDATION_REVIEW.md | 추천 검토 배경은 유효. 복수 선택·QR version 및 DB 미적용 부분은 과거 상태 |
| frontend/DATABASE.md | 현재 RLS와 무료 주문 구조. 상단 env 포함 안내와 본문의 env 미업로드 문구가 충돌 |
| frontend/HARDWARE.md | 현재 두 슬롯·응답·복구 설명. 미도착 요청 복구 공백은 추가 필요 |
| health-app-web/README.md | 현재 회원 웹과 단일 QR 설명 |
| pi_gateway/README.md | 현재 실행 절차. SCP 예시의 다른 컴퓨터 절대 경로는 이 작업 PC에서 존재한다고 가정하면 안 됨 |
| deployment/README.md | 재패키징·설치·비밀 설정 보존 설명. 마지막 “로컬 백업 Git 제외”는 이미 포함된 소스 백업과 구분 필요 |
| compact-qr-backup-20261028-220056/README.md | 서버 발급 QR을 쓰던 과거 스냅샷 |
| compact-qr-backup-20261028-220056/health-app-web/README.md | 서버 토큰 QR·재발급 무효화 설명. 현재 규격 아님 |
| compact-qr-backup-20261028-220056/pi_gateway/README.md | 44개 시험·서버 QR 설명. 현재 43개와 혼동 금지 |
| qr-review-backup-20261028-210923/README.md | 과거 결제·다중 선택·임시 인증 설명 |
| qr-review-backup-20261028-210923/frontend/HARDWARE.md | Pi 서버 미구현 시절 계약. 현재 gateway 설명으로 사용 금지 |
| qr-review-backup-20261028-210923/health-app-web/README.md | Vite 템플릿 기록 |

## 코드 확인 지도

실행 경로를 중심으로 읽고 호출 관계를 대조했다. 백업 코드 전체·이미지·생성된 Android/의존성 코드를 최신 실행 코드라고 취급하지 않았다.

| 파일/그룹 | 역할·확인 내용 |
|---|---|
| mobile App.jsx | Auth 초기화/계정 전환, 필수 입력, 단일 선택, DB 저장, QR, 이용내역, 지도/숨은 관리자, footer |
| authClient.js | 실제 signUp/signIn/signOut 경로, 인증 링크 origin/type 제한, 관리자 권한 없음 |
| healthDb.js | 세션 JWT, 15초 timeout, 회원별 조회/저장, 완료 내역, 위치 CRUD |
| qrProfile.js / qrImage.js / healthCatalog.json | 11필드·숫자 코드·한글 escape·PNG, 양쪽 코드표 일치 |
| kiosk App.js / kioskSession.js | 홈/60초/성공 확인 초기화, 배출 중 초기화 차단 |
| MainScreen / RecommendScreen | 직접 선택/추천, 세부 상황→QR, HID textarea+Enter, raw QR 전달 |
| PurchaseScreen / DispenseModal | QR 제한·미연결 상품 버튼 차단·최대 5개·무료 확인·결과 표시 |
| orderService.js | same-origin API, CSRF meta, pending UUID 보존, 결과 조회, timeout |
| qrPayload.js / qrResolver.js | 서버 없는 로컬 해석, 숫자/범위 검사, 원문 보존 |
| recommendationService / recommendationSafety / data 정책 | 식사 후보와 제외/보류, 검증 안 된 알레르기 라벨 차단, 구형 DB 추천 매핑 미사용 |
| vitaminService.js | 활성 상품/슬롯 조회, sample fallback 설정, 설명 정규화 |
| kiosk CSS 3개 / index.css | 화면별 scope, 2열 추천, 스크롤, 장바구니, 96% root 폭. 실물 시각 검증은 별도 |
| pi_gateway/server.py | 기기 인증·journal·단일 실행 lock·모터 handshake·결과 확정·Host/Origin/localhost 검사 |
| recover.py / set_runtime.py | 관리자 확인 복구, 등록 슬롯 시간 100~5000ms 변경, 기존 설정 보존 |
| deployment/package.py / install.sh / open_kiosk.sh | 정적 번들, 비밀 설정 분리, systemd, Wayland Chromium 시작 |
| SQL / 테스트 | 기존 예약·확정과 신규 Auth/free/compact 변경의 연결 및 실제 DB 정의·권한 대조 |

## 이번에 직접 수행한 검증

| 확인 | 결과 |
|---|---|
| Git 최신 반영 | c8e9af6까지 fast-forward |
| Node 통합 테스트 | 29/29 PASS |
| React 화면 테스트 | 6/6 PASS; sandbox Jest 캐시 오류 후 승인된 실행에서 재확인 |
| Python 가상 모터/HTTP 테스트 | 8/8 PASS; sandbox 임시 SQLite 접근 오류 후 승인된 실행에서 재확인 |
| 모바일 ESLint | PASS |
| 키오스크 production build | PASS; 기존 로컬 의존성 사용, Browserslist/deprecation 경고 있음 |
| 모바일 production build | FAIL: 로컬 Supabase 패키지 미설치 |
| 최신 모바일 npm ci | FAIL: npm 11.21.1에서 lockfile 누락 오류 |
| 별도 경계 상황 재현 | QR 추가 필드와 미도착 요청 잠금 2건 확인 |
| 원격 DB | 읽기 전용 구조·권한·상품/슬롯/라벨 집계 확인 |
| 실제 Pi·Mega·스캐너·Safari·재부팅 | 이번에 수행하지 않음 |

빌드 산출물만 보고 모바일 성공이라고 판단하지 않는다. 이번 Vite 명령은 파일 크기를 출력한 후에도 exit code 1로 실패했다. 네트워크 없는 회귀 시험 통과와 모바일 설치/빌드 성공은 별개다.

## 다음 작업 순서와 완료 기준

1. **개발 PC 재현성:** 모바일 lockfile/Node/npm 기준 정리 → clean install 및 두 앱 빌드 성공.
2. **시연 전 코드 보완:** 미접수 요청 복구, QR 검사 일치, 단일 선택 안내, 신규 SQL 회귀 시험.
3. **배포 준비:** 기존 Pi의 device.json·journal을 보존하고, Mega 펌웨어 소스/버전 확보. 새 번들 생성·전송·설치.
4. **두 슬롯 통합:** 실제 아이폰 가입/로그인/저장/QR → HID 스캔 → C 또는 D3 1개 → 실제 낙하 확인 → DB 재고/본인 내역 비교.
5. **작동 시간·재고:** 500ms는 시험값이므로 사용자 교정값으로 설정하고 실측 재고를 맞춘다. 임의 재고 초기화 금지.
6. **장애·자동 시작:** DB/USB 끊김과 결과 미확정 복구, 서비스 재시작, 재부팅 후 웹/브라우저 시작 확인.
7. **나머지 18개 확장:** 각 배선·슬롯·작동 시간·파우치 함량·알레르기 라벨 확인 후 하나씩 활성화. 지도 기능을 시연하면 Kakao 설정도 완료.

지금 바로 “모든 기능 완료, 설치만 하면 됨”이라고 결론 내리기보다는, 위 1~2를 먼저 해결한 뒤 두 모터로 전체 흐름을 한 번 검증하는 것이 적절하다.

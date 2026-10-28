> 2026-10-28 추가: 사용자 요청으로 현재 공개 설정만 담긴 두 `.env`와 소스 백업 6개를 Git에 포함했습니다. 범위와 구분은 [LOCAL_BACKUPS.md](LOCAL_BACKUPS.md)를 참고하세요. 기기 인증키·실행 journal은 포함하지 않습니다.

# 영양제 무료 배출 시스템

현재 기준: **2026-10-28 (한국시간)**. 결제 기능은 사용하지 않습니다.

휴대폰에서 가입·로그인하고 건강정보를 저장한 뒤 QR을 표시합니다. 라즈베리파이 키오스크가 QR을 직접 해석해 추천을 계산하고, 선택한 영양제를 Mega로 배출한 뒤 Supabase 재고와 이용내역을 기록합니다.

## 현재 상태와 다음 작업

- [진행 현황·완료 범위·남은 작업](STATUS.md)
- [확정된 QR 규격](QR_PROTOCOL.md)
- [라즈베리파이 배포·자동 시작](deployment/README.md)
- [모터 연결·시간 설정·장애 복구](frontend/HARDWARE.md)
- [DB 구조·권한·SQL 적용 기록](frontend/DATABASE.md)
- [최근 변경 이력](CHANGE_REPORT.md)

**최신 코드와 DB 수정은 완료했지만, 최신 패키지의 Pi 설치와 실제 아이폰·스캐너·통합 배출 확인은 아직 완료로 기록하지 않았습니다.** 이전 별도 모터 시험에서는 사용자가 실제 배출을 확인했습니다. 두 상태는 다릅니다.

## 확정된 요구사항

- 결제·카드·현금 처리 없이 무료 배출.
- 휴대폰은 별도 앱 설치 없이 같은 공유기의 웹사이트 사용.
- QR은 `id,n,a,g,h,w,s,al,c,ag,m` 11개 필드만 전달.
- `c`, `ag`, `m`은 각각 숫자 하나. 해당 없음은 0.
- QR에 시간·만료·type·version·발급 토큰을 넣지 않음. 서버 QR 발급/조회도 사용하지 않음.
- 회원 인증/건강정보 저장/상품·재고·이용내역은 Supabase 사용.
- 한 번에 총 5개까지. 연결이 확인된 두 모터만 활성화.
- 모터 작동 시간은 사용자가 나중에 설정. 현재 시험값은 500ms.

## 구성

| 경로 | 역할 |
|---|---|
| `health-app-web/` | React/Vite 휴대폰 웹, Supabase Auth, 본인 건강정보, QR, 이용내역 |
| `frontend/` | React 키오스크, QR 직접 해석, 추천, 장바구니, 무료 배출 확인 |
| `pi_gateway/` | Python/serial/SQLite, 기기 인증, 재고 예약, Mega 명령, 결과 확정·복구 |
| `deployment/` | 패키징·설치·기기 설정 예제 |
| `frontend/supabase/`, `health-app-web/supabase/` | SQL 적용 기록. 기존 DB에 무작정 재실행하지 않음 |

## 개발 실행

Node 22.12 이상을 권장합니다. 각 앱의 공개 설정을 담은 `.env`가 포함돼 있습니다. 다른 프로젝트를 사용하면 `.env.example`을 참고해 URL·공개 키를 바꿉니다. secret/service_role 키를 프런트엔드에 넣지 않습니다.

```bash
cd health-app-web
npm ci
npm run dev -- --host 0.0.0.0
```

다른 터미널:

```bash
cd frontend
npm ci --legacy-peer-deps
npm start
```

개발 서버 주소는 휴대폰 웹 3001, 키오스크 3000입니다. `npm start`만으로는 실제 배출할 수 없습니다. 실제 배출은 기기 인증 설정을 가진 Pi gateway가 제공하는 `http://localhost:3000`에서 실행합니다.

## 확인한 검증

- 모바일 lint/build, 키오스크 build 성공.
- 통합 테스트 29개, React 6개, Python 가상 모터/HTTP 8개 통과.
- 사용자 예시의 11개 필드 JSON → QR PNG → 별도 해독기 → 키오스크 계산 형식 왕복 검증.
- 실제 DB의 무료 배출·재고·회원 내역·중복 방지 시험은 변경을 롤백했고, 실 모터는 구동하지 않았습니다.

```bash
cd health-app-web
npm run lint
npm run test:integration
npm run build
cd ../frontend
CI=true npm test -- --watchAll=false --runInBand
npm run build
cd ../pi_gateway
python3 test_gateway.py
```

실제 운영 전 확인할 항목은 [STATUS.md](STATUS.md)를 기준으로 합니다. `PROJECT_ANALYSIS.md`와 이전 변경 기록은 역사 자료입니다.

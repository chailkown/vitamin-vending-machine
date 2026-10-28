# 휴대폰 건강정보 웹

최신 현황은 [STATUS.md](../STATUS.md), 확정 QR은 [QR_PROTOCOL.md](../QR_PROTOCOL.md), 배포는 [deployment/README.md](../deployment/README.md)를 참고합니다.

- Supabase Auth 이메일 가입/인증/로그인과 본인 건강정보 저장·복원.
- 기저질환·알레르기·복용 약물은 각각 한 가지 선택. 이전 복수 저장값은 임의 절삭 없이 재선택 안내.
- QR은 id,n,a,g,h,w,s,al,c,ag,m만 사용하며 c/ag/m은 단일 숫자. 시간·만료·서버 발급/조회 없음.
- PNG 표시/이미지 저장. QR은 같은 입력이면 동일하고, 정보를 수정해도 이전 이미지를 시간으로 차단하지 않음.
- 무료 배출 이용내역 조회. 결제 수단/PG는 사용하지 않음.

이메일 링크를 열기 어려우면 로그인 화면의 안내를 펼쳐 아직 사용하지 않은 이 프로젝트 인증 링크를 붙여넣습니다. 이미 인증했다면 로그인합니다.

Node22.12+에서 `.env.example` → `.env` 설정 후 `npm ci`, `npm run dev -- --host 0.0.0.0`. 검증은 `npm run lint`, `npm run test:integration`, `npm run build`.

Pi 패키지는 미리 빌드하므로 Pi에서 Vite/npm을 설치하지 않아도 됩니다. 실제 아이폰/이메일/스캐너 현장 확인은 별도로 남아 있습니다.

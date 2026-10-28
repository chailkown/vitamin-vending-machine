# 휴대폰 건강정보 웹

이메일+비밀번호로 Supabase Auth 가입/인증/로그인, 본인 건강정보 DB 저장/조회, 서버 발급 회원 QR, 본인 무료 배출 이용내역을 제공합니다.

QR 이미지에는 이름·건강정보 대신 vitamin-token v1 난수 코드만 들어갑니다. 서버에서 저장한 프로필과 연결합니다. 새 QR 발급 또는 건강정보 저장 후 이전 QR은 무효입니다. 원본 JSON v2 변환 코드는 키오스크의 프로필 해석과 호환 검증에 사용합니다. 예전 로컬 임시 계정은 이메일로 새 가입해야 합니다.

인증 메일 링크를 사용할 수 없으면 로그인 화면의 안내를 펼쳐 아직 사용하지 않은 인증 링크를 직접 붙여넣을 수 있습니다. 이미 인증했으면 원래 앱 화면에서 로그인합니다.

DB는 member_health_profiles 본인 전용 RLS, 이용내역은 orders.member_user_id로 연결합니다. 비밀번호는 일반 테이블이나 로컬 계정 목록에 저장하지 않습니다. QR 발급 요청은 순서대로 처리하여 이전 발급 응답이 새 코드를 덮어쓰지 않습니다.

개발: .env에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 공개 키 설정. npm ci 후 npm run dev -- --host 0.0.0.0. 검증은 npm run lint, npm run test:integration, npm run build. Pi 배포는 프로젝트 pi_gateway/README.md와 최신 free_vending_update 패키지를 사용합니다.

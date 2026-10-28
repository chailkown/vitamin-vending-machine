# 영양제 무료 배출 시스템

결제 기능 없이 회원 건강정보와 QR을 사용해 영양제를 선택·배출합니다.

- health-app-web: 이메일 가입/인증/로그인, 건강정보 Supabase 저장, 서버 발급 회원 QR, 본인 이용내역.
- frontend: 직접 선택 또는 QR 맞춤 추천, 무료 배출 확인 화면. 금액/결제 수단을 표시하지 않습니다.
- pi_gateway: Pi에서 기기 인증 → DB 재고 예약 → Mega 명령 → DB 결과 확정을 처리합니다. 미확정 주문은 SQLite journal에 보존하여 재실행하지 않습니다.

현재 모터 연결은 ID3 비타민 C=슬롯1/D3, ID5 비타민 D3=슬롯2/D4입니다. 나머지 제품은 모터 연결 준비 중으로 비활성화합니다. 한 번에 최대5개. 모터 시간은 설정 파일에서 나중에 변경합니다.

실행·서비스 설치·장애 복구는 pi_gateway/README.md를 참고하세요. 준비된 free_vending_update 패키지는 빌드된 두 웹과 Python 서버를 포함하므로 Pi에서 npm 설치가 필요 없습니다. Pi 화면 localhost:3000, 같은 공유기 휴대폰은 Pi주소:3001로 사용합니다.

현재 Supabase DB에는 회원 전용 RLS와 서버 발급 QR/기기 인증/무료 배출 SQL이 이미 적용되어 있습니다. DB 기록용 SQL은 frontend/supabase/free_vending_schema.sql입니다. 기존 DB에 seed.sql이나 과거 주문/회원 데모 SQL을 재실행하면 실제 재고나 권한이 바뀔 수 있으므로 설치 스크립트는 SQL을 재실행하지 않습니다. 임시 app_users 계정 대신 Supabase Auth 회원을 사용합니다.

QR에는 건강정보를 넣지 않고 난수 코드만 전달하며 서버에서 원본을 확인합니다. 새로 발급하거나 건강정보를 바꾸면 이전 코드는 폐기됩니다. 사용자 UUID를 브라우저가 임의로 지정해 주문 명의를 바꿀 수 없습니다. 기기 비밀키는 Pi의 device.json에 두며 소스 Git이나 웹 파일에 넣지 않습니다.

자동 시험: health-app-web에서 npm run lint, npm run test:integration. frontend에서 CI=true npm test -- --watchAll=false --runInBand. pi_gateway에서 python3 test_gateway.py. 실제 이메일/아이폰/스캐너/모터의 마지막 확인은 설치된 Pi에서 진행합니다. 센서가 없으므로 완료는 출력 명령 종료 확인입니다.

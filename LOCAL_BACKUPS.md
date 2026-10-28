# 로컬 설정·소스 백업 업로드 기록

2026-10-28 사용자 요청으로 다음 로컬 파일을 Git에 추가했습니다.

## 환경파일

- `frontend/.env`
- `health-app-web/.env`

업로드 시 확인한 내용은 Supabase 프로젝트 URL·브라우저용 publishable 공개 키·샘플 fallback 설정입니다. secret/service_role 키나 기기 제어 비밀키는 포함하지 않았습니다. 현재 두 파일을 명시적으로 추가했으며 `.gitignore`의 일반 환경파일 제외 규칙은 유지합니다.

## 소스 백업

- `compact-qr-backup-20261028-220056/`
- `free-vending-backup-20261028-214823/`
- `frontend/kiosk-ui-backup-20261027-223206/`
- `frontend/kiosk-width-backup-20261028-204035/`
- `health-app-web/member-backup-20261028-205830/`
- `qr-review-backup-20261028-210923/`

수정 직전의 코드·문서 사본입니다. 과거 결제/서버 QR/복수 선택 설명이 들어 있을 수 있으며, 현재 규격이나 실행 코드가 아닙니다. 최신 기준은 STATUS.md와 QR_PROTOCOL.md입니다. 백업 폴더를 현재 소스 위에 복사하거나 그 안의 구형 SQL을 실행하지 않습니다.

Pi의 device.json, SQLite 실행 journal, 인증 토큰과 패키지 내부 기기 설정은 이번 업로드에 포함하지 않았습니다.

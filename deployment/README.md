# Pi 배포와 현재 적용 상태

최신 코드·DB와 최신 Pi 런타임 설치는 별도입니다. **최신 패키지의 Pi 설치/통합 실물 검증은 아직 완료하지 않았습니다.** 현재 서비스는 같은 공유기에서 사용하는 구성이고 외부 도메인은 필요하지 않습니다.

## 기존에 준비한 로컬 패키지 사용

현재 작업 컴퓨터의 `outputs/free_vending_update`에는 두 웹 빌드·Python 서버·해당 기기의 비밀 설정이 준비돼 있습니다. 이 폴더 자체는 Git에 올리지 않습니다.

Windows CMD에서 해당 폴더를 SCP로 Pi 홈에 전송한 뒤 Pi SSH 창에서:

```bash
bash ~/free_vending_update/install.sh
```

먼저 기존 3000/3001 웹과 9000 모터 시험 서버 실행 창을 종료합니다. 9000은 USB를 점유합니다. python3-serial, dialout 권한이 필요하며 설치 스크립트가 확인합니다. DB SQL은 자동 재실행하지 않습니다.

실행 위치는 `~/.local/share/vitamin-vending`입니다. 설치는 기존 device.json과 journal을 보존합니다.

- Pi 화면: `http://localhost:3000/`.
- 아이폰 같은 Wi-Fi: `http://현재Pi주소:3001/`.
- 마지막 주소는 `.124`였으나 DHCP가 바뀔 수 있으므로 `hostname -I` 확인.
- Windows/휴대폰의 원격 모터 제어는 기본 차단. 실제 배출은 Pi localhost 화면에서 실행.

## Git에서 패키지 다시 만들기

두 앱의 `.env`에 같은 프로젝트의 공개 설정을 넣고 개발 컴퓨터에서 빌드합니다. Node22.12+와 Python3가 필요합니다.

```bash
cd health-app-web
npm ci
npm run build
cd ../frontend
npm ci --legacy-peer-deps
npm run build
cd ..
python3 deployment/package.py --device-config /private/path/device.json
```

결과는 Git 무시 경로 `.deploy/free_vending_update/`입니다. 이를 Pi 홈으로 전송하고 `install.sh` 실행. 기기 설정은 `deployment/device.example.json`을 참고하되 예제는 실행 가능한 인증값이 아닙니다. 기존 기기의 비밀 설정은 별도 로컬 패키지 또는 설치된 Pi에 보관되어 있으며 Git에서 복원되지 않습니다. 새 기기는 DB에 인증값의 해시와 허용 슬롯을 등록해야 합니다. 등록 권한을 웹에 부여하지 않습니다.

## 자동 시작·상태·시간

사용자 systemd 서비스와 그래픽 로그인 시 브라우저 시작 항목을 설치합니다. 로그인 전에도 서버를 켜려면 Pi에서 `sudo loginctl enable-linger "$USER"`를 실행합니다. 그래픽 자동 로그인 설정 자체를 바꾸지는 않습니다.

```bash
systemctl --user status vitamin-kiosk vitamin-mobile --no-pager
journalctl --user -u vitamin-kiosk -n 30 --no-pager
curl http://localhost:3000/api/health
bash ~/.local/share/vitamin-vending/pi/open_kiosk.sh
```

모터 시간은 사용자가 나중에 설정하기로 했습니다. 다음 명령은 모터를 돌리지 않고 설정만 바꾸며, 숫자는 실측 후 지정합니다.

```bash
python3 ~/.local/share/vitamin-vending/pi/set_runtime.py --slot 1 --ms 500
systemctl --user restart vitamin-kiosk
```

장애 복구와 미확정 기록 처리: [HARDWARE.md](../frontend/HARDWARE.md). 기기 비밀 설정·SQLite journal·로컬 백업은 Git에서 제외합니다.

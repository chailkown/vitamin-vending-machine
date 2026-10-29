> 2026-10-28 추가: 사용자 요청으로 현재 공개 설정만 담긴 두 `.env`와 소스 백업 6개를 Git에 포함했습니다. 범위와 구분은 [LOCAL_BACKUPS.md](../LOCAL_BACKUPS.md)를 참고하세요. 기기 인증키·실행 journal은 포함하지 않습니다.

# Pi 배포와 현재 적용 상태

2026-10-29 최신 묶음은 `.deploy/connected-20261029.zip`이다. [설치·집에서 시험 순서](../HOME_TEST_2026-10-29.md)를 우선한다. 구매내역 연결 DB는 이미 적용했고, Pi에는 이 묶음의 서버와 두 웹을 함께 설치해야 한다.

최신 코드·DB와 최신 Pi 런타임 설치는 별도입니다. **최신 패키지의 Pi 설치/통합 실물 검증은 아직 완료하지 않았습니다.** 현재 서비스는 같은 공유기에서 사용하는 구성이고 외부 도메인은 필요하지 않습니다.

## 기존에 준비한 로컬 패키지 사용

2026-10-29 최신 업데이트는 `.deploy/connected-20261029/`와 같은 이름의 zip입니다. 두 웹 빌드·Python 서버·20모터/DHT22 펌웨어를 포함합니다. 이 로컬 묶음은 Git에 없으므로 다른 PC에서는 아래 명령으로 다시 만듭니다. 비밀 설정은 포함하지 않으며 설치된 Pi의 기존 device.json을 사용합니다. 전체 안내: [소프트웨어 인계](../SOFTWARE_HANDOFF.md).

Windows CMD에서 해당 폴더를 SCP로 Pi 홈에 전송한 뒤 Pi SSH 창에서:

```bash
bash ~/connected-20261029/install.sh
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
python3 deployment/package.py --output .deploy/my-update
```

결과를 Pi 홈으로 전송하고 `install.sh` 실행. 출력 폴더는 비어 있어야 합니다. 기존 기기 인증과 교정값/journal을 보존하고 빠진 모터 시간은 500ms로 채웁니다. 최초 설치라면 `--device-config /private/path/device.json`으로 발급된 인증 설정을 포함할 수 있습니다. 이 경우 패키지를 공개하지 않습니다. 예제 JSON은 실제 인증값이 아닙니다. 새 기기 등록은 별도 관리자 작업입니다.

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

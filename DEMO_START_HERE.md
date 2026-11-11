# 새 노트북에서 졸업작품 시연 준비

최신 기준: 2026-11-11. 이 문서와 루트 `AGENTS.md`가 새 Codex 세션의 시작점이다. 10월 문서의 패키지 이름·미완료 표시는 이전 기록이다.

## Codex에게 전달할 문장

> https://github.com/chailkown/vitamin-vending-machine 의 최신 main을 가져와. 기존 작업 폴더가 있으면 변경사항부터 확인해서 보존해. 루트 AGENTS.md와 DEMO_START_HERE.md를 읽고 이 노트북을 졸업작품 시연용으로 세팅해줘. 기존 UI와 기능은 바꾸지 말고 의존성 설치, 테스트, 두 웹 빌드, Pi 업데이트 묶음 생성, 노트북 모바일 서버 실행까지 진행해. Pi 연결에 필요한 정보만 물어보고, 기존 기기 인증·재고·모터 교정 시간은 보존해. 실제 장비가 연결되지 않았으면 배포와 실물 시험은 남은 항목으로 알려줘.

Pi를 연결한 뒤 이어서:

> Pi 주소는 [현장 IPv4], SSH 계정은 [실제 계정]이야. 기존 런타임을 백업하고 새 묶음을 설치해서 키오스크를 띄워줘. Mega 펌웨어가 이번 AND 조건 버전인지 확인하고 필요한 업로드를 안내해. 모터 배출 시험은 내가 준비됐다고 하면 진행해.

`[현장 IPv4]` 등을 실제 값으로 바꾼다. SSH 비밀번호·기기 토큰은 채팅에 붙여 넣지 않는다. 로그인은 SSH 프롬프트나 기존 키 인증을 사용한다.

## 어디서 무엇을 실행하는가

| 장치 | 실행 역할 | 주소/연결 |
|---|---|---|
| 노트북 | 휴대폰 웹 서버 | `http://노트북IPv4:3001/` |
| Raspberry Pi | Python gateway, 키오스크 | 터치스크린 `http://localhost:3000/` |
| Arduino Mega | 모터·DHT22·팬 | Pi USB serial, 서버 없음 |
| QR 스캐너 | 키보드 형태 입력 | Pi USB, QR 스캔 대기 중 입력 |
| Supabase | 회원·건강정보·재고·이력·쿨러 기준 | 인터넷 API |

휴대폰과 노트북은 같은 LAN에서 서로 통신할 수 있어야 한다. Pi와 노트북도 SSH를 위해 같은 LAN에 연결한다. Supabase 접근에는 인터넷이 필요하다. 게스트 Wi-Fi의 기기 간 격리가 켜져 있으면 같은 Wi-Fi여도 접속이 안 될 수 있다.

## 1. 노트북 준비 (하드웨어 없이 가능)

Git, Node.js 22.12 이상 LTS, Python 3.10 이상을 준비한다. 도구가 없으면 Codex가 OS에 맞게 설치를 진행하거나 설치 위치를 확인한다. Windows OpenSSH 클라이언트도 SSH/SCP 단계에서 필요하다. 설치 뒤 새 터미널에서 버전을 확인한다.

```powershell
git clone https://github.com/chailkown/vitamin-vending-machine.git
cd vitamin-vending-machine
powershell -NoProfile -ExecutionPolicy Bypass -File deployment/prepare_demo.ps1
```

이미 저장소가 있으면 새로 복제하거나 덮어쓰지 말고 `git status` 확인 → 변경 보존 → `git pull --ff-only` 순으로 진행한다. 충돌이나 로컬 변경은 보존해서 해결한다.

준비 스크립트는 공개 환경변수 검사, lockfile 기반 npm 설치, 두 웹 빌드, 모바일 lint/통합 테스트, React 테스트, Python 가상 장치 테스트, `.deploy/demo-날짜-시간` 묶음 생성을 수행한다. 실제 Pi에 접속하거나 모터를 돌리지 않는다.

- 도구/공개 설정 검사만: `... -File deployment/prepare_demo.ps1 -CheckOnly`
- 이미 설치된 의존성 재사용: `... -File deployment/prepare_demo.ps1 -SkipInstall`
- `.env`는 두 앱의 기존 추적 파일을 사용한다. 공개 URL/anon 또는 publishable key만 들어가야 한다. `.env.local` 등 덮어쓰기 파일이 있으면 먼저 검사하도록 중단한다.
- 기존 DB를 유지한다. 마이그레이션·seed를 전부 다시 실행하지 않는다.

## 2. 노트북 모바일 서버

저장소 루트에서 실행:

```powershell
py -3 deployment/serve_mobile_lan.py --directory health-app-web/dist --port 3001
```

`py`가 없다면 `python`을 사용한다. 별도 창/백그라운드 프로세스로 유지하고 Codex는 PID와 로그 위치를 기록한다. 백그라운드 실행 시 Windows 창을 숨긴다. `/` HTTP 200 응답을 확인한 뒤 `ipconfig`의 실제 Wi-Fi IPv4로 접속 주소를 안내한다. VPN/가상 어댑터 IP를 선택하지 않는다. 포트 충돌이 있으면 점유 프로그램을 먼저 확인한다.

휴대폰은 `http://노트북IPv4:3001/`. 외부 접속이 막히면 개인 네트워크 TCP 3001을 허용한다. 필요할 때 관리자 PowerShell에서 아래처럼 해당 포트와 로컬 서브넷만 허용한다. 모든 인바운드를 열거나 방화벽을 끄지 않는다.

```powershell
New-NetFirewallRule -DisplayName 'Vitamin mobile demo 3001' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3001 -Profile Private -RemoteAddress LocalSubnet
```

이미 동일 규칙이 있으면 중복 생성하지 않는다. 카카오 지도는 JavaScript 키와 현재 웹 접속 주소의 허용 도메인을 별도 확인한다. 카카오 Admin 키를 브라우저에 넣지 않는다. 지도 설정이 없어도 QR·회원·재고 테스트와 구분해서 보고한다.

## 3. Pi 연결·백업·업데이트

Pi 터치스크린에서 Wi-Fi 연결 → 터미널 `hostname -I` → 현재 IP 확인. SSH 계정은 기존 실제 계정을 사용한다. `pi`라고 가정하지 않는다.

```powershell
ssh 계정@PI_IP
```

SSH 안에서 먼저 확인한다. 인증 파일 내용은 출력하지 않는다.

```bash
test -f ~/.local/share/vitamin-vending/pi/device.json && echo '기존 기기 설정 있음'
ls /dev/serial/by-id/
python3 -c 'import serial; print("pyserial 준비됨")'
systemctl --user status vitamin-kiosk --no-pager
```

serial 모듈이 없으면 `sudo apt install -y python3-serial`, 권한이 없으면 `sudo usermod -aG dialout "$USER"` 후 다시 로그인한다. 기존 시험 서버가 USB를 점유하면 소유 프로세스를 확인해 종료한다. SSH 안에서만 실행할 명령과 노트북 명령을 구분한다.

노트북에서 출력된 묶음 경로를 SCP로 복사한다. 아래 `demo-날짜-시간`은 실제 생성된 폴더명이다.

```powershell
scp -r .deploy/demo-날짜-시간 계정@PI_IP:~/
ssh 계정@PI_IP
```

다음은 Pi SSH 안에서 실행:

```bash
bash ~/demo-날짜-시간/install.sh
systemctl --user status vitamin-kiosk --no-pager
curl http://localhost:3000/api/health
bash ~/.local/share/vitamin-vending/pi/open_kiosk.sh
```

설치 스크립트는 기존 런타임을 비공개 tar 백업하고 기존 `device.json`, `fan-settings.json`, journal 및 모터 시간을 보존한다. 누락된 슬롯 시간만 기존 정책대로 500ms를 채우므로 교정 누락은 실물 시험 전에 확인한다. 기본값은 Pi 키오스크만 실행하며 이전 Pi 모바일 서비스는 끈다. 모바일까지 Pi에서 제공할 때만 `install.sh --with-mobile`을 명시한다.

현재 브라우저 실행기는 Raspberry Pi OS Wayland + Chromium 기준이다. SSH로 브라우저가 안 뜨면 그래픽 로그인 세션·Wayland 소켓·Chromium 설치를 확인한다. X11이라면 환경에 맞는 실행 명령을 사용하고 화면이 실제로 보이는지 사용자에게 확인한다. 자동 로그인 설정 자체는 이 스크립트가 바꾸지 않는다.

기기 인증이 없으면 예제 JSON을 복사해 성공으로 처리하지 않는다. 기존 Pi/비공개 백업에서 복구하거나 별도 등록이 필요하다. 인증값·journal·백업 묶음은 공개 Git에 올리지 않는다.

## 4. Mega와 팬

이번 소스의 팬 켜짐 조건은 온도 AND 습도다. 기존 Mega가 OR 버전이면 `firmware/firmware.ino`를 Mega 2560에 새로 업로드해야 한다. DHT22(D2), 팬(D23), 모터 핀은 `ARDUINO_WIRING.md`와 `firmware/mega_pin_map.h`를 확인한다.

Arduino IDE/CLI의 AVR Mega 2560 보드 및 DHT sensor library/Adafruit Unified Sensor 의존성이 필요하다. 업로드 전 Pi gateway를 멈춰 USB를 해제하고 업로드 뒤 재시작한다. 세팅만으로 업로드 완료라고 기록하지 않는다. Arduino만 재부팅한 경우에도 Pi 서비스를 재시작해 FANCFG 기준을 재전달한다.

모바일 저장 → Supabase → Pi 약 30초 조회 → USB FANCFG → Arduino 자율 제어. DB 연결 실패 시 마지막 적용 기준 유지. 현재 실제 자판기 매핑과 fan 설정 마이그레이션은 원격 적용 완료이며 최초 기준은 30°C/70%였다. 현장에서는 현재 DB 값을 확인하고 임의로 초기화하지 않는다.

## 5. 오늘 밤 확인 체크리스트

1. 노트북 모바일 `/` HTTP 200 및 휴대폰 실제 접속.
2. 신규 회원가입·재로그인 → 건강정보 저장 → QR 표시.
3. Pi 키오스크 상황 선택 → QR 대기 → USB 스캔 → 이름/핵심 이유/펼침 확인.
4. 사용자가 준비된 뒤 일반 구매·QR 구매 → 실제 배출 → 재고·구매 이력.
5. 모바일 관리자 쿨러 기준 저장 → 다음 Pi 조회 반영 → 두 조건 동시 충족 시 팬 ON. 하나만 충족 시 OFF 상태에서 새로 켜지지 않는지 확인. 이미 켜진 팬은 온도 -2°C 또는 습도 -5%p에서 꺼지는 이력 조건이 있다.
6. 별도 SSH 창에서 `python3 ~/.local/share/vitamin-vending/pi/watch_environment.py` 실행 → 3초 간격 값 표시. ON 표시는 제어 출력이며 회전 센서 값은 아니다.
7. 재부팅 후 서비스/키오스크/기준값 복구, 이동 후 20모터 재확인.

## 준비 완료 판단

2026-11-11 개발 PC에서 모바일 통합 34개, React 34개, Python 18개 테스트와 두 웹 빌드/lint를 확인했다. 이는 실제 현장 통합 시험 결과가 아니다. 새 노트북에서 스크립트를 재실행해 재현 결과를 기록한다.

Codex의 최종 보고에는 준비한 커밋, 생성 묶음 경로, 모바일 PID/접속 주소, Pi 서비스 상태, Mega 업로드 여부, 실물 시험 미완료 항목을 적는다. 기능을 더 만드는 작업보다 위 항목을 끝내는 것이 우선이다.

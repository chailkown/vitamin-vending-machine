# 결제 없는 영양제 배출 시스템

이 패키지가 최신입니다. 이전 mobile_member_update/kiosk_ui_update 대신 사용합니다.

## 완성한 흐름
휴대폰 이메일 가입·인증·로그인 → 건강정보 DB 저장 → 서버 발급 QR → Pi 스캐너 → 추천 또는 상품 선택 → 무료 배출 → 재고 차감·본인 이용내역.
QR은 난수 코드만 담고 이름/질환/약물 정보는 담지 않습니다. QR을 새로 발급하거나 건강정보를 수정하면 이전 코드는 무효입니다. 생성된 코드는 재발급/수정 전까지 시간 제한 없이 재사용합니다. 인터넷 연결이 필요합니다.
회원 UUID는 서버가 확인하며, 브라우저가 전송한 회원번호를 주문 명의로 사용하지 않습니다. 이전 임시 app_users 자료는 보존하고 새 Auth 회원 기록은 orders.member_user_id로 구분합니다. 금액은 0, payment_method는 free로 기록하며 결제 수단 UI는 제거했습니다.

## 현재 연결
- 비타민 C / Doctor's Best Quali-C (ID3): 슬롯1, Mega D3.
- 비타민 D3 / Swanson (ID5): 슬롯2, Mega D4.
- 그 외 상품은 표시하되 모터 연결 준비 중으로 배출 버튼을 비활성화합니다. 배선 확인 없이 임의로 활성화하지 않습니다.
- 한 번에 합계 5개까지. 현재 시간은 기존 시험값 500ms이며 사용자가 나중에 설정할 예정입니다.
- 실제 재고 수량은 임의로 초기화하지 않았습니다. 설치 때 seed.sql을 실행하지 않습니다.

## 설치 (최초 한 번)
기존 3000 키오스크 npm 서버, 3001 휴대폰 웹, 9000 모터 시험 서버가 실행 중이면 각 실행 창에서 Ctrl+C로 종료합니다. 9000은 USB를 점유하므로 반드시 종료합니다.

Windows CMD에서:
```cmd
scp -r "C:\Users\RC241108\Documents\Codex\2026-10-24\referenced-chatgpt-conversation-this-is-an\outputs\free_vending_update" pi@192.168.45.124:/home/pi/
ssh pi@192.168.45.124
```
Pi SSH 창에서:
```bash
bash ~/free_vending_update/install.sh
```
설치 폴더는 ~/.local/share/vitamin-vending 입니다. Pi에서 npm/Vite 설치 없이 실행합니다. DB 설정은 이미 적용했으므로 포함된 SQL을 다시 실행하지 않습니다.

Pi 터치스크린: http://localhost:3000/ (기존 화면 Ctrl+Shift+R)
아이폰 같은 Wi-Fi: http://현재Pi주소:3001/ (예: http://192.168.45.124:3001/)
무료 배출 버튼은 Pi의 localhost 화면에서만 동작합니다. Windows/휴대폰에서 3000 화면을 볼 수 있어도 원격 모터 작동은 차단합니다.
키오스크 새 창이 필요하면 Pi SSH 창에서:
```bash
bash ~/.local/share/vitamin-vending/pi/open_kiosk.sh
```
두 서비스는 systemd 사용자 서비스로 등록됩니다. 그래픽 로그인 시 키오스크 브라우저도 자동 시작합니다. 부팅 후 SSH 로그인 전에도 서버가 실행되게 하려면:
```bash
sudo loginctl enable-linger "$USER"
```

## 이메일 인증
이메일 인증 링크를 누른 후 원래 웹으로 돌아와 로그인합니다. 아직 누르지 않은 메일 링크가 localhost로 이동해 막힐 우려가 있으면 로그인 화면의 '이메일 인증 후 화면이 열리지 않나요?'를 펼치고 링크를 붙여넣어 이 화면에서 인증합니다. 이미 인증된 링크는 다시 사용할 수 없으므로 로그인합니다. 실제 이메일은 사용자에게만 입력받습니다.

## 스캐너
Pi 키오스크 맞춤형 추천 → 항목 → 세부 상황 → QR 입력칸을 선택한 뒤 아이폰 QR을 읽습니다. HID 키보드/Enter 및 영문 모드로 사용합니다. 새 QR은 영문 ASCII 110여 글자로 짧아졌습니다. 서버가 QR을 확인한 뒤 건강정보를 반영합니다. 일반 직접 선택은 익명 이용이며, 회원 이용내역에 남기려면 QR 경로로 진행합니다.

## 나중에 작동 시간 변경
다음 명령은 모터를 돌리지 않고 설정만 바꿉니다. 숫자는 실제 측정 후 지정하세요.
```bash
python3 ~/.local/share/vitamin-vending/pi/set_runtime.py --slot 1 --ms 500
python3 ~/.local/share/vitamin-vending/pi/set_runtime.py --slot 2 --ms 500
systemctl --user restart vitamin-kiosk
```
다시 설치해도 기존 device.json과 journal.sqlite3를 보존합니다.

## 상태와 장애 확인
```bash
systemctl --user status vitamin-kiosk vitamin-mobile --no-pager
journalctl --user -u vitamin-kiosk -n 30 --no-pager
curl http://localhost:3000/api/health
```
USB 오류나 일부 배출 후 결과 불확실 시 자동 재배출/재고 복원을 하지 않고 잠급니다. journal.sqlite3를 삭제해서 잠금을 푸는 방식은 사용하지 않습니다.
실제 수령구·모터·재고를 확인한 뒤 관리자가 복구합니다:
```bash
systemctl --user stop vitamin-kiosk
python3 ~/.local/share/vitamin-vending/pi/recover.py
```
위 명령이 출력한 request UUID를 사용합니다. 전부 배출됐으면 --outcome completed, 한 개도 배출되지 않았으면 failed입니다. 일부만 배출된 경우에는 확정하지 말고 수동 재고 정산이 필요합니다.
```bash
python3 ~/.local/share/vitamin-vending/pi/recover.py --request 실제UUID --outcome completed --confirmed
systemctl --user start vitamin-kiosk
```
확정 후 키오스크에서 다시 누르면 이전 결과만 조회하고 잠금을 풉니다. 그 클릭으로 새 모터 명령을 실행하지 않습니다.

## 검증과 현장 확인
- 통합 테스트30개, 키오스크 React6개, 가상 모터/HTTP 서버8개 통과 (총44개).
- 실제 DB에서 QR 검증·폐기, 기기 인증, 무료 기록, 회원 이용내역, 중복 방지 시험 통과. 시험 재고·주문은 모두 롤백.
- 실제 HTTPS API에서 기기 인증/주문 조회 성공 (조회만 수행).
- 모바일 lint/build, 키오스크 build, 설치/시작 Bash 문법 검사 및 Python compile 통과.
- 로컬 가상 모터 브라우저에서 무료 선택 → 확인 → 완료 흐름 확인. 실제 모터 실행은 하지 않았습니다.
- Pi 직접 배포는 SSH 비밀번호 인증이 필요해 수행하지 못했습니다. 위 설치 명령 후 실제 이메일 가입·아이폰·스캐너·두 모터의 최종 확인이 필요합니다.
- 센서가 없으므로 '완료'는 Arduino 출력 명령 종료 확인이며 실제 낙하 감지는 아닙니다. 작동 시간은 사용자 요청대로 나중에 설정합니다.

pi/device.json은 이 기기의 배출 권한이 있는 설정이므로 웹 공개 폴더 밖에 보관합니다. 서버는 이 값을 브라우저로 보내지 않습니다.

#!/usr/bin/env bash
set -euo pipefail
bundle="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
runtime="$HOME/.local/share/vitamin-vending"
python3 -c 'import serial' || { echo '먼저 sudo apt install -y python3-serial 를 실행하세요.'; exit 1; }
if ! id -nG | tr ' ' '\n' | grep -qx dialout; then echo 'sudo usermod -aG dialout "$USER" 실행 후 SSH를 종료하고 다시 접속하세요.'; exit 1; fi
systemctl --user stop vitamin-kiosk vitamin-mobile 2>/dev/null || true
python3 - <<'PY'
import socket
for port in (3000,3001):
 s=socket.socket()
 try:s.bind(('0.0.0.0',port))
 except OSError:raise SystemExit(f'{port} 포트를 사용하는 기존 npm/시험 웹 창에서 Ctrl+C를 눌러 종료한 뒤 다시 실행하세요.')
 finally:s.close()
PY
mkdir -p "$runtime/pi/kiosk" "$runtime/mobile" "$HOME/.config/systemd/user"
chmod 700 "$runtime" "$runtime/pi"
if test -f "$runtime/pi/device.json"; then
 python3 - "$runtime/pi/device.json" "$bundle/pi/device.json" <<'PY'
import json,sys
old,new=(json.load(open(path)) for path in sys.argv[1:])
if old['device_id']!=new['device_id'] or old['device_token']!=new['device_token']:raise SystemExit('기존 기기 인증이 다릅니다. 설정을 덮어쓰지 않습니다.')
PY
else cp "$bundle/pi/device.json" "$runtime/pi/device.json"; fi
chmod 600 "$runtime/pi/device.json"
for file in server.py recover.py test_gateway.py open_kiosk.sh set_runtime.py; do cp "$bundle/pi/$file" "$runtime/pi/$file"; done
cp -R "$bundle/pi/kiosk/." "$runtime/pi/kiosk/"
cp -R "$bundle/mobile/." "$runtime/mobile/"
cat > "$HOME/.config/systemd/user/vitamin-kiosk.service" <<EOF
[Unit]
Description=Vitamin free dispensing kiosk
[Service]
WorkingDirectory=$runtime/pi
ExecStart=/usr/bin/python3 $runtime/pi/server.py
Restart=on-failure
RestartSec=5
UMask=0077
[Install]
WantedBy=default.target
EOF
cat > "$HOME/.config/systemd/user/vitamin-mobile.service" <<EOF
[Unit]
Description=Vitamin mobile health website
[Service]
ExecStart=/usr/bin/python3 -m http.server 3001 --bind 0.0.0.0 --directory $runtime/mobile
Restart=on-failure
RestartSec=5
[Install]
WantedBy=default.target
EOF
mkdir -p "$HOME/.config/autostart"
if test -f "$HOME/.config/autostart/vitamin-kiosk.desktop"; then cp -p "$HOME/.config/autostart/vitamin-kiosk.desktop" "$HOME/.config/autostart/vitamin-kiosk.desktop.backup-$(date +%s)"; fi
cat > "$HOME/.config/autostart/vitamin-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Vitamin free kiosk
Exec=/bin/bash $runtime/pi/open_kiosk.sh
X-GNOME-Autostart-enabled=true
EOF
systemctl --user daemon-reload
systemctl --user enable --now vitamin-mobile vitamin-kiosk
if ! python3 - <<'PY'
import time,urllib.request
for attempt in range(20):
 try:
  with urllib.request.urlopen('http://localhost:3000/api/health',timeout=1) as response:
   if response.status==200:print('Mega 연결 및 배출 서버 준비 완료');break
 except Exception:time.sleep(.5)
else:raise SystemExit('배출 서버가 준비되지 않았습니다. USB 연결과 기존 9000 시험 서버 종료 여부를 확인해주세요.')
PY
then journalctl --user -u vitamin-kiosk -n 15 --no-pager; exit 1; fi
echo '서비스 설치 완료. Pi 터치스크린: http://localhost:3000'
echo '아이폰: http://라즈베리파이현재IP:3001'
echo '재부팅 후 SSH 로그인 전에도 실행하려면: sudo loginctl enable-linger "$USER"'

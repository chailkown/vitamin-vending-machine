#!/usr/bin/env bash
set -euo pipefail
umask 0077
with_mobile=0
if [[ "${1:-}" == '--with-mobile' && $# == 1 ]]; then with_mobile=1
elif [[ $# != 0 ]]; then echo 'Usage: bash install.sh [--with-mobile]'; exit 1; fi
bundle="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
runtime="$HOME/.local/share/vitamin-vending"
existing_runtime=0
if test -d "$runtime"; then existing_runtime=1; fi
python3 -c 'import serial' || { echo '먼저 sudo apt install -y python3-serial 를 실행하세요.'; exit 1; }
if ! test -f "$runtime/pi/device.json" && ! test -f "$bundle/pi/device.json"; then
 echo '기존 Pi device.json이 없습니다. 기기 인증 설정을 먼저 준비해주세요.'; exit 1
fi
if ! id -nG | tr ' ' '\n' | grep -qx dialout; then echo 'sudo usermod -aG dialout "$USER" 실행 후 SSH를 종료하고 다시 접속하세요.'; exit 1; fi
systemctl --user stop vitamin-kiosk vitamin-mobile 2>/dev/null || true
if test -d "$runtime"; then
 backup="$HOME/.local/share/vitamin-vending-backup-$(date +%Y%m%d-%H%M%S)-$$.tar.gz"
 tar -czf "$backup" -C "$HOME/.local/share" vitamin-vending
 echo "기존 런타임 백업: $backup (기기 인증 포함, 공개 금지)"
fi
python3 - "$with_mobile" <<'PY'
import socket
import sys
for port in ((3000,3001) if sys.argv[1]=='1' else (3000,)):
 s=socket.socket()
 try:s.bind(('0.0.0.0',port))
 except OSError:raise SystemExit(f'{port} 포트를 사용하는 기존 npm/시험 웹 창에서 Ctrl+C를 눌러 종료한 뒤 다시 실행하세요.')
 finally:s.close()
PY
mkdir -p "$runtime/pi/kiosk" "$runtime/mobile" "$HOME/.config/systemd/user"
chmod 700 "$runtime" "$runtime/pi"
if test -f "$runtime/pi/device.json" && test -f "$bundle/pi/device.json"; then
 python3 - "$runtime/pi/device.json" "$bundle/pi/device.json" <<'PY'
import json,sys
old,new=(json.load(open(path)) for path in sys.argv[1:])
if old['device_id']!=new['device_id'] or old['device_token']!=new['device_token']:raise SystemExit('기존 기기 인증이 다릅니다. 설정을 덮어쓰지 않습니다.')
PY
elif ! test -f "$runtime/pi/device.json"; then cp "$bundle/pi/device.json" "$runtime/pi/device.json"; fi
chmod 600 "$runtime/pi/device.json"
python3 - "$runtime/pi/device.json" <<'PY'
import json,os,sys
from pathlib import Path
path=Path(sys.argv[1]);config=json.loads(path.read_text());durations=config.setdefault('durations',{})
for slot in range(1,21):durations.setdefault(str(slot),500)
if any(type(v) is not int or not 100<=v<=5000 for v in durations.values()):raise SystemExit('모터 시간 설정 오류')
temp=path.with_suffix('.json.tmp');temp.write_text(json.dumps(config,indent=2));temp.chmod(0o600);os.replace(temp,path)
PY
for file in server.py recover.py test_gateway.py set_runtime.py watch_environment.py; do cp "$bundle/pi/$file" "$runtime/pi/$file"; done
if ! test -f "$runtime/pi/open_kiosk.sh"; then cp "$bundle/pi/open_kiosk.sh" "$runtime/pi/open_kiosk.sh"; fi
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
if [[ "$existing_runtime" == 0 ]] && ! test -f "$HOME/.config/autostart/vitamin-kiosk.desktop"; then
 mkdir -p "$HOME/.config/autostart"
 cat > "$HOME/.config/autostart/vitamin-kiosk.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Vitamin free kiosk
Exec=/bin/bash $runtime/pi/open_kiosk.sh
X-GNOME-Autostart-enabled=true
EOF
fi
systemctl --user daemon-reload
systemctl --user enable --now vitamin-kiosk
if [[ "$with_mobile" == 1 ]]; then systemctl --user enable --now vitamin-mobile
else systemctl --user disable vitamin-mobile 2>/dev/null || true; fi
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
if [[ "$with_mobile" == 1 ]]; then echo '아이폰: http://라즈베리파이현재IP:3001'
else echo '모바일 웹은 노트북에서 실행: http://노트북현재IP:3001'; fi
echo '재부팅 후 SSH 로그인 전에도 실행하려면: sudo loginctl enable-linger "$USER"'

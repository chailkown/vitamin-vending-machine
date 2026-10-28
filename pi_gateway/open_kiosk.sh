#!/usr/bin/env bash
set -euo pipefail
python3 - <<'PY'
import time,urllib.request
for attempt in range(30):
 try:
  with urllib.request.urlopen('http://localhost:3000/api/health',timeout=1):break
 except Exception:time.sleep(1)
else:raise SystemExit('배출 서버를 먼저 확인해주세요.')
PY
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}"
if test -z "${WAYLAND_DISPLAY:-}"; then
 WAYLAND_DISPLAY="$(find "$XDG_RUNTIME_DIR" -maxdepth 1 -type s -name 'wayland-*' -printf '%f\n' | head -n 1)"
 export WAYLAND_DISPLAY
fi
exec chromium --ozone-platform=wayland --disable-gpu --user-data-dir="$HOME/.config/vitamin-free-kiosk" --kiosk --no-first-run http://localhost:3000

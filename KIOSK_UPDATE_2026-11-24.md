# 2026-11-24 키오스크 업데이트

이번 업데이트는 `frontend` 키오스크만 적용한다. 모바일 웹은 집에서 별도로 수정·배포할 예정이며 이번 커밋에 모바일 소스 변경을 포함하지 않는다. DB 마이그레이션, Arduino 업로드, Python gateway 교체는 필요 없다.

## 변경 내용

- QR 없이 상황만 선택했을 때 개인 건강정보 비교 안내 문단을 숨긴다.
- 상품 목록과 펼친 추천 설명이 사용하는 스크롤바를 24px로 넓힌다.
- 상황에 해당하는 상품을 유지하면서 알레르기 → 약물 → 질환 주의사항 순으로 정렬하는 기존 정책을 유지한다. 건강정보 때문에 구매를 차단하지 않는다. 재고·슬롯·주문 제한은 기존대로다.
- 같은 성분의 명시된 함량 비교를 QR 유무와 무관하게 적용한다. C·D·마그네슘·아연 외에 B군(B6), 오메가-3(EPA+DHA), 루테인, CoQ10, 베타글루칸을 읽는다. 비교 가능한 함량은 낮은 쪽부터 표시한다. 서로 다른 성분의 mg나 유산균 균주별 CFU는 비교하지 않는다.
- 상품별 건강정보 주의사항은 `주의:`와 굵은 글씨로 표시한다.
- 사용자가 요청한 `15mg · 비교 상품 중 낮은 함량` 같은 추가 표시는 카드와 펼친 설명 모두에서 제거했다. 내부 함량 정렬은 유지한다.
- 키·체중은 BMI 설명, 나이·성별·흡연은 기존 식사 포함 섭취기준 비교에 사용한다. 체격으로 개인 복용량을 정하지 않는다.

현재 DB 20상품의 알레르기 검증 플래그는 모두 false다. 원료가 확인되지 않은 상품을 알레르기에 안전한 상품으로 표시하지 않으며 확인 필요 경고를 유지한다.

## 노트북에서 준비 (PowerShell)

기존 저장소 루트에서 실행한다. `git status`에 작업이 있으면 먼저 보존하고 충돌을 해결한다. 강제 reset/clean을 하지 않는다.

```powershell
git status --short
git pull --ff-only origin main
cd frontend
npm ci --legacy-peer-deps
npm run build
cd ..
tar -czf kiosk-20261124.tar.gz -C frontend/build .
scp kiosk-20261124.tar.gz 계정@PI_IP:~/
```

`계정`과 `PI_IP`는 실제 SSH 계정과 현재 Pi 주소로 바꾼다. 기존 frontend 공개 환경설정을 사용한다. 새 비밀키를 추가하지 않는다. 압축 파일은 로컬 배포용이며 Git에 올리지 않는다.

## Pi에 키오스크만 적용 (SSH)

아래는 기존 설치 위치가 `~/.local/share/vitamin-vending/pi`인 경우다. 경로·서비스가 다르면 실제 실행 설정을 먼저 확인한다. 주문·배출이 진행 중이지 않을 때 적용한다.

```bash
systemctl --user cat vitamin-kiosk
test -f "$HOME/.local/share/vitamin-vending/pi/kiosk/index.html"
```

위 확인이 성공한 뒤 다음을 실행한다. 기존 전체 설치 스크립트는 모바일/서버도 복사하므로 이번에는 사용하지 않는다.

```bash
set -e
runtime="$HOME/.local/share/vitamin-vending/pi"
stamp=$(date +%Y%m%d-%H%M%S)
incoming="$HOME/kiosk-update-$stamp"
mkdir "$incoming"
tar -xzf "$HOME/kiosk-20261124.tar.gz" -C "$incoming"
test -f "$incoming/index.html"
test -f "$runtime/kiosk/index.html"
cp -a "$runtime/kiosk" "$runtime/kiosk-backup-$stamp"
systemctl --user stop vitamin-kiosk
cp -a "$incoming/." "$runtime/kiosk/"
systemctl --user start vitamin-kiosk
systemctl --user status vitamin-kiosk --no-pager
curl --fail http://localhost:3000/api/health
```

복사 오류로 중단되면 서비스를 그대로 방치하지 말고 백업에서 복원하고 다시 시작한다. `device.json`, 모터별 시간, `journal.sqlite3`, `fan-settings.json`과 모바일 폴더는 수정하지 않는다.

Pi 터치스크린 브라우저에서 Ctrl+Shift+R로 새로고침한다. 브라우저가 닫혀 있으면 다음으로 연다.

```bash
bash ~/.local/share/vitamin-vending/pi/open_kiosk.sh
```

문제가 있으면 위에서 출력/생성된 실제 백업 경로를 사용해 복구한다.

```bash
systemctl --user stop vitamin-kiosk
cp -a "$HOME/.local/share/vitamin-vending/pi/kiosk-backup-실제시각/." "$HOME/.local/share/vitamin-vending/pi/kiosk/"
systemctl --user start vitamin-kiosk
```

복구 뒤에도 브라우저를 강력 새로고침한다.

## 확인 항목과 남은 작업

- 자동 테스트: 키오스크 43개, 모바일/공통 통합 34개 통과. 모바일 테스트 실행은 모바일 배포를 의미하지 않는다.
- QR 없이 상황 선택 → 기존 개인 건강정보 비교 문단이 숨겨지는지 확인.
- QR 사용 → 이름·요약·주의사항 표시, 같은 성분 함량 정렬, 건강 경고가 있어도 장바구니 담기가 가능한지 확인.
- 스크롤바가 넓어졌고 함량 비교 추가 문구는 보이지 않는지 확인.
- 실제 Pi 배포 및 QR 스캐너·배출 테스트는 현장에서 진행해야 한다. 이 PC에서 실물 검증하지 않았다.
- 모바일의 과거 제외 선택지가 다시 나타나는 수정은 이번 커밋에서 제외했다. 집에서 모바일 작업 시 별도로 반영한다. QR 코드북과 기존 저장 건강정보는 임의로 삭제하지 않는다.

집에서 Codex에게: “최신 main을 받아 KIOSK_UPDATE_2026-11-24.md를 읽고 키오스크 frontend만 빌드해서 기존 Pi에 적용해줘. 모바일, gateway, 펌웨어, DB와 모터 설정은 유지하고 실제 배출은 내가 준비됐을 때 테스트해.”

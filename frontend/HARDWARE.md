# Pi → Mega 무료 배출

2026-10-29: **DHT22 D2 / 모터1~20 D3~D22 중 D13 대신 D24 / 환기팬 D23**. 모터11은 부팅 LED 핀을 피해 D24에 연결한다. 전체 스케치와 컴파일 검증을 완료했다. [firmware/README.md](../firmware/README.md), [전체 상품·설치 안내](../SOFTWARE_HANDOFF.md)를 참고한다. DB 20슬롯도 적용했으며 실제 배선·업로드는 현장에서 확인한다.

2026-10-29 기준. 구현은 `../pi_gateway/server.py`, 배포는 [deployment/README.md](../deployment/README.md)를 참고합니다.

## 연결

Pi 4B + Mega 2560 R3, USB CH340, 115200 baud. 새 펌웨어는 D2의 DHT22를 읽고 D23 팬을 자동 제어합니다. 외부 전원/모스펫 모듈로 모터를 구동하며 GPIO에서 모터 전원을 공급하지 않습니다.

- ID3 비타민 C → 슬롯1 → D3.
- ID5 비타민 D3 → 슬롯2 → D4.
- 활성 20상품을 슬롯1~20 → D3~D22에 배정하되 슬롯11은 D24로 옮겼습니다. 실제 배선을 맞춰주세요.
- 현재 500ms는 기존 시험값. 사용자가 나중에 교정하기로 했습니다.

## 실행 계약

Pi gateway가 정적 키오스크와 `/api/order`를 같은 origin에서 제공합니다. 브라우저에는 기기 비밀키를 주지 않습니다. Host/Origin/CSRF 검사와 localhost 제어 제한을 사용합니다. Windows/휴대폰에서 원격으로 모터를 돌리는 경로는 기본 차단합니다.

1. Pi가 기기 인증으로 `reserve_free_order` 호출: 재고 검사/예약, 무료 기록. QR 식별자·회원정보는 보내거나 연결하지 않음.
2. Mega에 `RUN 슬롯 시간` 전달 후 STARTED와 DONE 확인.
3. `finish_free_order`로 completed/failed/review_required 확정.
4. 결과 불명은 자동 재배출/재고 복원하지 않고 SQLite journal로 잠금 보존.

DB가 재고의 기준입니다. SQLite는 실행 기록이며 별도 재고 장부가 아닙니다. 브라우저를 닫거나 Pi를 재시작해도 미확정 명령을 재실행하지 않습니다.

## 시간 설정과 복구

```bash
python3 ~/.local/share/vitamin-vending/pi/set_runtime.py --slot 1 --ms 500
systemctl --user restart vitamin-kiosk
```

이 명령은 설정만 바꿉니다. 실제 측정값을 입력합니다. 범위100~5000ms, 현재 등록 슬롯만 허용합니다.

```bash
systemctl --user stop vitamin-kiosk
python3 ~/.local/share/vitamin-vending/pi/recover.py
```

수령구/재고 확인 후 출력된 request ID를 사용해 `--outcome completed --confirmed`, 또는 **하나도 배출되지 않은 경우에만** `--outcome failed --confirmed`로 확정합니다. 일부만 배출됐다면 일괄 failed로 복원하지 말고 별도 정산이 필요합니다. journal을 삭제해 잠금을 푸는 방식은 사용하지 않습니다.

센서가 없으므로 DONE/완료는 출력 종료 확인이고 실제 낙하 감지는 아닙니다. 이전 별도 9000 시험에서의 실물 성공과 최신 gateway 통합 시험은 구분합니다. 최신 통합은 현장 확인이 남아 있습니다.

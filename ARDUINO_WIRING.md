# Arduino Mega 2560 R3 배선·핀 배치

기준: 2026-10-29. 실제 업로드한 `firmware/firmware.ino`, `mega_pin_map.h`, `settings.h` 기준이다. 슬롯 번호·보드 핀 번호·DB 상품 ID는 서로 다르다. 보드에 적힌 숫자 3이 D3이다.

## 현재 확인한 상태

- 사용자 로그에서 최신 7,244바이트 펌웨어 업로드 및 플래시 검증 완료.
- `PING → PONG MOTOR20_V1`, `ENV → ENV OK 20.90 42.80 FAN 0` 확인. 온도 20.9℃, 습도 42.8%, 당시 팬 제어 OFF.
- 사용자는 현재 연결한 D3/D4 두 모터를 사용하는 구매 흐름의 모터 작동 및 구매 로그 저장을 확인했다. 각 핀별 반복 배출·수량 정확성까지 모두 검증됐다는 뜻은 아니다.
- 나머지 18모터 배선/작동, 팬의 실제 회전, 재부팅 자동 실행은 현장 확인이 남아 있다.
- 모터 시간은 기본 500ms이며 사용자가 나중에 상품별로 교정한다.

## 전체 모터 배치

각 Mega 출력은 해당 슬롯 MOSFET 모듈의 제어 신호 입력으로 연결한다.

|슬롯|Mega 핀|상품 ID|상품|
|---:|---|---:|---|
|1|D3|3|Doctor's Best Quali-C|
|2|D4|5|Swanson Vitamin D3|
|3|D5|1|Doctor's Best Fully Active B-Complex|
|4|D6|2|Solgar B-Complex 100|
|5|D7|4|Nature Made Vitamin C|
|6|D8|6|NOW Foods Vitamin D3|
|7|D9|7|Life Extension Magnesium Citrate|
|8|D10|8|Doctor's Best High Absorption Magnesium|
|9|D11|9|Sports Research Triple Strength Omega-3|
|10|D12|10|NOW Foods Omega-3|
|11|D24|11|Doctor's Best High Absorption CoQ10|
|12|D14|12|Qunol Ubiquinol|
|13|D15|13|California Gold Nutrition Lutein Plus|
|14|D16|14|Doctor's Best Lutein with Zeaxanthin|
|15|D17|15|Jarrow Dophilus EPS|
|16|D18|16|Culturelle Daily Probiotic|
|17|D19|17|Solgar Zinc Picolinate 15mg|
|18|D20|19|Solgar Zinc Picolinate 22mg|
|19|D21|23|NOW Foods Beta-Glucan|
|20|D22|24|NOW Foods Beta Glucan 250mg|

**현재 두 모터:** 비타민 C(Doctor's Best Quali-C)는 **D3**, 비타민 D3(Swanson)는 **D4**. 비타민 D3라는 상품명의 D3와 보드 D3 핀은 별개다.

## 모터 1채널 배선

사용 모듈: DC 5–36V 15A로 판매된 MOSFET 스위치 모듈. 실제 정격·제어 단자 표기는 실물 설명서를 기준으로 한다.

| 연결할 곳 | 배선 |
|---|---|
| 모듈 VIN+ / VIN− | 해당 모터 정격에 맞는 외부 전원 + / − |
| 모듈 VOUT+ / VOUT− | 해당 모터 + / − |
| 모듈 신호 입력(SIG/IN 등) | 위 표의 Mega 출력 핀 |
| 모듈 제어 GND | Mega GND |
| Mega와 Pi | USB 케이블, 115200 baud |

모듈마다 같은 방식으로 신호를 연결하며 제어 GND는 공통으로 연결한다. 모듈에 별도 제어 전원 단자가 있다면 실물 사양에 맞춰 연결한다. VIN/VOUT 전력 단자를 제어 신호 단자와 혼동하지 않는다. Mega 핀·5V 단자로 모터/팬을 직접 구동하지 않는다. 배선 변경·펌웨어 업로드 때는 외부 모터/팬 전원을 끈다.

현재 모터/팬 출력은 **HIGH가 ON**, LOW가 OFF다. 다른 극성 모듈을 사용하면 `settings.h` 변경과 재업로드가 필요하다. DC 모터의 역기전력 보호가 모듈에 포함되어 있는지 실제 모듈 사양으로 확인한다.

## DHT22와 팬

| 장치 | Mega 연결 |
|---|---|
| DHT22 DATA | D2 |
| DHT22 VCC / GND | 센서/모듈 사양에 맞는 전원 / 공통 GND |
| 팬 MOSFET 신호 | D23 |
| 팬 MOSFET 제어 GND | Mega GND |
| 팬 전원·출력 | 팬 정격에 맞는 외부 전원을 VIN, 팬을 VOUT에 연결 |

단품 DHT22는 DATA 풀업이 필요하다. 센서 모듈의 풀업 내장 여부와 단자 표기를 확인한다.

팬 기본 규칙: 30℃ 이상 또는 습도 70% 이상이면 ON. 28℃ 이하이면서 습도 65% 이하이면 OFF. 센서 읽기 실패 시 ON. 부팅 때 팬 제어는 ON으로 시작하며 첫 정상 측정 후 조건에 따라 바뀐다. 2.5초 간격으로 모터가 쉬는 동안 측정한다. 실제 팬 회전 확인은 별도다.

## 비워둘 핀

- **D13은 모터에 쓰지 않는다. 슬롯 11은 D24다.**
- D0/D1은 시리얼 통신에 사용하므로 외부 모터 신호를 연결하지 않는다.
- D2는 센서, D23은 팬용이다.
- D20/D21은 현재 모터 18/19용이다. I²C 장치를 추가할 경우 핀 충돌을 먼저 해결해야 한다.

## 주문 시 동작

한 주문 총 5개까지, 모터는 **동시에 돌지 않고 순차 동작**한다. 각 1개마다 해당 슬롯을 설정 시간 동안 실행하고 DONE 응답 후 0.3초 간격으로 다음 모터를 실행한다. Arduino도 동시 RUN을 거부한다. 예: C 2개, D3 1개는 D3 핀 2회 후 D4 핀 1회다(실제 주문 항목 순서를 따른다).

DONE은 모터 출력 종료 응답이며 낙하 감지 신호가 아니다. 실제 수령량은 수령구에서 확인한다. 결과 불명 상태에서는 자동 재배출하지 않는다.

## 모터 시간 설정

Pi SSH에서 다음 명령으로 슬롯별 시간을 변경한다. 아래 500은 시험값이며 명령 자체는 모터를 돌리지 않는다.

```bash
python3 ~/.local/share/vitamin-vending/pi/set_runtime.py --slot 1 --ms 500
systemctl --user restart vitamin-kiosk
```

허용 시간은 100~5000ms다. 서버 재시작 후 화면 인증값도 갱신하도록 키오스크 브라우저를 다시 연다. 실제 파우치 1개가 나오는 시간을 확인하여 설정한다.

## 현장 확인 순서

1. 외부 전원을 끈 채 슬롯·핀·상품을 대조한다.
2. 제어 GND, 모듈 극성, 전원 정격을 확인한다.
3. 전원을 켠 후 연결한 상품을 1개씩 구매해 해당 모터·수령량을 확인한다.
4. 재고 감소와 QR 회원의 이용내역을 대조한다. QR 없는 구매는 익명 기록이다.
5. 나머지 채널, 팬 ON/OFF, 재부팅 자동 시작을 개별 확인한다.

핀 배치 원본: [mega_pin_map.h](firmware/mega_pin_map.h). 팬·출력 극성 설정: [settings.h](firmware/settings.h).

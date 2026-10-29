> 2026-10-29 현장 갱신: 최신 Mega 7,244바이트 업로드/검증, DHT22 ENV 정상 응답, 현재 두 모터 구매 흐름 및 구매 로그를 사용자 확인. 전체 핀별 시험은 미완료. 최신 배선과 확인 범위는 [ARDUINO_WIRING.md](ARDUINO_WIRING.md)를 우선한다. 아래 업로드 미완료 설명은 이전 기록이다.

# 소프트웨어 인계 — 2026-10-29

> 최신 연결 버전: [HOME_TEST_2026-10-29.md](HOME_TEST_2026-10-29.md). `.deploy/connected-20261029.zip`을 사용한다. 이제 QR 사용자 ID만 별도 구매내역 연결에 사용하며 건강 JSON은 주문에 보내지 않는다. 재고 주기 갱신·지도 편집 보완 포함. 아래 “회원 ID를 보내지 않음” 및 admin/recommendation 묶음 설명은 이전 상태다.

> 관리자 후속 변경 이력: ID `admin`과 별도로 전달한 비밀번호로 모바일 관리자 재고 관리가 가능하다. 관리자 DB migration은 원격 적용 완료. `.deploy/admin-20261029.zip`은 이전 묶음이며 맨 위 connected 버전을 사용한다. 실제 비밀번호는 공개 저장소에 기록하지 않는다.

> 추천 화면 후속 변경: [27개 상황의 관련 후보 표시](RECOMMENDATION_UPDATE_2026-10-29.md). 최신 배포 파일은 `.deploy/recommendation-20261029.zip`이며 아래 기존 묶음보다 우선한다. 통합31개·React7개로 검증을 갱신했다.

## 현재 동작

휴대폰 **웹사이트**에서 건강정보를 QR JSON으로 표시한다. Pi 키오스크가 JSON을 직접 해석해 추천하며 QR에 사용 기한은 없다. 건강정보 변경 시 QR 내용도 바뀐다. QR·회원 ID·건강정보는 구매 요청이나 신규 재고 기록에 보내지 않는다. 기존 휴대폰 회원가입·건강정보 저장 기능은 별도로 유지한다.

구매하기를 누르면 결제나 배출 시작 버튼 없이 즉시 배출 화면으로 넘어간다. Pi가 Supabase 재고를 예약한 후 Mega에 RUN을 보내고 DONE을 받은 뒤 완료 기록을 확정한다. 수량은 총 5개까지다. DONE은 모터 출력 종료이며 낙하 센서의 성공 신호가 아니다.

중복 클릭·재시작·통신 장애로 같은 요청을 자동 재배출하지 않는다. 아직 서버가 받지 않은 요청은 DB에 취소 기록을 남겨 늦게 도착해도 차단한다. 실제 실행 결과가 불명확한 요청은 관리자가 수령구를 확인하고 복구한다. SQLite는 **재고 DB가 아니라 실행 중복 방지 journal**이다.

## 20상품 배치

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

센서는 **DHT22, D2**, 팬 드라이버 제어는 **D23**. D13은 부팅 LED에 사용되므로 모터11은 D24에 배정했다([공식 부트로더 소스](https://github.com/arduino/ArduinoCore-avr/blob/1.8.6/bootloaders/stk500v2/stk500boot.c)). 기존 슬롯1/2를 보존했다. DB의 20슬롯 및 기기 허용 슬롯 적용을 완료했고 재고 수량은 바꾸지 않았다. 실제 새 배선·업로드는 아직 하지 않았다.

## Mega 업로드

Arduino IDE에서 `firmware/firmware.ino`를 열고 Mega 2560을 선택한다. 라이브러리는 Adafruit `DHT sensor library` 1.4.6과 `Adafruit Unified Sensor` 1.1.15, 보드 코어 Arduino AVR 1.8.6으로 컴파일 검증했다.

`settings.h`에서 모터/팬 드라이버의 활성 레벨을 지정한다. 기본 HIGH다. 핀은 드라이버 신호용이며 전원 공급 핀이 아니다. 업로드 후 모터 시간이 맞는지 실제 1회분으로 교정한다.

팬 시험 기본값: **30℃ 이상 또는 습도 70% 이상이면 ON**, **28℃ 이하이면서 습도 65% 이하이면 OFF**. 측정 실패 시 ON. 2.5초 간격으로 모터가 쉬는 동안 읽는다. 기준값은 `settings.h`에서 조정하며 제품 보관 조건을 인증한 값은 아니다.

시리얼 115200 baud, 줄바꿈 LF: `PING`, `STATUS`, `STOP`, `ENV`, `RUN 슬롯 밀리초`. RUN은 슬롯1~20, 100~5000ms, 동시 한 모터만 허용한다. `ENV`는 온도·습도·팬 상태만 조회한다. 시리얼 모니터를 닫아야 Pi가 USB를 사용할 수 있다.

공식 참조: [Arduino CLI 설치](https://docs.arduino.cc/arduino-cli/installation/), [Adafruit DHT 라이브러리](https://github.com/adafruit/DHT-sensor-library).

## Pi 설치

두 웹 빌드와 gateway를 포함한 `.deploy/software-20261029/`를 Pi 홈에 복사한 뒤:

```bash
bash ~/software-20261029/install.sh
```

이 업데이트 묶음에는 기기 비밀키가 없다. 기존 `~/.local/share/vitamin-vending/pi/device.json`을 보존하며 새 슬롯의 시간만 500ms로 채운다. 기존 교정 시간과 journal은 보존한다. 처음 설치하는 Pi라면 기존에 발급받은 비밀 `device.json`을 먼저 준비해야 한다. 인증값은 Git에 없다.

기존 9000 시험 서버와 시리얼 모니터를 종료한다. `python3-serial`, dialout 권한이 필요하다. Pi 키오스크는 `http://localhost:3000`, 휴대폰은 같은 Wi-Fi에서 `http://현재Pi주소:3001`을 연다. IP는 `hostname -I`로 확인한다.

```bash
python3 ~/.local/share/vitamin-vending/pi/set_runtime.py --slot 1 --ms 500
systemctl --user restart vitamin-kiosk
curl http://localhost:3000/api/health
```

슬롯1~20 각각 실제 시간을 입력한다. 500ms는 초기 시험값이다. 위 설정 명령만으로 모터는 돌아가지 않는다.

## 현장에서 남은 확인

1. Mega에 새 펌웨어 업로드, Pi 업데이트 설치 후 서비스 시작.
2. 20개 모터 배선과 상품 슬롯 일치 확인, 실제 1회분 시간 교정.
3. DHT22 측정과 팬 ON/OFF 기준·드라이버 극성 확인.
4. QR 스캐너를 USB HID·영문 입력·Enter 접미로 설정하고 휴대폰 화면 스캔. 입력칸 자동 포커스 및 재포커스 버튼 제공.
5. 구매 → 모터 → 수령구 → DB 재고를 소량으로 대조. 재부팅 후 자동 시작 및 실제 휴대폰 로그인·정보 수정 확인.

이 컴퓨터에서는 실물 모터·센서·스캐너를 연결하지 않았으므로 현장 성공으로 기록하지 않는다. 알레르기 표시 검증 자료가 없는 상품은 기존대로 추천에서 보수적으로 제외하며, 실제 제품 라벨 등록은 운영 데이터 작업이다.

## 검증 및 DB

- 모바일/QR 기존 통합 29개, 새 PostgreSQL 재고 검증 1개, React 구매·세션 6개, gateway 모의 모터/HTTP 11개 통과.
- 모바일 clean install, lint 및 두 웹 production build 성공.
- Mega 2560 대상 컴파일 성공. 실제 업로드는 하지 않음.
- Supabase `inventory_only_vending` 적용 완료. 적용 전후 전체 상품 재고 digest 동일, 활성 20상품 슬롯·기기 허용 슬롯 확인.
- 회원 테이블 변경 없이 무료 주문/중복/취소/실패 재고 복원/권한 거부를 별도 PostgreSQL에서 검증.
- 보안 advisor ERROR/WARN 없음. INFO 8건은 접근을 차단한 private/구형 테이블의 의도적인 RLS 무정책 상태다. [안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

기존 SQL 파일은 이력이다. 기존 프로젝트에 seed나 전체 스키마를 재실행하지 않는다. 이번 변경 파일은 `frontend/supabase/migrations/20261029004140_inventory_only_vending.sql`이며 원격에는 이미 적용됐다.

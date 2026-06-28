# 자판기 Supabase DB 연동 가이드

## 1. Supabase 프로젝트 준비

1. [https://supabase.com](https://supabase.com) 에서 프로젝트 생성
2. **Project Settings → API** 에서 아래 값 복사
   - **Project URL** → `REACT_APP_SUPABASE_URL`
   - **anon public** 키 → `REACT_APP_SUPABASE_ANON_KEY`  
     (보통 `eyJ` 로 시작하는 JWT 형태입니다)

## 2. 환경변수 설정

```bash
cd frontend
copy .env.example .env
```

`.env` 예시 (이 프로젝트 URL):

```env
REACT_APP_SUPABASE_URL=https://nihtftvohyrgegyytfkd.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
REACT_APP_USE_SAMPLE_FALLBACK=true
```

> REST API 주소 `.../rest/v1/` 가 아니라 **프로젝트 URL만** 넣습니다.  
> `https://nihtftvohyrgegyytfkd.supabase.co`

> DB 연동만 검증할 때는 `REACT_APP_USE_SAMPLE_FALLBACK=false` 로 두면  
> 오류 시 샘플 대신 빈 목록이 나와 문제를 바로 확인할 수 있습니다.

## 3. 테이블·시드 데이터 생성

Supabase 대시보드 → **SQL Editor** → New query

**처음이거나 예전 `vitamins`만 있던 DB:**

1. `supabase/migrate_from_v1.sql` (선택, 기존 테이블 삭제)
2. `supabase/schema.sql` → **Run**
3. `supabase/seed.sql` → **Run**

### 데이터 구조 (알고리즘 설계 슬라이드 반영)

| 테이블 | 내용 |
|--------|------|
| `nutrients` | 영양소 12종 — 목적·주의사항 |
| `symptom_categories` | 7개 카테고리 (피로, 면역, 눈, …) |
| `symptoms` | 22개 세부 증상 |
| `symptom_nutrients` | 증상 → 추천 영양소 매핑 |
| `vitamins` | 판매 제품 **24종** — 함유량·형태·비고 |

### vitamins 주요 컬럼

| 컬럼 | 설명 |
|------|------|
| id | 상품 ID (1~24, 추천·QR 로직과 연동) |
| nutrient_id | 영양소 FK |
| name | 제품명 |
| category | 영양소 표시명 (`nutrients.name`) |
| price | **알(1정)당 가격(원)** |
| serving_content | 1회 섭취량 함유량 |
| form | 캡슐 / 정제 / 소프트젤 |
| remarks | 비고 |
| stock | 재고 |

## 4. 연결 테스트

```bash
cd frontend
npm run db:test
```

성공 예: `OK — 활성 상품 20건`

## 5. 주문(구매) 기능 — `orders_schema.sql`

상품 seed 이후 **한 번 더** 실행:

1. `supabase/orders_schema.sql` → SQL Editor **Run**

생성되는 것:
- `orders`, `order_items` 테이블
- `place_order()` 함수 — 결제 시 주문 저장 + **재고 차감**

앱에서 **구매하기** → Supabase에 주문 기록, 화면에 `주문 #xxxxxxxx` 표시.

```bash
npm run db:test-order
```

## 6. 결제 UI — `payment_schema.sql`

주문 테이블 생성 후 **한 번 더** 실행:

1. `supabase/payment_schema.sql` → SQL Editor **Run**

- `orders.payment_method` 컬럼 추가 (`card` / `mobile` / `cash`)
- 앱 **결제하기** → 수단 선택 → 시뮬레이션 결제 → DB 주문 저장

## 7. 앱 실행

```bash
npm start
```

**직접 구매** 화면 상단에  
- `✓ Supabase DB에서 상품을 불러왔습니다.` → DB 연동 성공  
- `⚠ 샘플 데이터 사용 중` → `.env` 또는 SQL·RLS 점검

## 자주 나는 오류

| 증상 | 해결 |
|------|------|
| `환경변수가 설정되지 않았습니다` | `.env` 생성 후 **개발 서버 재시작** (`npm start`) |
| `relation "vitamins" does not exist` | `schema.sql` 실행 |
| `0건` / 빈 목록 | `seed.sql` 실행 |
| `permission denied` / RLS | `schema.sql` 의 `vitamins_public_read` 정책 확인 |
| DNS / fetch failed | Project URL이 맞는지, 프로젝트가 일시중지(paused)되지 않았는지 확인 |

## Node 시드 스크립트 (선택)

SQL 대신 API로 넣으려면 **service_role** 키가 필요합니다 (브라우저에 넣지 마세요).

```bash
# .env.local 에 SUPABASE_SERVICE_ROLE_KEY=... 추가 후
npm run db:seed
```

일반적으로는 **SQL Editor에서 seed.sql 실행**을 권장합니다.

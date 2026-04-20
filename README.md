# LZ.OFT//SCAN — LayerZero OFT DVN 대시보드

`scan_oft_dvn_lzapi.py` 스캐너를 래핑해 LayerZero V2 OFT 배포를 실시간 시각화하는 대시보드.

## 주요 기능

- **1-of-1 DVN 취약 OFT 탐지** — 기본값은 vulnerable 필터, 토글로 safe/paused/all 전환
- **Pause 상태 모니터링** — 모든 OFT에 `paused()` 멀티콜 (OpenZeppelin Pausable)
- **체인별 가격 비교** — DexScreener 배치 API로 체인별 DEX 가격 조회
- **아비트라지 기회 힌트** — 가격 스프레드 ≥ 0.5% + 양쪽 유동성 ≥ $50k 조건 만족시 강조
- **정렬/검색/체인 필터** — symbol, chain_count, vuln, paused, tvl, spread, arb 기준 오름·내림차순
- **디테일 패널** — 심볼 클릭 시 체인별 어댑터/토큰/DVN/가격/TVL/DexScreener 링크 펼침

## 아키텍처

```
┌────────────────────────────┐   ┌────────────────────────────┐
│ Frontend (Next.js 15)      │   │ Backend (FastAPI)          │
│ /app/page.tsx              │──▶│ GET /api/scan              │
│ components/Dashboard.tsx   │   │ GET /api/health            │
│ Tailwind + framer-motion   │   │                            │
│ JetBrains Mono +           │   │ ┌ registry.py              │
│ Major Mono Display         │   │ │ → metadata.layerzero-api │
└────────────────────────────┘   │ ├ scanner.py               │
                                 │ │ → RPC multicall3         │
                                 │ │   getRecvLib/getConfig/  │
                                 │ │   paused/token/symbol/…  │
                                 │ ├ prices.py                │
                                 │ │ → api.dexscreener.com    │
                                 │ └ aggregator.py            │
                                 │   (60s TTL cache)          │
                                 └────────────────────────────┘
```

스캐너는 부모 디렉터리의 `scan_oft_dvn.py` 상수/헬퍼(`multicall`, `decode_uln_config`,
`encode_*`)를 직접 import 한다. 원본 스크립트 수정 없이 확장.

## 시작하기

### 선행 조건

- Python 3.11+ (`uv` 권장)
- Node.js 20+ (`pnpm`)
- 인터넷 접속 (LayerZero API + 공개 RPC + DexScreener)

### 백엔드

```bash
cd dashboard/backend
./run.sh
# -> http://127.0.0.1:8000
```

환경변수:
- `SCAN_CACHE_TTL` (기본 60초)
- `ALLOW_ORIGINS` (쉼표 구분, 기본 `http://localhost:3000`)

엔드포인트:
- `GET /api/scan?force=false` — 전체 스캔 결과 (캐시)
- `GET /api/health` — 백엔드 상태 + 캐시 나이

### 프론트엔드

```bash
cd dashboard/frontend
pnpm install
pnpm dev
# -> http://localhost:3000
```

환경변수:
- `BACKEND_URL` (기본 `http://127.0.0.1:8000`)

## 프로젝트 구조

```
dashboard/
├── backend/
│   ├── pyproject.toml
│   ├── run.sh              # uv 런처
│   └── app/
│       ├── main.py         # FastAPI 엔트리
│       ├── chains.py       # 체인 메타 (EID·RPC·DexScreener 슬러그)
│       ├── registry.py     # LZ API fetch + chain별 배포 인덱스
│       ├── scanner.py      # DVN/pause 멀티콜 스캐너
│       ├── prices.py       # DexScreener 배치
│       ├── aggregator.py   # 스캔 + 가격 + 아비트라지 집계
│       ├── cache.py        # 단일 슬롯 TTL 캐시
│       └── models.py       # Pydantic 응답 스키마
└── frontend/
    ├── app/
    │   ├── layout.tsx      # 폰트 로드 (JetBrains Mono + Major Mono Display)
    │   ├── page.tsx        # SSR 초기 로드 + 오류 화면
    │   └── globals.css     # 다크 팔레트, 스캔라인, 그리드, 노이즈
    ├── components/
    │   ├── Dashboard.tsx   # 상태 관리 (정렬/필터/검색)
    │   ├── Header.tsx      # 히어로 로고 + 리스캔 버튼
    │   ├── StatusBar.tsx   # 메타 라인 + 체인 헬스 도트
    │   ├── FilterBar.tsx   # 뷰 토글 + 체인 필터 + 검색
    │   ├── OftTable.tsx    # 정렬 가능 메인 테이블
    │   ├── DetailPanel.tsx # 우측 슬라이드 오버
    │   ├── StatusPill.tsx
    │   ├── SpreadBar.tsx   # 미니 스파크 바
    │   ├── ChainGrid.tsx   # 체인 코드 칩
    │   └── CopyBtn.tsx
    └── lib/
        ├── types.ts        # 백엔드 모델 미러
        ├── api.ts          # fetch 래퍼
        ├── format.ts       # 숫자/주소/체인 포매터
        └── sort.ts         # 정렬 로직
```

## 설계 노트

### 상태 분류 (per-chain)

| status         | 의미                                                             |
|----------------|------------------------------------------------------------------|
| `vulnerable`   | 1-of-1 DVN 설정 + non-stub DVN (실제 공격 가능)                  |
| `paused`       | `paused()` 멀티콜이 `true` 반환 (OpenZeppelin Pausable)          |
| `safe`         | multi-DVN 또는 stub DVN (기본 library fallback)                  |
| `unknown`      | `getConfig` 실패 또는 config 없음                                 |
| `unreachable`  | RPC 호출 자체가 실패                                             |

### OFT 상태가 갱신되면 자동 반영

`/api/scan`은 60초 TTL 캐시. 재스캔 버튼은 `?force=true`로 우회. 1-of-1 DVN이
수정된 OFT는 재스캔 즉시 목록에서 제외된다.

### DexScreener 한계

- 무료 플랜 `300 req/min`, 1 콜당 최대 30 주소, 체인 단위 배치
- 가격 없는 토큰 (미상장·유동성 없음)은 `null`로 처리 → `price_spread_pct`와
  `arbitrage`도 `null`
- 유동성 $1k 미만 풀은 노이즈로 간주하고 가격 후보에서 제외
- 아비트라지 힌트는 `spread ≥ 0.5%` + `min liquidity ≥ $50k` 조건 충족시만

### 새 체인 추가

`backend/app/chains.py`의 `CHAINS` 딕셔너리에 항목 추가:
- `lz_name` (LayerZero 레지스트리 키와 일치)
- `chain_id`, `eid`, `rpc`
- `dex_slug` (DexScreener 슬러그)
- `display`

스캐너가 자동으로 처리함.

## 스크린샷

- 메인 화면: `.claude/screenshot-top.png`
- 디테일 패널: `.claude/screenshot-detail-fixed.png`

## 제약·할 일

- 프론트/백엔드 분리 배포 (CORS 기본값 `localhost:3000`만 허용)
- Linea 등 일부 체인은 LZ 레지스트리 키가 `linea-mainnet` 같은 포맷이면 자동
  매칭 안 됨 → `CHAINS`에 정확한 레지스트리 키를 사용해야 함
- WebSocket 실시간 푸시는 미구현 (수동 `re_scan`으로 충분)

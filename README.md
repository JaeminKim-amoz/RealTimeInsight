# RealTimeInsight (RTI)

> 항공·우주·EW 분야 실시간 텔레메트리 분석 워크스테이션
>
> Tauri 2 + React 18 + Three.js + Rust UDP 수신기

[![vitest](https://img.shields.io/badge/vitest-848%20pass%20%2B%2013%20todo-brightgreen)](#)
[![build](https://img.shields.io/badge/build-passing-brightgreen)](#)
[![cargo](https://img.shields.io/badge/cargo-passing-brightgreen)](#)
[![coverage](https://img.shields.io/badge/coverage-%E2%89%A580%25-blue)](#)

---

## 무엇을 하는 프로그램인가?

PCM/IRIG/UDP 텔레메트리 스트림을 **실시간으로 받아서 분석·시각화**하는 데스크톱 워크스테이션입니다.
시험비행, 미션 디버그, 사후 리플레이, EW (전자전) 분석, 우주 (위성·궤도·위협권) 시각화까지
한 화면에서 처리할 수 있도록 설계되었습니다.

### 주요 기능

| 카테고리 | 기능 |
|---|---|
| 📡 **수신/디코드** | PCM-IRIG-106 Ch10 + UDP, 사용자 정의 sync pattern, AES-256 옵션, 멀티 스트림 |
| 📊 **시각화** | Strip / Numeric / Discrete / Spectrum / Eye / IQ / 2D Map / 3D Trajectory / Globe / Relation Graph |
| 🛰️ **우주/EW** | 18 위성 궤도, 7 위협 도메, 2 우군 EW emitter, GPS LOS DOP/SNR 분석 |
| 🚨 **이상 탐지** | Threshold breach + Sustained deviation + Delta spike (5 룰 기본) |
| ⏪ **리플레이** | 60초 녹화 fixture, scrub bar, 0.25× ~ 4× 재생 속도, 루프 |
| 🖱️ **상호작용** | Drag-to-split, 5-zone drop overlay, Cmd/Ctrl+K palette |
| 🤖 **LLM 분석** | "Why this anomaly?" 자동 진단 (Ollama mock provider) |
| 📁 **데이터** | Channel Mapping (CSV import/export), Recording Library (12 미션 fixture) |

---

## 빠른 시작 (3가지 모드)

### 1. 🌐 브라우저 dev (가장 빠름, 30초)

백엔드 없이 mock synthesizer로 모든 패널이 동작합니다.

```bash
git clone https://github.com/<user>/RealTimeInsight-main
cd RealTimeInsight-main
npm install
npm run dev
```

브라우저로 → `http://127.0.0.1:5173`

### 2. 🖥️ Tauri 데스크톱 (실제 UDP 수신)

Rust + Tauri 네이티브 윈도우. 실제 PCM/UDP 패킷을 받습니다.

```bash
npm run tauri:dev
```

데이터 송신 (다른 터미널에서):

```bash
cargo run --manifest-path project/crates/rti_core/Cargo.toml --bin pcm_gen -- --bitrate 10
```

### 3. 📦 Production 빌드

```bash
npm run build           # 정적 자산 dist/
npm run preview         # 빌드 결과 미리보기 (http://127.0.0.1:4173)
npm run tauri:build     # 데스크톱 설치 파일 (.msi / .dmg / .AppImage)
```

---

## 5분 안에 익히는 화면 구성

```
┌─────────────────────────────────────────────────────────────────────┐
│  TopBar : LIVE/REPLAY · Workstation/Space/EW/GPS · 메뉴 · RX 상태   │
├──────────┬───────────────────────────────────────────────┬──────────┤
│          │                                                │          │
│ Channel  │            Workspace (sheets)                  │ Insight  │
│ Explorer │   ┌─────────┬─────────┬─────────┐              │  Pane    │
│          │   │  Strip  │  Map2D  │ Globe3D │              │ (anomaly │
│ ▸ POWER  │   ├─────────┴────┬────┴─────────┤              │  list,   │
│ ▸ HYD    │   │  Numeric     │   Waterfall  │              │  RC      │
│ ▸ NAV    │   ├──────────────┴──────────────┤              │ candi-   │
│ ▸ COMMS  │   │       Event Log              │              │ dates,   │
│ ▸ RF     │   └──────────────────────────────┘              │ links)   │
│          │                                                │          │
├──────────┴───────────────────────────────────────────────┴──────────┤
│  BottomConsole : FPS · CRC fail rate · Bridge status · TX/RX        │
└─────────────────────────────────────────────────────────────────────┘
```

| 영역 | 무엇을 보는 곳? |
|---|---|
| **TopBar** | 모드 전환 (Live↔Replay), 시트 선택, 메뉴 (Layout/Library/Settings 등), RX bitrate |
| **ChannelExplorer** (좌) | 사용 가능한 모든 채널, 검색·필터, 패널로 드래그 |
| **Workspace** (중앙) | 현재 선택된 시트의 패널 그리드 — 드래그-스플릿 가능 |
| **InsightPane** (우) | 자동 탐지된 이상, 근본원인 후보, 관련 채널 링크 |
| **BottomConsole** | 시스템 상태, 실시간 FPS·CRC·bitrate |

---

## 핵심 사용 시나리오

### 🔴 시나리오 1 — Live 모드 모니터링

1. 앱 시작 → TopBar에 `LIVE` 활성
2. ChannelExplorer에서 채널 (예: `bus_volt_28v`) 검색
3. 채널을 패널로 드래그 → 5-zone overlay (center/top/bottom/left/right) 표시
   - **Center drop** → 패널의 기존 series에 채널 추가 (overlay)
   - **Edge drop** → 패널을 분할해서 새 strip 생성
4. InsightPane에서 자동 탐지된 anomaly 클릭 → 관련 채널이 하이라이트

### ⏪ 시나리오 2 — Replay 모드로 사후 분석

1. TopBar에서 `REPLAY` 클릭
2. 메뉴 → **Library** → 12개 mission recording 중 선택 → 자동 로드
3. 하단 transport 컨트롤:
   - `▶` 재생 / `⏸` 일시정지 / `⏮ ⏭` 처음·끝
   - **Scrub slider** 드래그로 임의 시점으로 이동
   - **0.25× / 0.5× / 1× / 2× / 4×** 속도 조절
4. **Loop** 토글 ON 시 끝나면 처음부터 반복

### 🛰️ 시나리오 3 — Space 시트 (위성·위협권 분석)

1. TopBar → `Space` 시트
2. **좌측 60% Globe**: 18 위성이 궤도를 따라 회전, 7개 SAM 위협 dome (빨강), 2개 우군 EW emitter (녹색)
   - **드래그**로 지구 회전
   - **휠 스크롤**로 줌
   - **우상단 토글**로 텍스처/와이어프레임/대기/별/궤도/위협/EW/지형/자동회전 ON/OFF
3. **우측 40% GPS LOS**: 21 위성 skyplot, DOP grid (PDOP/HDOP/VDOP/TDOP/GDOP), SNR 12 막대, 30분 PDOP 예측

### 📊 시나리오 4 — Anomaly 진단

1. InsightPane에서 anomaly 카드 클릭 (예: "hyd_pressure spike")
2. 선택된 anomaly에 연관된 모든 패널이 하이라이트됨
3. 메뉴 → **LLM** 드로어 열기
4. **"Why this anomaly?"** 버튼 클릭 → mock LLM이 evidence chip + tool trace로 답변
5. 좋은 답이면 → 메뉴 → **Export** → PDF/MAT/JSON 으로 저장

### 🎚️ 시나리오 5 — 워크스페이스 커스터마이징

1. 메뉴 → **Layout** 모달 → 6개 factory preset 중 선택
   - Flight Analysis · RF/Spectrum · Map+Video · Anomaly Triage · Mission Rehearsal · Engineering Check
2. Tab 변경: **Factory** / **Saved** / **Shared**
3. 직접 만든 워크스페이스 저장 → 이름 지정 → "Saved" 탭에 표시
4. 메뉴 → **Channel Mapping** 으로 채널 별 displayName / unit / qualityPolicy / formula 편집
5. CSV로 export/import 가능

---

## 키보드 단축키

| 단축키 | 동작 |
|---|---|
| `Cmd/Ctrl + K` | Command Palette (모든 액션 fuzzy search) |
| `Esc` | 모달 / 드로어 닫기 |
| `Space` (Replay) | 재생 ↔ 일시정지 |
| `←` / `→` (Replay) | 1초 단위 시킹 |
| `,` / `.` (Replay) | 1프레임 시킹 |

---

## 더 알아보기

| 문서 | 설명 |
|---|---|
| [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) | 모든 패널·모달·시나리오 상세 가이드 |
| [`docs/UDP_BRIDGE.md`](docs/UDP_BRIDGE.md) | UDP 수신기 설정, sync pattern, AES-256, multi-stream |
| [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) | 개발 환경, 디렉토리 구조, 테스트, 기여 가이드 |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | "Bridge offline", 빈 globe, 빌드 오류 등 |

---

## 시스템 요구 사항

| 항목 | 최소 | 권장 |
|---|---|---|
| OS | Win10 / macOS 12 / Ubuntu 22 | Win11 / macOS 14 / Ubuntu 24 |
| RAM | 4 GB | 16 GB |
| GPU | 통합 그래픽 (WebGL 1.0) | 외장 GPU (Globe 60 FPS) |
| Node | 18.x | 20.x LTS |
| Rust | 1.74 | 최신 stable |

---

## 라이선스

© 2026 RealTimeInsight Project. (라이선스는 별도 협의)

내부 라이브러리 (rti_core, panels, modals)는 모두 자체 구현이며,
외부 의존성은 standard MIT/BSD-3 (React, Three.js, MapLibre, Zustand, Tauri 등) 입니다.

CDN 의존성 없음 — `@fontsource/*` npm 패키지로 폰트도 모두 로컬 동봉.

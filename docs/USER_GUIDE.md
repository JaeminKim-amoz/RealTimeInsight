# RealTimeInsight 사용 가이드

> 이 문서는 모든 패널·모달·상호작용을 한 페이지에서 안내합니다.
> 처음 사용하시는 분이라도 순서대로 읽으면 5–10분이면 익숙해질 수 있습니다.

## 목차

1. [모드와 시트](#1-모드와-시트)
2. [ChannelExplorer (좌측 사이드바)](#2-channelexplorer-좌측-사이드바)
3. [드래그 & 드롭](#3-드래그--드롭)
4. [패널 종류 (15+)](#4-패널-종류-15)
5. [Replay 모드 사용법](#5-replay-모드-사용법)
6. [Insight Pane (우측)](#6-insight-pane-우측)
7. [10가지 모달](#7-10가지-모달)
8. [LLM 분석 (드로어)](#8-llm-분석-드로어)
9. [이상 탐지 룰 편집](#9-이상-탐지-룰-편집)
10. [Settings & Tweaks](#10-settings--tweaks)

---

## 1. 모드와 시트

### 1-1. Live ↔ Replay 모드

TopBar 좌상단에 모드 토글이 있습니다.

| 모드 | 데이터 소스 | 사용 시점 |
|---|---|---|
| **LIVE** | 실시간 UDP 수신 (Tauri) 또는 mock synthesizer (browser) | 시험비행 중 모니터링 |
| **REPLAY** | 60초 fixture 또는 Recording Library에서 로드한 .pcap | 사후 분석, 디버그 |

Replay 모드 진입 시 자동으로 transport 컨트롤이 표시됩니다.

### 1-2. 4개 시트 (Sheet)

| 시트 | 기본 패널 구성 | 주 사용 케이스 |
|---|---|---|
| **Workstation** | 14-cell heterogeneous grid (strip × 4, numeric × 3, map, eventlog 등) | 일반 비행 모니터링 |
| **Space** | Globe (60%) + GPS LOS (40%) + telemetry strip | 위성 / 우주 mission |
| **EW** | Spectrum + Waterfall + RF Analyzer + Threat list | 전자전 / 신호 분석 |
| **GPS LOS** | Full-bleed GPS LOS detail + 30min PDOP forecast | GNSS 가용성 점검 |

TopBar의 시트 선택 버튼을 누르면 즉시 전환됩니다.

---

## 2. ChannelExplorer (좌측 사이드바)

### 2-1. 검색

상단 검색창에 채널 이름·표시명·subgroup·tag 일부를 입력하면 트리가 즉시 좁혀집니다.

예시:
- `28v` → 모든 28V 버스 관련 채널
- `hyd` → hydraulic 그룹
- `crc` → CRC 카운터 채널
- `*pressure` → pressure 단어 포함

### 2-2. 그룹 토글

각 그룹 (POWER, HYD, NAV, COMMS, ENGINE, RF 등)을 ▸ 클릭으로 펼치고 닫을 수 있습니다.

### 2-3. 즐겨찾기 (★)

채널 옆 별표를 클릭하면 즐겨찾기에 추가됩니다. 즐겨찾기 그룹은 항상 최상단.

### 2-4. 알람 무장 (🔔)

채널 옆 종 아이콘을 클릭하면 alarm-armed 상태가 됩니다.
이 채널에서 anomaly가 발생하면 InsightPane이 즉시 알림을 표시.

---

## 3. 드래그 & 드롭

### 3-1. 채널 → 패널 드래그

ChannelExplorer 채널 행을 패널 위로 드래그하면 **5-zone overlay**가 나타납니다:

```
        ┌──── top ────┐
        │             │
 left ──┤   center    ├── right
        │             │
        └─── bottom ──┘
```

| 드롭 위치 | 동작 |
|---|---|
| **center** | 기존 패널의 series에 채널 추가 (overlay) |
| **top / bottom** | 패널을 위·아래로 분할, 새 strip 생성 |
| **left / right** | 패널을 좌·우로 분할, 새 strip 생성 |

### 3-2. 빈 공간으로 드래그

DockGrid의 빈 영역으로 드래그하면 새 panel cell이 생성됩니다.

### 3-3. 키 보조

- **Shift + drop**: strip 패널이라도 무조건 분할
- **Alt + drop** (계획 중): overlay 대신 다중-binding 추가

---

## 4. 패널 종류 (15+)

| 종류 (kind) | 무엇을 보여주는가? |
|---|---|
| `strip` | 시계열 line plot (1+ 채널 overlay), 글로벌 cursor 동기화 |
| `numeric` | 큰 숫자 readout + sparkline |
| `discrete` | bool / enum 채널의 state ribbon |
| `eventlog` | 이벤트 / 알람 / CRC fail 로그 (info/low/medium/high 색상) |
| `xy` | 두 채널 X-Y plot |
| `waterfall` | 시간 × 주파수 spectrogram (FFT 결과) |
| `map2d` | MapLibre 2D 지도, 항적·트랙 overlay (오프라인 스타일) |
| `trajectory3d` | Three.js 3D 궤적, ownship 모델 |
| `attitude3d` | 자세 (roll/pitch/yaw) attitude indicator |
| `antenna3d` | 안테나 패턴 / link budget 시각화 |
| `globe` | 지구 globe + 18 위성 + 7 위협 dome (Space 시트) |
| `gpslos` | GPS skyplot + DOP grid + SNR + 예측 |
| `relationgraph` | anomaly → 채널/알람/추천 노드 그래프 |
| `simdisbridge` | SIMDIS scenario 연동 view |
| `video` | 카메라 stream 패널 (lock indicator) |
| **`spectrum-rf`** | Keysight N9040B 스타일 spectrum analyzer |
| **`iq`** | IQ constellation (16-QAM / QPSK / 8-PSK preset) |
| **`eye`** | Eye diagram with persistence overlay |
| **`analyzer-ctrl`** | SCPI command preset list, 주파수·span 입력 |
| `markdown` | 자유 메모 / runbook 패널 |

각 패널 우상단의 `×` 버튼으로 제거할 수 있습니다.

---

## 5. Replay 모드 사용법

### 5-1. 진입 방법 3가지

1. TopBar 모드 토글에서 `REPLAY` 클릭
2. 메뉴 → `Library` 모달 → recording 클릭 (자동으로 replay 모드 진입)
3. Command Palette (`Cmd+K`) → "replay" 검색

### 5-2. Transport 컨트롤

```
[⏮]  [⏪]  [▶/⏸]  [⏩]  [⏭]   [속도▼: 1×]   [════●════════] 00:24.500 / 01:00.000  [🔁]
```

| 버튼 | 동작 | 단축키 |
|---|---|---|
| ⏮ | 처음으로 | Home |
| ⏪ | -1초 | ← |
| ▶ / ⏸ | 재생 토글 | Space |
| ⏩ | +1초 | → |
| ⏭ | 끝으로 | End |
| 속도 | 0.25× / 0.5× / 1× / 2× / 4× | (없음) |
| Scrub | 임의 시점 | (드래그) |
| 🔁 | 루프 ON/OFF | L |

### 5-3. Recording Library

메뉴 → **Library** → 12개 mission recording이 facet (date / mission / aircraft) 별로 정리되어 있습니다.

```
Mission
  ▸ Apollo (4 recordings)
  ▸ Phoenix (4 recordings)
  ▸ Halcyon (4 recordings)

Aircraft
  ▸ T-247 / T-50 / KF-21
```

클릭하면 해당 recording의 60초 buffer가 로드되고 자동으로 replay 모드로 진입합니다.

---

## 6. Insight Pane (우측)

### 6-1. 자동 탐지된 Anomaly 리스트

5개 기본 룰 (`project/src/mock/anomaly-rules.ts`) 이 streamStore의 buffer를 모니터링합니다:

| 룰 ID | 채널 | 종류 | 임계값 |
|---|---|---|---|
| `hyd-pressure-spike` | 1205 (hyd_pA) | delta-spike | 20 bar |
| `voltage-dip` | 1001 (bus_volt_28v) | threshold | < 27V |
| `rssi-low` | 5002 (rssi) | sustained-deviation | (구간 평균) |
| `aoa-high` | 2218 (aoa) | threshold | > 14° |
| `bus-current-burst` | 1002 (bus_cur) | delta-spike | 10A |

탐지된 anomaly는 severity (high/medium/low) 색상과 함께 표시되고, 클릭하면 모든 관련 패널이 하이라이트됩니다.

### 6-2. Root-Cause Candidates

하나의 anomaly를 클릭하면 **rank 별 후보 리스트**가 표시됩니다:

```
┌─ Anomaly: hyd_pA spike at 14:23:18.452 ────────────┐
│                                                      │
│  Root-cause candidates:                              │
│  ① 0.92  Pump 1 stage relief stuck closed           │
│         evidence: hyd_pA, hyd_q, vibration_z        │
│  ② 0.71  Bypass valve drift                         │
│         evidence: hyd_pA, hyd_pB                    │
│  ③ 0.58  Sensor noise (transient)                   │
│                                                      │
│  Related channels: 1205, 1206, 2210, 2215           │
└─────────────────────────────────────────────────────┘
```

### 6-3. Linked Cursor

InsightPane에서 anomaly window를 클릭하면 모든 패널의 cursor가 동기화됩니다.

---

## 7. 10가지 모달

| 모달 | 메뉴 위치 | 무엇을 하는가? |
|---|---|---|
| **Layout Preset** | TopBar → Layout | 6 factory + 사용자 saved + shared workspace 갤러리 |
| **LLM Drawer** | TopBar → LLM | "Why this anomaly?" 자동 진단 (mock provider) |
| **Channel Mapping** | TopBar → Mapping | 채널 displayName/unit/qualityPolicy/formula CSV 편집기 |
| **Recording Library** | TopBar → Library | 12 mission recording 카탈로그, click-to-load |
| **Stream Config** | TopBar → Settings → Streams | 4-tab UDP 설정 (sync pattern, frame, streams, AES-256) |
| **Sequence Validator** | TopBar → Validator | step-authoring + tolerance band + run + report |
| **Test Report** | Validator → Generate Report | PASS/FAIL grading, 채널 min/avg/max, PDF export stub |
| **Tweaks Panel** | TopBar → Tweaks | theme/density/relation-graph layout/devMode 토글 |
| **Settings Dialog** | TopBar → Settings | 테마 + 키맵 + offline mode 라디오 |
| **Export** | TopBar → Export | 4가지 quality policy로 export job 생성 |
| **MATLAB Bridge** | TopBar → MATLAB | MATLAB engine 연결, 스크립트 path 지정 |

---

## 8. LLM 분석 (드로어)

### 8-1. 사용법

1. 메뉴 → **LLM** 드로어 (우측 슬라이드)
2. 4개 추천 질문 ("Why this anomaly?", "Show related channels", "Compare to last run", "Explain CRC burst") 중 선택, 또는 자유 입력
3. **Send** 버튼 클릭

### 8-2. Citation Gate

모든 답변에는 **evidence chip**이 첨부됩니다 (예: `[ch:1205] [anom:001] [run:r-2026-04-20]`). Citation 없으면 답변이 생성되지 않습니다 (citationGate: 'required').

### 8-3. Tool Trace 펼치기

답변마다 **tool-trace** 패널이 있어서 LLM이 실제로 호출한 함수·쿼리·중간 결과를 확인할 수 있습니다.

### 8-4. Provider 변경

`Settings → LLM Provider` 에서:
- **local-ollama** (기본, mock provider — 실제 Ollama 연결은 슬라이스 4에서)
- **remote** (HTTPS endpoint)
- **disabled** (드로어 자체 비활성)

---

## 9. 이상 탐지 룰 편집

### 9-1. 기본 5룰

`project/src/mock/anomaly-rules.ts` 파일을 직접 수정하여 룰을 추가/변경할 수 있습니다.

```ts
export const ANOMALY_RULES: AnomalyRule[] = [
  {
    ruleId: 'my-custom-rule',
    channelId: 1234,
    kind: 'threshold',         // 'threshold' | 'delta-spike' | 'sustained-deviation'
    threshold: 100,
    direction: 'above',        // 'above' | 'below'
    severity: 'high',
    label: 'My custom rule',
  },
  // ...
];
```

### 9-2. 런타임에 룰 실행

```ts
import { useStreamStore } from './store/streamStore';
import { ANOMALY_RULES } from './mock/anomaly-rules';

useStreamStore.getState().runDetectors(ANOMALY_RULES);
```

기본적으로 1초마다 자동 실행됩니다 (`App.tsx`).

---

## 10. Settings & Tweaks

### 10-1. Settings (TopBar → Settings)

| 설정 | 옵션 |
|---|---|
| **Theme** | Dark / Light / High Contrast |
| **Keymap** | Default / Vim / Emacs |
| **Offline mode** | online-allowed / offline-preferred / airgapped |

`airgapped` 모드는 모든 외부 요청을 차단합니다 — 보안 환경 권장.

### 10-2. Tweaks (TopBar → Tweaks)

개발자 모드 토글:
- **Theme** segmented (Dark/Light/High Contrast)
- **Density** segmented (Compact / Normal / Spacious)
- **Relation graph layout** (Force / Hierarchy / Radial)
- **Dev mode** ON 시 추가 진단 정보 표시

### 10-3. 워크스페이스 자동 저장

워크스페이스의 layout tree는 변경 시 즉시 `localStorage` 에 저장됩니다.
키: `rti.workspace.current`. 다음 부팅 시 자동 복원.

---

## 추가 자료

- [`UDP_BRIDGE.md`](UDP_BRIDGE.md) — UDP 수신기 설정 상세
- [`DEVELOPMENT.md`](DEVELOPMENT.md) — 개발 환경 / 디렉토리 / 테스트
- [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) — 자주 묻는 문제 해결

문제 / 제안: GitHub Issues 로 알려주세요.

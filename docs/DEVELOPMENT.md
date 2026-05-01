# 개발 가이드

> 코드 수정·테스트·기여를 위한 안내. 사용자 가이드는 [`USER_GUIDE.md`](USER_GUIDE.md).

## 목차

1. [개발 환경 요구사항](#개발-환경-요구사항)
2. [디렉토리 구조](#디렉토리-구조)
3. [상태 관리 (5 Zustand stores)](#상태-관리-5-zustand-stores)
4. [TDD 워크플로](#tdd-워크플로)
5. [테스트 실행](#테스트-실행)
6. [커버리지 게이트](#커버리지-게이트)
7. [코드 스타일](#코드-스타일)
8. [기여 절차](#기여-절차)

---

## 개발 환경 요구사항

| 도구 | 버전 |
|---|---|
| Node.js | 18.x 이상 (20 LTS 권장) |
| npm | 9+ |
| Rust | 1.74+ stable |
| cargo | 최신 |
| Git | 2.30+ |

### 운영체제 별 설치

#### Windows
```powershell
winget install OpenJS.NodeJS.LTS Rustlang.Rust.MSVC Git.Git
```

#### macOS
```bash
brew install node@20 rustup git
rustup default stable
```

#### Ubuntu / WSL
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs build-essential
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Tauri 추가 의존성 (데스크톱 빌드용)

각 OS 별 webview2 / webkit2gtk 등 prerequisites:
https://tauri.app/v2/guides/getting-started/prerequisites/

---

## 디렉토리 구조

```
RealTimeInsight-main/
├── README.md
├── docs/                       # 사용자 + 개발자 문서
├── package.json                # Vite + Vitest + Playwright
├── vitest.config.ts            # 테스트 설정 (≥80% coverage)
├── playwright.config.ts        # @visual + @perf E2E
│
├── public/app/                 # 원본 prototype (HTML/CSS/JS) — 시각 reference
│   ├── space.jsx               # GlobePanel + GpsLosPanel 원본
│   ├── styles.css              # 1746 lines, 모든 클래스 정의
│   └── ...
│
├── project/
│   ├── src/                    # 메인 React + TypeScript 코드
│   │   ├── app/                # App.tsx, main.tsx
│   │   ├── shell/              # TopBar, ChannelExplorer, InsightPane, BottomConsole
│   │   ├── sheets/             # 4개 시트 (Workstation/Space/Ew/GpsLos)
│   │   ├── panels/             # 패널 종류별 폴더
│   │   │   ├── strip/          # StripChartPanel + render.ts
│   │   │   ├── globe/          # GlobePanel + globe-data + globe-textures
│   │   │   ├── gpslos/         # GpsLosPanel + skyplot
│   │   │   ├── rf/             # SpectrumPanel / IQPanel / EyePanel / AnalyzerControl
│   │   │   └── ...
│   │   ├── modals/             # 11개 모달 (Layout/LLM/Mapping/Library/Stream/...)
│   │   ├── store/              # 5 Zustand stores
│   │   │   ├── workspaceStore.ts
│   │   │   ├── sessionStore.ts
│   │   │   ├── selectionStore.ts
│   │   │   ├── streamStore.ts
│   │   │   ├── integrationStore.ts
│   │   │   └── uiStore.ts      # NEW: tweaks/settings UI-only state
│   │   ├── mock/               # synthesizer / channels / anomalies / recording / rules
│   │   ├── anomaly/            # detector.ts (pure logic)
│   │   ├── llm/                # mockProvider
│   │   ├── bridge/             # Tauri invoke client
│   │   ├── types/              # domain.ts (canonical types)
│   │   └── styles/             # app.css (기존 prototype CSS 그대로)
│   │
│   ├── tests/
│   │   ├── integration/        # spec22-acceptance / slice2-acceptance / slice3-visual
│   │   ├── e2e/                # Playwright (visual + perf)
│   │   └── unit/               # 추가 unit tests
│   │
│   ├── crates/rti_core/        # Rust UDP 수신기 + IRIG decoder
│   │   ├── src/
│   │   │   ├── pcm/generator.rs    # PCM 생성 로직
│   │   │   └── bin/pcm_gen.rs      # 송신 CLI
│   │   └── Cargo.toml
│   │
│   └── src-tauri/              # Tauri 메인 프로세스
│       ├── src/main.rs
│       └── tauri.conf.json
│
└── .omc/                       # OMC orchestration state
    ├── prd.json                # 현재 슬라이스 PRD
    └── notes/                  # 슬라이스 acceptance reports
```

---

## 상태 관리 (5 Zustand stores)

| Store | 책임 | 주요 액션 |
|---|---|---|
| `workspaceStore` | 워크스페이스 layout tree, 패널 instances, 프리셋 | `splitPanel`, `addBindingToPanel`, `loadPreset`, `savePreset` |
| `sessionStore` | Live ↔ Replay 모드, playback 상태 | `setAppMode`, `enterReplayMode`, `seekTo`, `setPlay` |
| `selectionStore` | 선택된 anomaly / 패널 / 글로벌 cursor | `selectAnomaly`, `selectPanel`, `setGlobalCursor` |
| `streamStore` | 실시간 frame buffer + RAF coalescer + 탐지 결과 | `subscribe`, `pushFrame`, `tickRaf`, `runDetectors` |
| `integrationStore` | MATLAB / LLM / SimDIS / Map / Export jobs | `setLlmState`, `setOfflineAssets` |
| `uiStore` | UI-only preferences (theme, density, dev mode) | `setTheme`, `setDensity`, `setRelationGraphLayout` |

### 핵심 디자인 결정

- **RAF coalescer**: `streamStore.pushFrame` 은 zustand `set()` 을 부르지 않고 모듈 레벨 큐에만 push.
  `tickRaf()` 가 RAF 한 번에 큐를 drain 하고 단일 `set()` 으로 모든 buffer 갱신 → 60 FPS 보장.
- **FlatGridNode**: prototype의 14-cell 12×11 그리드를 1:1 재현하기 위한 escape hatch.
  Slice 2의 drag-to-split은 `cellSubtree?: LayoutNode` 옵셔널 필드로 SplitNode 변환 (path B).

---

## TDD 워크플로

이 프로젝트는 **TDD pure** 원칙을 따릅니다 (Red → Green → Refactor).

```
1. Red:    실패하는 테스트 작성 (vitest run shows ×)
2. Green:  최소한의 코드로 통과 (vitest run shows ✓)
3. Refactor: 중복 제거, 의도 명확화 (테스트는 계속 통과)
```

### 슬라이스 단위 작업

각 user story (`US-X-NNN`) 는 독립적이며 acceptance criteria가 명시되어 있습니다.
PRD 위치: `.omc/prd.json`.

```jsonc
{
  "id": "US-3-001",
  "title": "GlobePanel — 18 satellites + procedural earth + ...",
  "passes": false,                    // 완료 시 true
  "acceptanceCriteria": [
    "SATELLITES.length === 18",
    "Vitest test asserts ...",
    ...
  ]
}
```

---

## 테스트 실행

### 전체 regression (vitest)

```bash
npm test                         # 1회 실행
npm run test:watch               # watch mode
npm run test:coverage            # + c8 커버리지 리포트
```

### 단일 파일

```bash
npx vitest run project/src/panels/globe/GlobePanel.test.tsx
```

### Pattern 매칭

```bash
npx vitest run --grep "Slice 3"
```

### Playwright E2E

```bash
npm run e2e:visual               # 시각 회귀 (스크린샷 비교)
npm run e2e:perf                 # 성능 60 FPS 게이트 (median-of-3)
```

### Rust 테스트

```bash
cargo test --manifest-path project/crates/rti_core/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

### 빌드 검증

```bash
npm run build                    # exit 0 이어야 함
cargo build --manifest-path src-tauri/Cargo.toml  # exit 0
```

---

## 커버리지 게이트

`vitest.config.ts` 에 임계값 설정:

```ts
thresholds: {
  lines: 80,
  branches: 75,
  functions: 80,
  statements: 80,
},
```

신규 TS 파일은 ≥80% line coverage 가 필수.

### Rust coverage (cargo-tarpaulin)

```bash
cargo install cargo-tarpaulin
cargo tarpaulin --manifest-path project/crates/rti_core/Cargo.toml --out Html
```

---

## 코드 스타일

### TypeScript / React

- **Functional components only** (no class components)
- **Named exports** 선호 (default export는 main.tsx 등 진입점만)
- **Zustand selector**: `useStore((s) => s.field)` 형태로 narrow subscription
- **JSDoc**: 파일 상단에 file purpose + acceptance criteria 참조 표기

### 네이밍

| 종류 | 규칙 | 예시 |
|---|---|---|
| Component | PascalCase | `StripChartPanel` |
| Hook | `use` prefix | `useStreamSubscription` |
| Store | `use*Store` | `useWorkspaceStore` |
| Action | camelCase verb | `splitPanel`, `addBindingToPanel` |
| Type | PascalCase | `PanelInstance`, `LayoutNode` |
| Test ID | kebab-case | `data-testid="globe-hud-tl"` |

### Imports 순서

1. 외부 라이브러리 (`react`, `zustand`, `three`)
2. 프로젝트 내 절대 경로 (`../store`, `../types`)
3. 같은 폴더 (`./geometry`)

---

## 기여 절차

1. **이슈 / PRD story 확인**: `.omc/prd.json` 에서 `passes: false` 인 story 또는 GitHub issue 선택
2. **Branch 생성**:
   ```bash
   git checkout -b feature/US-X-NNN-short-description
   ```
3. **TDD**:
   - Red: failing test 추가 → push (CI에서 fail 확인)
   - Green: 최소 구현 → push (CI green)
   - Refactor: 깔끔하게 → push
4. **로컬 게이트 통과 확인**:
   ```bash
   npm test                     # 모든 vitest pass
   npm run build                # exit 0
   cargo build ...              # exit 0
   ```
5. **PR 생성**: PR 본문에 acceptance criteria 체크리스트 포함
6. **Review**: code-reviewer agent + 사람 리뷰 둘 다 받기
7. **Merge**: squash merge 권장 (커밋 hygiene)

### 커밋 메시지

[Conventional Commits](https://www.conventionalcommits.org/) 형식 권장:

```
feat(globe): add procedural earth texture (US-3-001)

- 19 continent meta-blobs + ice caps + 300 city lights
- Bump map with 8 mountain ranges
- All assertions pass: SATELLITES===18, THREATS===7, FRIENDLY===2

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 의문이 생기면

- 우선 [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) 확인
- `.omc/notes/slice*-acceptance-report.md` 에 슬라이스별 evidence 정리
- `public/app/*.jsx` 는 visual reference (직접 변경 X)

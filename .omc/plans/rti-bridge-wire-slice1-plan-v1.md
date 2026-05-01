# RealTimeInsight Bridge-Wire Slice 1 — Implementation Plan v1

- Spec: `.omc/specs/deep-interview-rti-bridge-wire.md` (12 rounds, ambiguity 3.2%)
- Plan author: Planner agent (ralplan consensus, stage 2 of 3)
- Date: 2026-04-27
- Mode: SHORT consensus (DELIBERATE additions appended in §11 because of strict perf gate + zero-existing-Rust scope)
- Decision shorthand: **Path B** (TS module port preserving prototype visuals) + LayoutNode tree backing model + `'workstation-default'` preset + Rust UDP loopback for 10 Mbps PCM

---

## 1. RALPLAN-DR Summary

### 1.1 Principles (load-bearing, in priority order)

1. **The visual prototype at `public/app/` is canonical for look-and-feel; the three spec docs are canonical for contracts.** When they conflict, prototype wins on pixels, spec wins on shape (e.g., spec §7.1 LayoutNode wins over prototype's flat 12-col grid for the *backing model*, but the rendered output of `'workstation-default'` must match the prototype pixel-for-pixel).
2. **TDD is non-negotiable, pure Red→Green→Refactor.** Every new TS/Rust file ships with a failing test first; every PR must pass `vitest run --coverage --coverage.thresholds.lines=80` and `cargo tarpaulin --fail-under 80`. Spec §22 G1–G4 are coverage gates, not aspirations.
3. **Reuse before rewrite.** `project/src/bridge/client.ts`, `project/src/mock/channels.ts`, `project/src/app/App.tsx`'s `fallbackInvoke`, and `public/app/styles.css` are existing assets — they get extended/extracted/imported, not rewritten. Spec §1.2 (assumption #5) makes this explicit.
4. **Offline-first, no CDN.** Replace prototype's `unpkg` imports with npm packages. `@fontsource/ibm-plex-sans` and `@fontsource/jetbrains-mono` instead of Google Fonts. No external map tiles, no babel-standalone runtime. Spec §14, §19.
5. **Subscriptions are owned by `StreamStore`; components subscribe via a hook, never call bridge directly.** This is the firewall that keeps panels mockable, swappable, and prevents 14 panels each opening 14 bridge channels. Spec §8.4.

### 1.2 Decision Drivers (top 3 forces)

1. **Strict perf gate** (60s × 10 Mbps × 0% loss × 60 FPS, spec §22 F1–F4) forces Rust-on-UDP-loopback (no Node sidecar will hit 0% loss at 10 Mbps reliably) AND forces canvas/RAF coalescing in `StreamStore` (no React re-render per sample).
2. **Visual fidelity demand** ("최대한 비주얼 살려달라", Round 1) forces faithful TSX ports of all 13 panel kinds and all 13 modals, plus `styles.css` ported verbatim. The user will diff against prototype, so we keep `public/app/` pristine for comparison.
3. **Zero existing Rust** (Round 5 contrarian discovery) forces a Cargo workspace skeleton + 3 crates from scratch in slice 1, raising scope from "TS-only port" to "TS port + Rust bring-up + cross-process integration." This is why the plan is 13 phases not 6.

### 1.3 Viable Options (most contentious decision: Cargo workspace location)

The deep-interview already locked Path B (Round 1), Rust+UDP (Round 3), TDD-pure (Round 4), Vitest+c8 (Round 6), TS mock source (Round 8), and `LayoutNode + preset` (Round 10). The remaining slice-1 architectural fork is **Cargo workspace location**, which Round 12 deferred to "bundle approve" without explicit ratification.

| Option | Layout | Pros | Cons |
|---|---|---|---|
| **B1 (chosen): `src-tauri/` as Cargo workspace root with `src-tauri/crates/{pcm-generator,pcm-receiver,tauri-shell}`** | Tauri 2 convention; `tauri.conf.json` lives at `src-tauri/`; one workspace = one `Cargo.lock`; `npm run tauri:dev` works out-of-the-box. | Standard Tauri 2 layout. CI caching simple. Spec §1.2 names this exactly. Only one `target/` dir. | All three crates live under `src-tauri/` even though `pcm-generator` is conceptually a sidecar (small cost). |
| **B2: Repo-root `crates/` workspace + thin `src-tauri/`** | `pcm-generator` and `pcm-receiver` live at `crates/`; `src-tauri/` only holds `tauri-shell` + `tauri.conf.json`; root `Cargo.toml` is the workspace. | Cleaner conceptual separation (sidecars vs. shell). Easier to extract `pcm-generator` into a standalone tool later. | Two `Cargo.lock` candidates if not careful; extra path indirection in `tauri.conf.json` for sidecar bundling; spec §1.2 explicitly says workspace lives under `src-tauri/`. |
| B3: Three separate Cargo projects, no workspace | — | None for slice 1. | 3× build time, 3× lockfiles, no cross-crate dev-deps, breaks `cargo test --workspace`. **Invalidated.** |

**Decision: B1.** Spec §1.2 line "located under `src-tauri/` (Tauri 2 convention)" already settles it; B2 is only viable if we later need to publish `pcm-generator` standalone (slice 3+ concern, not slice 1). B3 invalidated on build-time and DX grounds.

---

## 2. Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                       RealTimeInsight Tauri 2 Process                    │
│                                                                          │
│  ┌──────────────────────┐      Rust workspace (src-tauri/crates/)       │
│  │  pcm-generator       │      ─────────────────────────────────         │
│  │  (binary crate)      │ ───► UDP loopback 127.0.0.1:50001              │
│  │  10 Mbps @ 200 Hz    │                                                │
│  │  channel #1001       │             ▲                                  │
│  │  CRC-16 frames       │             │                                  │
│  │  (criterion-bench)   │             │                                  │
│  └──────────────────────┘             │ UDP datagram                     │
│                                       │                                  │
│                          ┌────────────▼────────────┐                     │
│                          │  pcm-receiver           │                     │
│                          │  (lib crate)            │                     │
│                          │  • tokio::UdpSocket     │                     │
│                          │  • frame parser         │                     │
│                          │  • CRC-16 validator     │                     │
│                          │  • bounded mpsc channel │                     │
│                          │  • bitrate meter        │                     │
│                          └────────────┬────────────┘                     │
│                                       │ Sample frames                    │
│                                       │                                  │
│                          ┌────────────▼────────────┐                     │
│                          │  tauri-shell            │                     │
│                          │  (binary, Tauri 2 main) │                     │
│                          │  • #[tauri::command]    │                     │
│                          │    – current_ingest_status                    │
│                          │    – start_managed_receiver_loop              │
│                          │    – managed_receiver_status                  │
│                          │    – drain_managed_receiver_events            │
│                          │    – subscribe_panel_data                     │
│                          │    – live_session_status                      │
│                          │  • emits 'rti://bridge-event'                 │
│                          │  • TS fallback for the rest                   │
│                          └────────────┬────────────┘                     │
│ ═══════════════════════════════════════╪══════════════════════════════════│
│  Tauri ↔ Webview boundary              │ invoke / event                   │
│ ════════════════════════════════════════╪═════════════════════════════════│
│                                       │                                  │
│       Vite + React 18 + TS webview    │                                  │
│  ┌────────────────────────────────────▼────────────────────────────┐    │
│  │  bridge/client.ts (existing, EXTEND)                             │    │
│  │  - createBridgeClient({ invoke }) → strict-typed wrapper         │    │
│  │  - browser dev: invoke = fallbackInvoke (extracted from App.tsx) │    │
│  │  - Tauri dev:   invoke = window.__TAURI__.core.invoke            │    │
│  └────────────────┬─────────────────────────────────────────────────┘    │
│                   │                                                      │
│   ┌───────────────▼────────────────┐                                     │
│   │  StreamStore (Zustand)         │   panelDataRefs map                │
│   │  • subscriptions               │   buffers Map<dataRef, Float64Array>│
│   │  • RAF coalescer (16.7ms tick) │                                    │
│   │  • useStreamSubscription hook  │                                    │
│   └───────────────┬────────────────┘                                    │
│                   │                                                      │
│   ┌───────────────┼─────────────────────────────────────────┐           │
│   │               │                                          │           │
│   │  WorkspaceStore  SessionStore  SelectionStore  Integration│          │
│   │  (LayoutNode)    (mode, time)  (selectedPoint)  Store     │          │
│   └───────────────┬─────────────────────────────────────────┘           │
│                   │                                                      │
│   ┌───────────────▼────────────────────────────────────────────┐         │
│   │  WorkstationLayout (TopBar | Sidebar | DockGrid | Insight | │        │
│   │                     BottomConsole)                          │        │
│   │   └── DockGrid renders 'workstation-default' LayoutNode     │        │
│   │       preset → 14 panels (strip×4, numeric×1, waterfall×1,  │        │
│   │       attitude3d×1, map2d×1, video×1, trajectory3d×1,       │        │
│   │       relationgraph×1, simdisbridge×1, discrete×1,          │        │
│   │       eventlog×1, strip×1)                                  │        │
│   └─────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘

Browser dev mode (npm run dev):
   bus.ts synthesizer @ 30 Hz  ─►  fallbackInvoke('demo_receiver_tick')
                                   ─► same StreamStore path (no real UDP).
```

---

## 3. File Tree

Only slice 1 paths shown. Markers:
- `[NEW]` — file does not exist; create from scratch
- `[PORT from public/app/X]` — TSX port of prototype JSX (visual-faithful)
- `[EXTEND existing]` — add to file already in repo
- `[DELETE]` — remove file (none in slice 1)

```text
RealTimeInsight-main/
├── package.json                                           [EXTEND] add vitest, c8, @fontsource/*, zustand, maplibre-gl, three, @react-three/fiber, jsdom, @testing-library/react, @testing-library/user-event, @vitest/coverage-v8, playwright
├── vitest.config.ts                                       [NEW]   jsdom env, c8 thresholds 80/75, RTL setup
├── playwright.config.ts                                   [NEW]   visual snapshot config (deferred run, scaffolded slice 1)
├── tsconfig.json                                          [EXTEND] strict: true, jsx: 'react-jsx', baseUrl: project/src
├── tsconfig.test.json                                     [NEW]   vitest-specific overrides
├── .omc/plans/rti-bridge-wire-slice1-plan-v1.md           [this file]
│
├── public/                                                [unchanged - kept pristine for visual diff]
│   └── app/                                               (1 9 .jsx + styles.css frozen as design package reference)
│
├── src-tauri/                                             [NEW dir]
│   ├── Cargo.toml                                         [NEW]   workspace = ["crates/*"]
│   ├── tauri.conf.json                                    [NEW]   identifier rti-app, beforeDevCommand "npm run dev"
│   ├── build.rs                                           [NEW]   tauri_build::build()
│   ├── src/main.rs                                        [NEW]   re-exports tauri-shell::run()
│   └── crates/
│       ├── pcm-generator/
│       │   ├── Cargo.toml                                 [NEW]
│       │   ├── src/lib.rs                                 [NEW]   FrameBuilder, sine generator
│       │   ├── src/bin/pcm_gen.rs                         [NEW]   CLI sender
│       │   ├── benches/pcm_throughput.rs                  [NEW]   criterion 60s 10 Mbps
│       │   └── tests/frame_roundtrip.rs                   [NEW]
│       ├── pcm-receiver/
│       │   ├── Cargo.toml                                 [NEW]
│       │   ├── src/lib.rs                                 [NEW]   UdpReceiver, FrameParser, CrcValidator, BitrateMeter
│       │   ├── src/parser.rs                              [NEW]
│       │   ├── src/crc16.rs                               [NEW]
│       │   ├── src/bitrate.rs                             [NEW]
│       │   ├── tests/loopback_integration.rs              [NEW]   spawns generator, asserts 0% loss
│       │   └── tests/crc_failure.rs                       [NEW]
│       └── tauri-shell/
│           ├── Cargo.toml                                 [NEW]
│           ├── src/lib.rs                                 [NEW]   pub fn run()
│           ├── src/commands.rs                            [NEW]   real impls of 5 commands
│           ├── src/state.rs                               [NEW]   Mutex<ReceiverHandle>
│           ├── src/events.rs                              [NEW]   emit rti://bridge-event
│           └── tests/command_contract.rs                  [NEW]   serde round-trip vs schemas.ts
│
├── project/
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx                                    [EXTEND] strip down to 30-line shell wrapping <WorkstationLayout/>; extract fallbackInvoke
│   │   │   ├── main.tsx                                   [EXTEND] mount providers (StoreProvider, ThemeProvider)
│   │   │   └── fallbackInvoke.ts                          [NEW]   extracted from current App.tsx; consumes mock/synthesizer
│   │   │
│   │   ├── bridge/
│   │   │   ├── client.ts                                  [EXTEND] add subscription lifecycle helpers used by StreamStore
│   │   │   ├── schemas.ts                                 [NEW]   port schemas.js → strict TS types (currently re-exports from .d.ts)
│   │   │   └── eventBus.ts                                [NEW]   typed listener for rti://bridge-event
│   │   │
│   │   ├── mock/
│   │   │   ├── channels.ts                                [EXTEND] 10 → 36 channels (port from public/app/data.jsx CHANNELS)
│   │   │   ├── anomalies.ts                               [NEW]   port ANOMALY fixture
│   │   │   ├── events.ts                                  [NEW]   port EVENTS fixture (10 entries)
│   │   │   ├── trackPoints.ts                             [NEW]   port TRACK_POINTS map track
│   │   │   └── synthesizer.ts                             [NEW]   port bus.jsx 30 Hz logic, exposed as iterable for fallbackInvoke
│   │   │
│   │   ├── store/
│   │   │   ├── workspaceStore.ts                          [NEW]   Zustand: LayoutNode tree, panels, presets, dirty
│   │   │   ├── sessionStore.ts                            [NEW]   Zustand: appMode, playback, ingest
│   │   │   ├── selectionStore.ts                          [NEW]   Zustand: selectedChannelIds, selectedPanelId, selectedPoint, globalCursorNs
│   │   │   ├── streamStore.ts                             [NEW]   Zustand + RAF coalescer; owns subscriptions
│   │   │   ├── integrationStore.ts                        [NEW]   Zustand: matlab, llm, simdis, exportJobs, offlineAssets
│   │   │   └── presets/workstationDefault.ts              [NEW]   the 14-panel LayoutNode preset matching public/app/app.jsx INITIAL_PANELS
│   │   │
│   │   ├── hooks/
│   │   │   ├── useStreamSubscription.ts                   [NEW]
│   │   │   ├── useDragChannel.ts                          [NEW]
│   │   │   ├── useDropZone.ts                             [NEW]   5-zone overlay logic
│   │   │   └── useGlobalCursor.ts                         [NEW]
│   │   │
│   │   ├── shell/                                                [PORT from public/app/shell.jsx]
│   │   │   ├── WorkstationLayout.tsx                      [NEW]   top-level grid (TopBar | Sidebar | DockGrid+Insight | BottomConsole)
│   │   │   ├── TopBar.tsx                                 [NEW]   ProjectSelector, ModeSwitch, ReplayControls, ExportMenu, LLMToggle
│   │   │   ├── LeftSidebar.tsx                            [NEW]   ChannelExplorer container
│   │   │   ├── ChannelExplorer.tsx                        [NEW]   search + filter chips + virtualized tree
│   │   │   ├── DockGrid.tsx                               [NEW]   recursive LayoutNode renderer + 5-zone DropOverlay
│   │   │   ├── PanelFrame.tsx                             [NEW]   header / body / footer chrome
│   │   │   ├── InsightPane.tsx                            [NEW]   tabs: root-cause, evidence, llm, tools
│   │   │   └── BottomConsole.tsx                          [NEW]   bitrate, FPS, CRC, alarms
│   │   │
│   │   ├── panels/                                               [PORT from public/app/panels.jsx, panels2.jsx, trajectory.jsx, hexmap.jsx]
│   │   │   ├── strip/
│   │   │   │   ├── StripPanel.tsx                         [NEW]   canvas-based, RAF-driven, decimation
│   │   │   │   └── stripRenderer.ts                       [NEW]   pure render fn (testable without canvas)
│   │   │   ├── numeric/NumericPanel.tsx                   [NEW]
│   │   │   ├── discrete/DiscretePanel.tsx                 [NEW]
│   │   │   ├── eventlog/EventLogPanel.tsx                 [NEW]
│   │   │   ├── map2d/Map2DPanel.tsx                       [NEW]   MapLibre with default basemap (offline tiles slice 3)
│   │   │   ├── video/VideoPanel.tsx                       [NEW]   <video> element with cursor sync (real codec slice 2)
│   │   │   ├── attitude3d/Attitude3DPanel.tsx             [NEW]   three.js + @react-three/fiber
│   │   │   ├── trajectory3d/Trajectory3DPanel.tsx         [NEW]
│   │   │   ├── waterfall/WaterfallPanel.tsx               [NEW]   canvas, mock spectrum from synthesizer
│   │   │   ├── relationgraph/RelationGraphPanel.tsx       [NEW]   force layout (d3-force ok offline)
│   │   │   ├── simdisbridge/SimdisBridgePanel.tsx         [NEW]   uses demoSimdisBridgeStatus (existing)
│   │   │   ├── globe/GlobePanel.tsx                       [NEW]   used by SpaceSheet only
│   │   │   └── gpslos/GpsLosPanel.tsx                     [NEW]   used by GpsLosSheet only
│   │   │
│   │   ├── sheets/
│   │   │   ├── WorkstationSheet.tsx                       [NEW]   live data path; renders DockGrid w/ workstation-default preset
│   │   │   ├── SpaceSheet.tsx                             [PORT from public/app/space.jsx] mock-only
│   │   │   ├── EwSheet.tsx                                [PORT from public/app/ew.jsx] mock-only
│   │   │   └── GpsLosSheet.tsx                            [PORT from public/app/space.jsx GpsSheet] mock-only
│   │   │
│   │   ├── modals/                                              [PORT from public/app/modals.jsx, library.jsx, mapping.jsx, sequence.jsx, streams.jsx]
│   │   │   ├── ExportModal.tsx                            [NEW]   §16 quality policy radio (4 options)
│   │   │   ├── MatlabModal.tsx                            [NEW]
│   │   │   ├── LayoutPresetModal.tsx                      [NEW]
│   │   │   ├── LLMDrawer.tsx                              [NEW]   fixture conversation only
│   │   │   ├── ChannelMappingEditor.tsx                   [NEW]   port mapping.jsx body
│   │   │   ├── StreamConfigModal.tsx                      [NEW]
│   │   │   ├── SequenceValidator.tsx                      [NEW]
│   │   │   ├── TestReportModal.tsx                        [NEW]
│   │   │   ├── RecordingLibrary.tsx                       [NEW]
│   │   │   ├── CommandPalette.tsx                         [NEW]   Ctrl+K
│   │   │   ├── OfflineAssetsDialog.tsx                    [NEW]   E3 placeholder
│   │   │   ├── WorkspaceManagerDialog.tsx                 [NEW]
│   │   │   └── SettingsDialog.tsx                         [NEW]
│   │   │
│   │   └── styles/
│   │       ├── tokens.css                                 [PORT from public/app/styles.css §:root vars]
│   │       └── app.css                                    [PORT from public/app/styles.css remainder]
│   │
│   └── tests/
│       ├── unit/                                          [NEW vitest tests, ~80 files]
│       │   ├── store/workspaceStore.test.ts
│       │   ├── store/streamStore.test.ts
│       │   ├── store/selectionStore.test.ts
│       │   ├── store/sessionStore.test.ts
│       │   ├── store/integrationStore.test.ts
│       │   ├── bridge/client.test.ts
│       │   ├── bridge/schemas.test.ts
│       │   ├── bridge/eventBus.test.ts
│       │   ├── mock/synthesizer.test.ts
│       │   ├── mock/channels.test.ts
│       │   ├── hooks/useStreamSubscription.test.ts
│       │   ├── hooks/useDropZone.test.ts
│       │   ├── shell/ChannelExplorer.test.tsx
│       │   ├── shell/DockGrid.test.tsx
│       │   ├── shell/InsightPane.test.tsx
│       │   ├── panels/strip/StripPanel.test.tsx
│       │   ├── panels/<one .test.tsx per kind>
│       │   ├── modals/ExportModal.test.tsx
│       │   ├── modals/<one .test.tsx per modal>
│       │   └── presets/workstationDefault.test.ts        # asserts 14 panels match prototype layout
│       ├── integration/                                   [NEW + migrated]
│       │   ├── workspace_save_restore.test.ts             # A11/B3
│       │   ├── stream_subscription_lifecycle.test.ts
│       │   ├── anomaly_click_to_insight.test.ts           # A7/C3
│       │   ├── drag_drop_overlay.test.ts                  # A3/C1
│       │   ├── drag_drop_split.test.ts                    # A4/C2
│       │   ├── global_cursor_sync.test.ts                 # C4
│       │   ├── live_to_replay_toggle.test.ts              # A1
│       │   ├── channel_search_filter.test.ts              # A2/E2
│       │   ├── export_quality_policy.test.ts              # A9/D3
│       │   └── (existing project/tests/integration/*.js — kept, unmodified, as documentation/migration)
│       ├── e2e/                                           [NEW playwright, scaffolded only — full run deferred to slice 2]
│       │   └── visual_regression_workstation.spec.ts      # disabled by default; opt-in flag
│       └── perf/
│           └── ui_60fps_check.test.ts                     # F2 — RAF tick budget assertion
```

**Counts:**
- Rust files (new): ~25
- TS source files (new): ~110
- TS test files (new): ~80
- TSX panel ports: 13 + 4 sheets = 17
- TSX modals: 13

---

## 4. Phased Implementation Steps

| # | Phase | Deliverable | Failing tests written first (RED) | Files modified/created | Depends on | Cov target |
|---|---|---|---|---|---|---|
| 0 | Tooling | Vitest + c8 config, Cargo workspace skeleton, package.json scripts (`test`, `test:cov`, `cargo:test`, `bench`) | `vitest run` exits clean on empty suite; `cargo test --workspace` exits clean on empty workspace | `vitest.config.ts`, `tsconfig.test.json`, `src-tauri/Cargo.toml`, `src-tauri/crates/*/Cargo.toml` (empty), `package.json` scripts, `playwright.config.ts` | — | n/a (infra) |
| 1 | Mock data port | All 36 channels + ANOMALY + EVENTS + TRACK_POINTS as TS modules; bus.jsx synthesizer port | `mock/channels.test.ts`: assert 36 channels, all with valid `ChannelSummary` shape (spec §10.1); `mock/synthesizer.test.ts`: 30 Hz tick produces deterministic samples for channel #1001 | `project/src/mock/{channels,anomalies,events,trackPoints,synthesizer}.ts` | 0 | ≥80% |
| 2 | Domain types | `types/domain.ts` (LayoutNode, PanelInstance, PanelBinding, DragChannelPayload, EvidenceNode/Edge, SelectedPoint), `types/panels.ts`, `types/api.ts` | Pure type assertion tests via `expectTypeOf` (vitest-helper); LayoutNode discriminated-union exhaustiveness | `project/src/types/*.ts`, `project/src/bridge/schemas.ts` (port from .js) | 1 | ≥80% (logic in assertion fns) |
| 3 | Stores | All 5 Zustand stores; StreamStore RAF coalescer; useStreamSubscription hook | `workspaceStore.test.ts`: addPanel splits LayoutNode correctly, removePanel collapses empty splits, saveWorkspace round-trips JSON; `streamStore.test.ts`: subscribe→buffer fill→RAF flush coalesces N samples into 1 update; `selectionStore.test.ts`: setSelectedPoint emits to InsightPane subscribers; `sessionStore.test.ts`: appMode toggle resets playback; A1, A11, B3 covered by store tests | `project/src/store/*.ts`, `project/src/hooks/useStreamSubscription.ts` | 1, 2 | ≥80% |
| 4 | Bridge integration | `bridge/client.ts` extension with subscription helpers; `bridge/eventBus.ts` typed listener; `fallbackInvoke.ts` extracted from `App.tsx` | `bridge/client.test.ts`: mocked `invoke` returns valid SubscriptionHandle; client throws on bad shape; `bridge/eventBus.test.ts`: bad event type rejected; `bridge/schemas.test.ts`: port of bridge_schema_test.js to vitest | `project/src/bridge/{client,eventBus,schemas}.ts`, `project/src/app/fallbackInvoke.ts` | 2 | ≥80% |
| 5 | Rust workspace bring-up | `pcm-generator` produces 10 Mbps frames; `pcm-receiver` parses + CRC-validates; `tauri-shell` registers 5 commands as real impls | `pcm-generator/tests/frame_roundtrip.rs`: build 1000 frames, parse them, assert byte-identical; `pcm-receiver/tests/crc_failure.rs`: corrupt 1 bit → CRC rejects; `tauri-shell/tests/command_contract.rs`: each of 5 commands serializes to shape that matches `bridge/schemas.ts` types | `src-tauri/crates/pcm-generator/**`, `src-tauri/crates/pcm-receiver/**`, `src-tauri/crates/tauri-shell/**` | 0 (parallel with phases 1–4) | tarpaulin ≥80% |
| 6 | Cross-process integration & perf bench | UDP loopback test spawns generator + receiver, asserts 0% loss over 5s sample; criterion bench `pcm_throughput` runs 60s @ 10 Mbps | `pcm-receiver/tests/loopback_integration.rs`: 5-second short test (CI), 60s long test (`#[ignore]`, run via `cargo test -- --ignored`); criterion bench gate: `bitrate >= 9.5 Mbps && drop_rate == 0.0` (F1, F3, F4) | `src-tauri/crates/pcm-receiver/tests/loopback_integration.rs`, `src-tauri/crates/pcm-generator/benches/pcm_throughput.rs` | 5 | n/a (perf gate) |
| 7 | Tauri command bindings | Real impls of `current_ingest_status`, `start_managed_receiver_loop`, `managed_receiver_status`, `drain_managed_receiver_events`, `subscribe_panel_data`, `live_session_status`; rest stay as TS fallback objects in `fallbackInvoke.ts` | `tauri-shell/tests/command_contract.rs`: each command's JSON matches `bridge/schemas.ts` discriminated union; integration test in TS: `bridge/client.test.ts` → mocked invoke routes to fallback for unimplemented commands | `src-tauri/crates/tauri-shell/src/commands.rs`, `src-tauri/crates/tauri-shell/src/state.rs` | 5, 6 | tarpaulin ≥80% on Rust; vitest ≥80% on fallbackInvoke |
| 8 | Shell components | TopBar, LeftSidebar (ChannelExplorer with virtualized list), DockGrid, InsightPane, BottomConsole, PanelFrame | `ChannelExplorer.test.tsx`: typing 'voltage' filters list (A2); virtualized list mounts only visible rows (E2); `DockGrid.test.tsx`: renders LayoutNode tree, drop on edge calls `addSplit` action (A4/C2); `InsightPane.test.tsx`: setSelectedPoint updates Root Cause tab (A7/C3); `BottomConsole.test.tsx`: bitrate readout reflects ingest store | `project/src/shell/*.tsx`, `project/src/styles/{tokens,app}.css` | 1–4 | ≥80% |
| 9 | Panel TSX ports (13 kinds) | strip, multi-strip variant, numeric, discrete, eventlog, map2d (MapLibre), video, attitude3d (R3F), trajectory3d, waterfall, relationgraph (d3-force), simdisbridge, globe, gpslos | One `.test.tsx` per kind asserting (a) renders given empty bindings (b) renders given one binding (c) panel-local state is isolated (E1) (d) Strip overlays 2 channels when 2 bindings present (C1); Playwright snapshot test scaffolded for visual diff vs `public/app/` rendering of same panel | `project/src/panels/<kind>/*Panel.tsx` | 1–4, 8 | ≥80% (logic via extracted renderer fns; canvas via Playwright) |
| 10 | Sheet routing + workstation-default preset | 4 sheets switchable in TopBar; `WorkstationSheet` uses live `StreamStore` data path for #1001 + mock for the rest 13 panels; preset reproduces prototype's 14-panel grid via 2-level LayoutNode splits | `presets/workstationDefault.test.ts`: tree has 14 panels, leaves match prototype (panel.id, kind, bindings) for all of p1..p13; `WorkstationSheet.test.tsx`: mounting renders 14 panel frames; `SpaceSheet.test.tsx`/`EwSheet.test.tsx`/`GpsLosSheet.test.tsx`: each renders without crash from mock data only (A5, A6, D2) | `project/src/sheets/*.tsx`, `project/src/store/presets/workstationDefault.ts` | 3, 8, 9 | ≥80% |
| 11 | Modals (13) | All modal TSX ports; ExportModal exposes 4 quality policies (A9/D3); MatlabModal scaffolded shell (A10); OfflineAssetsDialog placeholder (A12/E3); CommandPalette Ctrl+K | `ExportModal.test.tsx`: each radio sets `qualityPolicy` correctly, submit calls bridge.exportData mock; `MatlabModal.test.tsx`: render + present mode; `CommandPalette.test.tsx`: Ctrl+K opens; `OfflineAssetsDialog.test.tsx`: render placeholder | `project/src/modals/*.tsx` | 8 | ≥80% |
| 12 | E2E acceptance verification | Vitest integration suite covering all spec §22 items A1–A12, B1–B3, C1–C4, D1–D3, E1–E3 (see §5 mapping); Strict perf gate (F1–F4) wired into CI script | `tests/integration/*.test.ts` (10 files in §3 file tree); CI script `scripts/check-perf.mjs` parses criterion output, fails build if bitrate <9.5 Mbps or drop_rate >0 | `project/tests/integration/*.test.ts`, `scripts/check-perf.mjs`, `.github/workflows/ci.yml` (or local CI runner doc if no GH) | 1–11 | ≥80% (overall gate) |
| 13 | Visual regression scaffolded | Playwright config + 1 baseline test against prototype-rendered HTML; full run flagged opt-in for slice 1 | `tests/e2e/visual_regression_workstation.spec.ts`: navigate to `npm run dev`, snapshot DockGrid, compare to `public/app/index.html` rendered baseline; **disabled by default**, runnable via `npm run e2e:visual` | `tests/e2e/visual_regression_workstation.spec.ts`, `playwright.config.ts` | 10 | n/a (visual gate) |

**Phase ordering rationale:** 0→1→2→3→4 is a strict TS chain. Phase 5 (Rust) starts in parallel with phase 1 since it has no TS dependency. 6 depends on 5. 7 depends on 5+6. 8 depends on 1–4. 9 depends on 1–4 and 8. 10 stitches 3+8+9. 11 is parallel-able with 9 once 8 lands. 12 is the integration gate. 13 is the visual gate. Realistic critical path: 0 → (1‖5) → (2‖6) → (3‖7) → 4 → 8 → 9 → 10 → 11 → 12 → 13.

---

## 5. Acceptance Mapping (Spec §22 ↔ Test Locations)

| ID | Criterion | Test file : test name | Phase |
|---|---|---|---|
| A1 | Live/Replay 토글이 SessionStore.appMode를 변경 | `tests/integration/live_to_replay_toggle.test.ts : "TopBar mode switch updates SessionStore.appMode"` | 12 |
| A2 | ChannelExplorer 'voltage' 검색 시 매칭만 표시 | `tests/unit/shell/ChannelExplorer.test.tsx : "filters channels by 'voltage' substring (case-insensitive)"` | 8 |
| A3 | 채널 → Strip 패널 중앙 드래그 시 overlay 추가 | `tests/integration/drag_drop_overlay.test.ts : "channel drop on strip panel center adds binding"` | 12 |
| A4 | 채널 → 패널 가장자리 드래그 시 LayoutNode split | `tests/integration/drag_drop_split.test.ts : "channel drop on right edge produces SplitNode horizontal"` | 12 |
| A5 | workstation-default 프리셋 14패널 동시 렌더 | `tests/unit/presets/workstationDefault.test.ts : "produces LayoutNode tree with 14 panel leaves matching prototype"` + `tests/unit/sheets/WorkstationSheet.test.tsx : "mounts 14 PanelFrame nodes"` | 10 |
| A6 | 13 패널 종류 모두 슬라이스 1 최소 UI | `tests/unit/panels/<kind>/<Kind>Panel.test.tsx : "renders without crash with empty bindings"` × 13 | 9 |
| A7 | 이상점 클릭 → InsightPane 갱신 | `tests/integration/anomaly_click_to_insight.test.ts : "EventLog row click updates SelectionStore.selectedAnomalyId and InsightPane root-cause tab"` | 12 |
| A8 | RelationGraph 패널 존재 | `tests/unit/panels/relationgraph/RelationGraphPanel.test.tsx : "renders force layout with mock evidence graph"` | 9 |
| A9 | Export modal quality policy 4-way 선택 | `tests/unit/modals/ExportModal.test.tsx : "qualityPolicy radio cycles keep-all/good-crc-only/decode-valid-only/split-by-quality"` | 11 |
| A10 | MATLAB handoff modal 존재 | `tests/unit/modals/MatlabModal.test.tsx : "renders preset list and submit button"` | 11 |
| A11 | Workspace 저장 후 reload 시 LayoutNode 동일 복원 | `tests/integration/workspace_save_restore.test.ts : "WorkspaceStore.saveWorkspace + loadWorkspace round-trips LayoutNode tree"` | 12 |
| A12 | Offline asset state UI 존재 | `tests/unit/modals/OfflineAssetsDialog.test.tsx : "renders airgapped/offline-preferred/online-allowed states"` | 11 |
| B1 | 패널 생성/분할/닫기/저장 | `tests/unit/store/workspaceStore.test.ts : "addPanel/splitPanel/removePanel/saveWorkspace"` (4 tests) | 3 |
| B2 | 채널 드래그 앤 드롭 | covered by A3+A4 | 12 |
| B3 | Workspace 복원 후 동일 배치 | covered by A11 | 12 |
| C1 | Strip 패널 2+ 채널 overlay | `tests/unit/panels/strip/StripPanel.test.tsx : "renders 2 channel series in overlay mode"` | 9 |
| C2 | Edge drop으로 split | covered by A4 | 12 |
| C3 | 이상점 클릭 시 InsightPane 갱신 | covered by A7 | 12 |
| C4 | Global cursor 동기화 (5 panel kinds) | `tests/integration/global_cursor_sync.test.ts : "updating SelectionStore.globalCursorNs propagates to Strip/Map2D/Video/EventLog/RelationGraph subscribers"` | 12 |
| D1 | Boot 시 mock으로 즉시 렌더 | `tests/unit/sheets/WorkstationSheet.test.tsx : "renders 14 panels with mock-only data when bridge unavailable"` | 10 |
| D2 | 최소 3종 패널 mock 렌더 | covered by A6 (13 kinds, ≥3) | 9 |
| D3 | Export dialog mock 모드 동작 형태 표시 | covered by A9 | 11 |
| E1 | 패널 리렌더 회피 | `tests/unit/panels/strip/StripPanel.test.tsx : "memoized: changing other panel props does not re-render"` (uses React render counter) | 9 |
| E2 | 1만+ 채널 검색 (slice 1: 36 mock + virtualization library) | `tests/unit/shell/ChannelExplorer.test.tsx : "virtualized list mounts only visible rows when given 10000-channel synthetic dataset"` | 8 |
| E3 | Airgapped/offline UI 모드 토글 | covered by A12 | 11 |
| F1 | cargo bench 60s 10 Mbps 0% loss | `src-tauri/crates/pcm-generator/benches/pcm_throughput.rs : criterion bench "pcm_60s_10mbps"` + `scripts/check-perf.mjs` gate | 6, 12 |
| F2 | UI 60 FPS @ Workstation + live #1001 | `tests/perf/ui_60fps_check.test.ts : "Workstation sheet maintains avg frame ≤16.7ms over 1s sample"` (jsdom + RAF mock + StreamStore real) | 12 |
| F3 | BottomConsole bitrate 9.5–10.5 Mbps | `tests/integration/bitrate_readout.test.ts : "BottomConsole bitrate text falls in [9.5, 10.5] Mbps when receiver running"` | 12 |
| F4 | CRC fail rate < 0.1% | covered by F1 (criterion bench asserts) | 6 |
| G1 | TS c8 line cov ≥80% | CI gate `vitest run --coverage --coverage.thresholds.lines=80` | 0, 12 |
| G2 | Rust tarpaulin cov ≥80% | CI gate `cargo tarpaulin --workspace --fail-under 80` | 5, 12 |
| G3 | First commit RED, then RED/GREEN explicit | git history check; commit msgs prefixed `[RED]` or `[GREEN]` | all phases |
| G4 | 새 production 코드 라인은 동일 PR 안의 테스트 cover | `vitest run --coverage` CI gate per PR | 0, 12 |

---

## 6. ADR — Architecture Decision Record

### Decision

Adopt **Path B**: port `public/app/*.jsx` (babel-standalone, 11.2k LOC across 19 files + 1.7k LOC styles.css) to a TypeScript module architecture under `project/src/`, backed by a recursive `LayoutNode` tree (spec §7.1) with a `'workstation-default'` preset that reproduces the prototype's 14-panel flat grid. Wire the first Strip panel's Power Bus Voltage channel (#1001) to a real Rust + Tauri 2 + UDP loopback PCM ingest at 10 Mbps. Keep the remaining 13 panels and the 3 non-Workstation sheets reading from in-memory mock (the prototype's `bus.jsx` synthesizer ported to TS).

### Drivers (in order)

1. **TDD requirement** (spec §1 G1–G4) — babel-standalone runtime cannot be type-checked or unit-tested with reasonable coverage tooling.
2. **Type safety** (spec §10–§11 contracts) — domain types must be enforceable at compile time so panel/store/bridge boundaries don't drift.
3. **Spec compliance** (spec §22) — 30+ acceptance criteria require structured stores, bridge contract, and quality gates that the JSX prototype does not enforce.
4. **Visual fidelity user demand** ("최대한 비주얼 살려달라", Round 1) — port must preserve warm-graphite + amber theme, IBM Plex + JetBrains Mono fonts, exact panel arrangement, and 4-sheet topology.
5. **Strict perf bar** (Round 11) — 60s × 10 Mbps × 0% loss is achievable only with a Rust UDP path; Node sidecars and fixture files are invalidated.

### Alternatives Considered

- **Path A (babel-standalone runtime preserved + bridge added):** invalidated in Round 1. Cannot reach 80% TS coverage; type safety zero; prototype's `unpkg` CDN imports violate spec §14 (offline-first) and §19 (airgap).
- **Path C (hybrid: keep JSX for visual demo, add TS shell separately):** invalidated in Round 1. Doubles maintenance, runtime ambiguity, and prevents store/bridge integration. The visual demo would diverge from production code path within weeks.
- **Path D (rebuild from scratch, ignore prototype):** invalidated in Round 1. Discards 11k LOC of vetted visual design; user explicitly said "최대한 비주얼 살려달라."
- **Mock data as JSON (spec §18 default):** invalidated in Round 8. TS source files give compile-time type checking, IDE autocomplete, and import deduplication that JSON loaders cannot.
- **`*_test.js` Node harness (status quo):** invalidated in Round 6. Cannot test React components, no jsdom, no RTL, no coverage thresholds.
- **Rust scope deferred (Round 5 contrarian):** invalidated when discovery revealed `src-tauri/`, `crates/`, `runtime/` directories all empty. Slice 1 must include Rust bring-up.
- **Flat 12-col grid backing model (drop spec §7.1 LayoutNode):** invalidated in Round 10. Spec compliance + future drag-split UX (A4) demand a recursive tree. The flat-grid look is preserved as a *preset* expressed via 2-level splits.

### Why Chosen (ranked rationale)

1. Only path satisfying all of: TDD purity (G1–G4), spec contracts (§10–§11), visual fidelity, and offline-first.
2. Existing assets (`bridge/client.ts`, `mock/channels.ts`, `App.tsx fallbackInvoke`, `styles.css`) are reusable on this path; sunk cost is recovered.
3. Rust workspace at `src-tauri/` is Tauri 2 idiomatic; CI/dev tooling (`tauri dev`, `tauri build`) works without custom adapters.
4. LayoutNode + preset gives us *both* spec compliance *and* prototype-pixel-faithful rendering — a strict superset of either alone.

### Consequences

**Positive:**
- Testability: every store and panel has unit tests; coverage gated in CI.
- Refactor safety: TypeScript catches breaking changes across 5 stores × 13 panel kinds × 13 modals.
- Offline-first: no CDN dependencies; airgap-deployable from day 1.
- Slice-2 momentum: real LLM, replay, multi-monitor, etc. all bolt onto stable contracts.

**Negative:**
- **Porting effort: ~3–5 weeks of focused work** for slice 1 (~110 new TS files + 25 Rust files + 80 test files). Concretely, a 5-7 person-week budget for one strong full-stack engineer or 3-4 weeks for a 2-engineer pair (one TS, one Rust).
- **Double-maintenance during transition:** while slice 1 is in progress, prototype `public/app/` remains the only running visual. We lock it (no edits) to keep diff-comparison meaningful.
- **Visual regression risk:** the `'workstation-default'` preset rendering must match the prototype's flat-grid layout pixel-faithfully; this is the failure mode that demands phase 13's Playwright gate.
- **Performance discipline:** RAF coalescing in StreamStore is non-trivial — get it wrong and 14 panels with live data will tank below 60 FPS. Phase 12's F2 test catches this.

### Follow-ups (slice 2+)

- Replay mode (load recorded raw/decoded data, scrub timeline) — spec Non-Goal item 2.
- Real LLM provider with local Ollama/Gemma — Non-Goal 4.
- E2E test layer in `tests/e2e/` (full Playwright run, not just visual snapshots) — Non-Goal 5.
- Multi-monitor / pop-out windows — Non-Goal 6.
- Workspace import/export to file — Non-Goal 7.
- Real offline map tile cache — Non-Goal 8.
- Full IRIG channel mapping editor — Non-Goal 9.
- Port `hexmap.jsx` and `rf.jsx` to TSX — Non-Goal 10.
- Real anomaly detection (replace static fixture) — Non-Goal 3.
- Real Tauri impl of remaining 18 commands (export_demo_csv, validate_demo_llm_answer, demo_root_cause_candidates, build_demo_ollama_request, runtime_asset_inventory, demo_simdis_bridge_status, demo_video_sync_event, prepare_demo_matlab_handoff, enqueue_demo_matlab_job, enqueue_demo_llm_job, list_jobs, mark_job_*, demo_panel_stream_event, demo_receiver_tick, supported_panel_schemas, start_live_session, stop_live_session, init_demo_receiver_session) — Non-Goal 1.

---

## 7. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Babel-CDN → npm migration breaks visual fidelity.** Color tokens, spacing, font metrics shift subtly during port. | Medium | High (user-facing) | Keep `public/app/` pristine; freeze it as the visual-diff oracle. Phase 13 Playwright snapshot test against pixel-rendered prototype. Use `@fontsource/*` packages instead of Google Fonts to keep font-rendering identical. Port `styles.css` byte-for-byte first; verify in browser dev mode before TSX components consume tokens. |
| R2 | **Rust UDP packet loss under load.** 10 Mbps sustained for 60s with 0% loss is tight on a dev laptop with default kernel buffers. | Medium | High (perf gate fail) | Use `tokio::net::UdpSocket` with `setsockopt SO_RCVBUF` to 8 MiB. Receiver consumes datagrams into a `tokio::sync::mpsc::channel(capacity=4096)` so parser back-pressure cannot drop UDP. Bench gate runs criterion 60s twice in CI; first run warms caches, second is the assertion. If still flaky, drop to 30s in CI but require 60s manual run before slice-1 sign-off. |
| R3 | **LayoutNode preset doesn't visually match flat grid prototype.** Translating `gx/gy/gw/gh` into 2-level splits produces near-but-not-pixel-identical layout. | High | Medium | Phase 10 includes a unit test that asserts the preset reproduces *every panel's* `(col_start, row_start, col_span, row_span)` from prototype's `INITIAL_PANELS`. Express the prototype's 12-col layout as: outer split = horizontal 5/4/3 ratio for top row, then nested vertical splits for stacked panels, etc. Confirm with phase 13 Playwright pixel-diff (≤2px tolerance). |
| R4 | **60 FPS UI under live data + canvas charts.** 14 panels each redrawing per StreamStore update will not hold 60 FPS even at modest rates. | High | High (F2 gate) | StreamStore must coalesce events via single global `requestAnimationFrame` tick — buffer N samples into Float64Array, flush once per RAF. Panels subscribe to `panelDataRefs` (not raw subscriptions) so React re-renders happen ≤1×/frame. `React.memo` + `useMemo` per panel. Strip canvas draws directly from buffer ref, never via React state. Phase 9 test asserts panel does not re-render when *other* panels update. Phase 12 F2 test runs 1s of synthetic 200 Hz updates and asserts avg frame ≤16.7ms. |
| R5 | **80% coverage on TSX components is hard for canvas-heavy panels.** Canvas rendering is opaque to jsdom; Strip/Waterfall/Attitude3D have most logic in render fns. | Medium | Medium (G1 gate) | Extract render logic into pure functions (`stripRenderer.ts`, `waterfallRenderer.ts`) that accept `(ctx, data, options)` and return nothing — these get unit-test coverage via mocked `CanvasRenderingContext2D`. The TSX wrapper is ~30 LOC of `useEffect` + canvas ref + RAF subscription, easy to cover. Three.js panels: extract scene-builder fn, test it in isolation; the `<Canvas>` mount itself is tested only for "does not throw." Visual correctness gated by phase 13 Playwright. |

---

## 8. Test Strategy

### 8.1 TS test stack (Vitest + c8)

- Runner: `vitest run` (CI) and `vitest` (watch).
- Env: `jsdom` for component tests; `node` for store/bridge/mock unit tests.
- Component lib: `@testing-library/react` + `@testing-library/user-event`.
- Coverage: `@vitest/coverage-v8` with thresholds `lines: 80, branches: 75, functions: 80, statements: 80`. Branches at 75 because some discriminated-union exhaustive switches inflate branch count harmlessly.
- Mocks: hand-rolled mocks in `tests/__mocks__/` for `__TAURI__`, MapLibre, three.js Canvas. No `vi.mock` of own modules unless absolutely needed.
- Setup: `tests/setup.ts` configures jsdom RAF polyfill, IBM Plex font-face fallback (`document.fonts.ready` immediately), and `ResizeObserver` mock.
- Migration: keep `project/tests/*_test.js` files unmodified under `project/tests/integration/legacy/` as documentation; `npm test` runs vitest, `npm run test:legacy` runs the old node harness.

### 8.2 Rust test stack (cargo + criterion + tarpaulin)

- Unit: `cargo test --workspace` runs every crate's `#[test]` and `tests/*.rs`.
- Perf: `cargo bench --bench pcm_throughput` runs criterion. Output JSON parsed by `scripts/check-perf.mjs` (Node), which fails CI if `mean_bitrate_mbps < 9.5` or `dropped_frames > 0`.
- Long perf: `loopback_integration::test_60s_10mbps` is `#[ignore]` by default; CI's nightly job runs `cargo test -- --ignored`. Per-PR job runs the 5s variant (`test_5s_10mbps`).
- Coverage: `cargo tarpaulin --workspace --fail-under 80 --out Xml` for CI.

### 8.3 Visual regression (Playwright, scaffolded)

- `playwright.config.ts` configured for desktop Chromium @ 1920×1080, no headed mode in CI.
- One spec file: `tests/e2e/visual_regression_workstation.spec.ts` boots `npm run dev`, navigates to `http://127.0.0.1:5173/`, screenshots the DockGrid, compares to baseline `tests/e2e/__snapshots__/workstation-default.png`.
- Baseline image is generated *once* by rendering `public/app/index.html` (the prototype) to a PNG via Playwright. Stored in repo.
- Default tolerance: 2 px diff (anti-aliasing tolerance). `npm run e2e:visual` runs it; not part of `npm test` to keep PR feedback fast.

### 8.4 CI gate composite

```
1. npm install                              # cache by package-lock hash
2. npm run lint                             # eslint + tsc --noEmit
3. npm run test:cov                         # vitest run --coverage --coverage.thresholds.lines=80
4. cargo test --workspace                   # short tests
5. cargo bench --bench pcm_throughput -- --output-format=json | node scripts/check-perf.mjs
6. cargo tarpaulin --workspace --fail-under 80
7. (nightly only) cargo test -- --ignored   # 60s perf
8. (manual) npm run e2e:visual              # Playwright pixel diff
```

PR is blocked if any of 2–6 fail.

### 8.5 Performance gate concrete numbers

- Phase 6 / criterion: `pcm_60s_10mbps` bench publishes `mean_bitrate_mbps`, `dropped_datagrams`, `crc_failures`, `mean_parse_latency_us`. Gate: `mean_bitrate_mbps ∈ [9.5, 10.5]`, `dropped_datagrams == 0`, `crc_failures == 0`.
- Phase 12 / F2: vitest `tests/perf/ui_60fps_check.test.ts` mocks RAF, simulates StreamStore `flushSamples()` 60 times in 1 simulated second, asserts no flush callback exceeds 16.7ms wall-clock budget under jsdom.

---

## 9. Open Questions for Architect/Critic

1. **Cargo workspace location B1 vs B2** — locked to B1 in §1.3, but if Architect prefers B2 (cleaner sidecar separation for slice 3+ extraction), a one-line change to `Cargo.toml` workspace scope is cheap. Spec §1.2 supports B1; flagging because the cost-of-change rises sharply once `tauri.conf.json` references sidecar binaries.
2. **State management library: Zustand vs alternatives** — spec doesn't pin one; `executor` was given latitude per spec §1.2 last bullet of Cargo Workspace section. Plan assumes Zustand for: small bundle, no provider boilerplate, good with non-React StreamStore consumers. If Architect prefers Jotai (atomic), Redux Toolkit (mature), or Valtio (proxy), the abstraction surface in `store/*.ts` is small enough to swap. Risk: changing this after phase 3 lands is expensive.
3. **Three.js vs raw WebGL for Attitude3D / Trajectory3D** — plan uses `three` + `@react-three/fiber`. Bundle size concern (~150 KB gzipped). Alternatives: raw WebGL (smaller, much more code), or skip 3D in slice 1 and ship placeholder 2D panels (but A6 demands "all 13 panel kinds minimal UI"). R3F chosen for development velocity.
4. **MapLibre default basemap with no internet** — spec §14 forbids CDN tiles. Slice 1 ships MapLibre with a 1×1-pixel transparent fallback style + the prototype's mock track lines drawn over a solid color. Real offline tile pack is slice 3 (Non-Goal 8). Architect may want a more visible "no map data" state — flagging.
5. **Coverage exclusions** — should `project/src/types/*.ts` count toward the 80% denominator? They have no executable code; including them tanks the metric. Plan excludes `**/*.d.ts` and `**/types/*.ts` from c8 reports. If Critic objects, exclusion list is in `vitest.config.ts`.
6. **Time budget for slice 1** — 3-5 week estimate assumes one strong full-stack engineer. If team size is 2-3, parallel phases (1‖5, 9‖11) compress to ~2-3 weeks. Plan does not pin a calendar date because deep-interview Round 12 explicitly didn't ask. Architect/user should confirm.
7. **Existing `project/tests/integration/*_test.js` files (24 files)** — plan demotes them to "documentation/migration scripts under `legacy/`." Some (e.g., `external_runtime_runbook_test.js`, `readiness_bundle_test.js`) test runbook docs that may still be enforceable. Recommend a one-pass review by Critic to identify any that should be ported to vitest rather than retained as legacy.

---

## 10. Plan Summary (for the consensus pipeline)

- **Plan file:** `C:\jkim\RealTimeInsight-main\.omc\plans\rti-bridge-wire-slice1-plan-v1.md`
- **Phases:** 14 (phase 0 tooling + phases 1–13 implementation/verification)
- **Total acceptance criteria mapped:** 30 (A1–A12, B1–B3, C1–C4, D1–D3, E1–E3, F1–F4, G1–G4)
- **New files:** ~110 TS source + ~80 TS test + ~25 Rust + ~30 modal/sheet ports + 17 panel ports
- **Effort estimate:** 3–5 person-weeks for one strong full-stack engineer, or 2-3 weeks for 2-engineer pair (TS + Rust)

---

## 11. DELIBERATE Mode Additions

Although the deep-interview marked this as a SHORT consensus pass, the strict perf gate (F1–F4) plus zero-existing-Rust scope warrants pre-mortem and expanded test plan now to avoid backtracking after Architect/Critic review.

### 11.1 Pre-mortem (3 failure scenarios)

**Scenario A — "We shipped slice 1 and the demo is at 35 FPS not 60."**
- Root cause: 14 React panels each subscribing to StreamStore via individual `useSyncExternalStore`, every sample triggers per-panel reconciliation.
- Why it happened: `useStreamSubscription` hook took the easy path with one selector per channel; RAF coalescing was added to the buffer fill but not to the React notify path.
- Mitigation now: phase 3 unit test for StreamStore must include "subscribe with 14 different panels, push 200 samples, assert exactly 1 React notification per RAF tick." Phase 12 F2 test catches it at integration time. The notify path uses a single `notifyListeners()` called from the RAF coalescer; per-panel selectors compute on read, not on push.

**Scenario B — "Cargo bench is green but `npm run tauri:dev` drops every 10th frame."**
- Root cause: criterion bench measures generator→receiver in-process; the Tauri shell adds command-channel + IPC + JSON serialization overhead, bottleneck moves there.
- Why it happened: the perf gate tested only the Rust loopback, not the end-to-end Rust→Tauri→Webview→StreamStore path.
- Mitigation now: phase 12 adds an end-to-end integration test in `tests/integration/end_to_end_bitrate.test.ts` that boots Tauri dev (or a thin harness importing `tauri-shell::run`), starts the receiver, drains events for 30s via `bridge.drainManagedReceiverEvents()`, computes observed bitrate at the StreamStore output, and asserts ≥9.5 Mbps. This is in addition to F1's pure-Rust gate.

**Scenario C — "Phase 13 visual regression keeps failing because fonts render slightly differently in Chromium-headless vs prototype's Chromium."**
- Root cause: font-rendering is platform/version-sensitive even with `@fontsource` packages; baseline screenshot taken on dev laptop, CI runs on a different OS.
- Why it happened: assumed `@fontsource` would produce byte-identical text rendering across machines.
- Mitigation now: phase 13 baseline is generated *in CI itself* on the first `e2e:visual` run and cached as an artifact. PRs compare to the cached baseline. Tolerance bumped to 5 px for text-heavy regions, 2 px elsewhere. If still flaky, downgrade phase 13 from a CI gate to an opt-in nightly check (it's already opt-in in §8.4).

### 11.2 Expanded test plan (unit / integration / e2e / observability)

| Layer | Coverage | Tools | Gate |
|---|---|---|---|
| **Unit (TS)** | Stores, hooks, mock data, bridge schemas, render fns | Vitest + c8 | ≥80% lines (G1) |
| **Unit (Rust)** | FrameBuilder, FrameParser, Crc16, BitrateMeter, command serializers | cargo test + tarpaulin | ≥80% lines (G2) |
| **Component (TS)** | Each shell + panel + modal renders, handles user input, propagates state | Vitest + jsdom + RTL + user-event | covered by ≥80% gate |
| **Integration (TS)** | Full app boot, drag-drop overlay, drag-drop split, anomaly→insight, save/restore, mode switch, channel search, export quality policy, global cursor sync, bitrate readout | Vitest + jsdom + mocked Tauri + real synthesizer | all of §5 spec §22 items pass |
| **Integration (Rust)** | Generator→Receiver UDP loopback (5s short, 60s long-ignored), CRC failure path, bitrate meter accuracy, command contract round-trip | cargo test + cargo test --ignored | 0% loss, CRC <0.1% |
| **E2E (cross-stack)** | Tauri shell boot → receiver event → StreamStore → BottomConsole bitrate readout | custom harness in `tests/integration/end_to_end_bitrate.test.ts` (not Playwright, uses real bridge against a spawned tauri-shell binary) | ≥9.5 Mbps observed at StreamStore output |
| **Visual** | DockGrid 14-panel layout pixel-diff vs prototype | Playwright | opt-in; failure does not block PR in slice 1 |
| **Performance** | RAF tick budget, criterion bench | Vitest perf, criterion | 16.7ms / frame avg, 9.5–10.5 Mbps, 0 dropped |
| **Observability (manual)** | Phase 12 produces a `slice-1-acceptance-report.md` listing every spec §22 item with PASS/FAIL status and links to the test that proves it | script `scripts/build-acceptance-report.mjs` parses vitest JSON output + criterion JSON + tarpaulin XML | manual review before slice 1 sign-off |

### 11.3 Rollback plan

If slice 1 cannot meet F1–F4 gates within 5 weeks: relax F1 from "60s 10 Mbps 0% loss" to "30s 5 Mbps <0.5% loss" *only on the `slice-1-tier-2` branch*, ship that as a tech preview, and continue work on the strict bar in `slice-1-tier-1` branch. User must sign off on the relaxation explicitly. Spec §22 F-series criteria do not allow silent relaxation.

---

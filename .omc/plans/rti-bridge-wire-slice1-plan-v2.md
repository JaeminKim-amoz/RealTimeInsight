# RealTimeInsight Bridge-Wire Slice 1 — Implementation Plan v2

- Spec: `.omc/specs/deep-interview-rti-bridge-wire.md` (12 rounds, ambiguity 3.2%)
- v1 plan (returned UNSOUND): `.omc/plans/rti-bridge-wire-slice1-plan-v1.md`
- Architect review v1: `.omc/plans/rti-bridge-wire-slice1-architect-review-v1.md`
- Plan author: Planner agent (ralplan consensus, stage 2 of 3, iteration 2)
- Date: 2026-04-27
- Mode: SHORT consensus + DELIBERATE additions retained from v1 (§11)
- Decision shorthand: **Path B** (TS module port preserving prototype visuals) + LayoutNode tree backing model with **`FlatGridNode` escape hatch** + `'workstation-default'` preset + **extension of existing `rti_core::pcm`** with a generator submodule for the 10 Mbps PCM path

---

## 0. Why this is v2

The Architect verdict on v1 was **UNSOUND**. The decisive finding: the deep-interview Round 5 "contrarian discovery" claim of "zero existing Rust" was **factually wrong**. The repository already contains substantial Rust under `project/`:

- `project/src-tauri/Cargo.toml` — Tauri 2 binary depending on `rti_core` via `path = "../crates/rti_core"`. No `[workspace]` table — single-project Cargo layout.
- `project/src-tauri/src/main.rs` (≈1000 LOC) — registers 27 `#[tauri::command]` impls including `current_ingest_status`, `subscribe_panel_data`, `start_managed_receiver_loop`, `stop_managed_receiver_loop`, `managed_receiver_status`, `drain_managed_receiver_events`, `live_session_status`, `start_live_session`, `stop_live_session`, `init_demo_receiver_session`, `export_demo_csv`, `write_demo_csv_export`, `demo_panel_stream_event`, `demo_receiver_tick`, plus 13 more.
- `project/crates/rti_core/src/` — 21 modules (`assets, bridge, data_ref, export, graph, ingest, jobs, lib, llm, matlab, mission_edge, pcm, replay, runtime_policy, simdis, stream, video`).
- `project/crates/rti_core/tests/` — 31 test files including `pcm_throughput_smoke.rs` (already enables 10/20/30 Mbps profiles), `datagram_throughput_smoke.rs`, `datagram_soak_smoke.rs`, `multi_rate_soak_smoke.rs`, `pcm_decode.rs`, `pcm_sync_scan.rs`, `pcm_performance.rs`, `udp_receiver.rs`, `managed_receiver_loop.rs`, `bridge_contract.rs`.

The Rust pipeline (UDP receiver → frame parse → CRC → PCM decode → sample store → panel event batch → bridge emit) is therefore essentially complete. The five "bridge-wired" Tauri commands the spec singles out for slice 1 already exist and emit `BridgeEvent::PanelStreamData`. v1's phases 5/6/7 were greenfield-styled and would have duplicated this work.

**v2 corrects all 10 required revisions** from architect-review-v1 §6 and adopts §7 architect open-question recommendations as locked decisions (no re-debate).

---

## 1. RALPLAN-DR Summary

### 1.1 Principles (load-bearing, in priority order)

1. **The visual prototype at `public/app/` is canonical for look-and-feel; the three spec docs are canonical for contracts.** When they conflict, prototype wins on pixels, spec wins on shape — except for the prototype's heterogeneous flat 12-col grid, which slice 1 ships as-is via `FlatGridNode` (see §1.4 driver reframing).
2. **TDD is non-negotiable, pure Red→Green→Refactor.** Every new TS file ships with a failing test first; every PR must pass `vitest run --coverage --coverage.thresholds.lines=80`. Existing Rust under `project/crates/rti_core/` is grandfathered at its current coverage level; **new** Rust additions in slice 1 must hit ≥80% via `cargo tarpaulin`.
3. **Reuse before rewrite.** This is the principle v1 broke. v2 treats `project/crates/rti_core/` and `project/src-tauri/src/main.rs` as the canonical Rust assets. Slice 1 *extends* `rti_core::pcm` with a `generator` submodule (≤200 LOC), wires existing commands' `panel_stream_data` events to a TS `StreamStore`, and adapts existing `pcm_throughput_smoke.rs` + `datagram_throughput_smoke.rs` into the F1 perf gate.
4. **Offline-first, no CDN.** Replace prototype's `unpkg` imports with npm packages. `@fontsource/ibm-plex-sans` and `@fontsource/jetbrains-mono` instead of Google Fonts. MapLibre ships a local `style.json` (solid-color background + GeoJSON track lines from prototype mock — no tiles, no network).
5. **Subscriptions are owned by `StreamStore`; components subscribe via `useStreamSubscription` hook, never call bridge directly.** This firewall keeps panels mockable, swappable, and prevents 14 panels each opening 14 bridge channels. Spec §8.4.

### 1.2 Decision Drivers (top 3 forces) — **revised from v1**

1. **Strict perf gate** (60s × 10 Mbps × 0% loss × 60 FPS, spec §22 F1–F4) forces the existing Rust UDP pipeline (`ingest::udp::UdpReceiver` + `ingest::managed::ManagedReceiverRuntime` + `pcm::decode_bitstream`) plus a real-browser FPS measurement. F2 must be a Playwright headed Chromium test, not a jsdom RAF mock.
2. **Visual fidelity demand** ("최대한 비주얼 살려달라", Round 1) forces faithful TSX ports of all 13 panel kinds and all 13 modals, plus `styles.css` ported verbatim. The user will diff against prototype, so we keep `public/app/` pristine for comparison and gate visual diff in CI via Playwright pixel-diff.
3. **Rust core (`project/crates/rti_core/`) is largely complete; slice 1 extends `rti_core::pcm` with a `generator` submodule and wires existing commands to channel #1001.** This is the biggest delta from v1. The unit of work for the data plane is small (≤5 new Rust files); the bulk of effort is the TS port + integration. Effort drops ≈1.5–2 weeks vs v1.

### 1.3 Cargo workspace decision (architect open-question §7.1, locked)

Architect rejected v1's B1/B2 framing. v2 adopts the architect recommendation verbatim:

- **Keep `project/crates/rti_core/` as-is.** Single-crate dependency layout, declared by `project/src-tauri/Cargo.toml` via `rti_core = { path = "../crates/rti_core" }`.
- **No new workspace.** v1's `src-tauri/crates/{pcm-generator, pcm-receiver, tauri-shell}` is invalidated as duplication.
- **`pcm-generator` lands as either an `[[bin]]` inside `rti_core` (preferred) or, only if a separate crate becomes necessary, a sibling `project/crates/pcm-generator/`** referenced from `project/Cargo.toml` as a freshly-introduced `[workspace]`. v2 plans for the `[[bin]]` path; the sibling-crate fallback is documented in §7 R6.

### 1.4 Viable Options for the slice-1.5 cut line (most contentious remaining decision)

Architect's revision 7 demands a re-baseline (6–8 weeks single-eng, 4–5 weeks pair) plus a slice-1.5 cut line at week 5. The viable options describe **what to defer** if pacing slips:

| Option | What ships in slice 1 | What defers to slice 1.5 / slice 2 | Pros | Cons |
|---|---|---|---|---|
| **W1 (chosen): Defer non-Export modals to slice 2 if week 5 hits without phases 0–11 green** | All 13 panels, all shells, ExportModal (A9/D3 require), CommandPalette, OfflineAssetsDialog (A12), MatlabModal stub (A10), Workspace save/restore (A11/B3) | LayoutPresetModal, LLMDrawer, ChannelMappingEditor, StreamConfigModal, SequenceValidator, TestReportModal, RecordingLibrary, WorkspaceManagerDialog, SettingsDialog | Preserves data-plane vertical (the slice-1 differentiator) and all spec §22 acceptance items. Modals that stay are the ones spec §22 names explicitly. | 8 modals deferred; user expectation of "13 modals" relaxed. Communicated as slice-1.5. |
| **W2: Defer 3 of the 13 panel kinds (the heavyweight 3D + d3-force) to slice 1.5** | 10 panels (drop Attitude3D, Trajectory3D, RelationGraph), all shells, all 13 modals | Attitude3D, Trajectory3D, RelationGraph as placeholder panels | Keeps modal-completeness story; no new packages (`three`, `@react-three/fiber`, `d3-force`) needed. | Violates A6 ("13 panel kinds … all in slice 1"). Spec compliance gap. |
| W3: Cut Rust extension and ship mock-only slice 1 | All 13 panels, 13 modals, mock data only — no live channel #1001 | Rust pcm-generator submodule + 60s perf gate to slice 2 | All UI surfaces ship; effort ~3 weeks. | Violates F1–F4 (the strict bar). The slice-1 differentiator dies. **Invalidated.** |

**Decision: W1.** ExportModal is the only modal spec §22 directly names (A9). MatlabModal (A10) ships as a stub that satisfies "modal exists." OfflineAssetsDialog (A12/E3) ships as a placeholder. CommandPalette (Ctrl+K) ships because its absence is highly visible. The other 8 modals are scaffolded as empty TSX with passing "renders without crash" tests for slice 1.5; promoting them to full impls is slice 2 work. W2 invalidated on A6 grounds. W3 invalidated on F-series grounds.

---

## 2. Architecture Diagram

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│                       RealTimeInsight Tauri 2 Process                          │
│                                                                                │
│  Rust: project/crates/rti_core/  +  project/src-tauri/src/main.rs              │
│  ─────────────────────────────────────────────────────────────                 │
│                                                                                │
│   [EXTEND]  rti_core::pcm::generator  (NEW submodule, ≤200 LOC)               │
│      ├── PcmFrameGenerator       sine/ramp/CRC-corrupt modes                   │
│      ├── send_loop()             tokio::UdpSocket OR std::net::UdpSocket       │
│      └── [[bin]] pcm_gen          launched out-of-process for tauri:dev        │
│                          │                                                     │
│                          │ 10 Mbps loopback @ 127.0.0.1                        │
│                          ▼                                                     │
│   [EXISTING] rti_core::ingest::managed::ManagedReceiverRuntime                 │
│      └── start_with_sink(socket, config, |event| emit("rti://bridge-event"))  │
│          └── internally uses ingest::receiver::ReceiverSession::tick()        │
│              └── ingest::pipeline::ingest_pcm_datagram                        │
│                  └── pcm::decode_bitstream + crc16_ccitt                      │
│                                                                                │
│   [EXISTING] project/src-tauri/src/main.rs                                     │
│      ├── #[tauri::command] start_managed_receiver_loop  ← already wired       │
│      ├── #[tauri::command] managed_receiver_status      ← already wired       │
│      ├── #[tauri::command] drain_managed_receiver_events← already wired       │
│      ├── #[tauri::command] subscribe_panel_data         ← already wired       │
│      ├── #[tauri::command] live_session_status          ← already wired       │
│      └── emits BridgeEvent::PanelStreamData via app.emit("rti://bridge-event")│
│                                                                                │
│ ═════════════════════════════════════════════════════════════════════════════│
│  Tauri ↔ Webview boundary    (invoke / listen)                                 │
│ ═════════════════════════════════════════════════════════════════════════════│
│                                                                                │
│       Vite + React 18 + TS webview  (project/src/)                             │
│  ┌──────────────────────────────────────────────────────────────────┐        │
│  │  bridge/client.ts (existing JS, EXTEND .ts wrapper)               │        │
│  │  - createBridgeClient({ invoke, listen })                          │        │
│  │  - browser dev: invoke = fallbackInvoke (extracted from App.tsx)   │        │
│  │  - tauri:dev:   invoke = window.__TAURI__.core.invoke              │        │
│  │  - listen('rti://bridge-event', dispatchToStreamStore)             │        │
│  └────────────────┬─────────────────────────────────────────────────┘        │
│                   │                                                            │
│   ┌───────────────▼────────────────┐                                           │
│   │  StreamStore (Zustand)         │   panelDataRefs map                       │
│   │  • subscriptions               │   buffers Map<dataRef, Float64Array>       │
│   │  • RAF coalescer (16.7ms tick) │                                          │
│   │  • single notifyListeners()    │                                          │
│   │    per RAF tick                │                                          │
│   │  • useStreamSubscription hook  │                                          │
│   └───────────────┬────────────────┘                                          │
│                   │                                                            │
│   ┌───────────────┼────────────────────────────────────────┐                  │
│   │  WorkspaceStore  SessionStore  SelectionStore  IntegrationStore           │
│   │  (LayoutNode +   (mode, time)  (selectedPoint) (matlab/llm/...)           │
│   │   FlatGridNode)                                                           │
│   └───────────────┬────────────────────────────────────────┘                  │
│                   │                                                            │
│   ┌───────────────▼────────────────────────────────────────────┐              │
│   │  WorkstationLayout (TopBar | Sidebar | DockGrid | Insight | │             │
│   │                     BottomConsole)                          │             │
│   │   └── DockGrid renders 'workstation-default' preset:        │             │
│   │       FlatGridNode { columns: 12, rows: 12,                 │             │
│   │                      cells: [{panelId, gx, gy, gw, gh}×14] }│             │
│   │       (slice-1 frozen prototype geometry — no recursive     │             │
│   │        splits; drag-to-split lands in slice 2)              │             │
│   │                                                             │             │
│   │   Channel #1001 (Power Bus Voltage) Strip panel subscribes  │             │
│   │   to StreamStore, which receives live RAF-coalesced samples │             │
│   │   from BridgeEvent::PanelStreamData when tauri:dev runs.    │             │
│   │   In browser dev, that one panel shows                      │             │
│   │   "Bridge offline — start `npm run tauri:dev`" placeholder. │             │
│   │   Other 13 panels render mock data in both modes.           │             │
│   └─────────────────────────────────────────────────────────────┘            │
└───────────────────────────────────────────────────────────────────────────────┘

Browser dev mode (npm run dev):
   bus.ts synthesizer @ 30 Hz  ─►  fallbackInvoke('demo_receiver_tick')
                                   ─► same StreamStore path (no real UDP).
   Channel #1001 panel: "Bridge offline" placeholder (mitigates v1 Tension 2.4 drift).
```

---

## 3. File Tree

Markers:
- `[NEW]` — file does not exist; create from scratch
- `[PORT from public/app/X]` — TSX port of prototype JSX (visual-faithful)
- `[EXTEND existing]` — add to file already in repo
- `[ADAPT existing test]` — wrap/parameterize an existing test

```text
RealTimeInsight-main/
├── package.json                                           [EXTEND] add vitest, @vitest/coverage-v8, jsdom, @testing-library/react, @testing-library/user-event, @fontsource/ibm-plex-sans, @fontsource/jetbrains-mono, zustand, maplibre-gl, three, @react-three/fiber, d3-force, playwright, @playwright/test
├── vitest.config.ts                                       [NEW]   jsdom env, c8 thresholds 80/75, RTL setup; excludes **/*.d.ts, **/types/*.ts, **/__mocks__/**
├── playwright.config.ts                                   [NEW]   PR-blocking visual-diff + perf E2E project configs
├── tsconfig.json                                          [EXTEND] strict: true, jsx: 'react-jsx', baseUrl: project/src
├── tsconfig.test.json                                     [NEW]   vitest-specific overrides
├── scripts/
│   ├── check-perf.mjs                                     [NEW]   parses cargo test --ignored output, fails CI on F1/F3/F4 violation
│   └── build-acceptance-report.mjs                        [NEW]   §11.2 observability artifact
│
├── public/                                                [unchanged - kept pristine for visual diff]
│   └── app/                                               (19 .jsx + styles.css frozen as design package reference)
│
├── project/
│   ├── Cargo.toml                                         [optional NEW] only if pcm-generator becomes a sibling crate (R6 fallback). v2 default = no workspace, generator as [[bin]] in rti_core.
│   │
│   ├── crates/rti_core/
│   │   ├── Cargo.toml                                     [EXTEND]  add [[bin]] pcm_gen (path = "src/bin/pcm_gen.rs"), add dev-deps: criterion (already implicit from existing perf tests if any; otherwise add)
│   │   ├── src/
│   │   │   ├── lib.rs                                     [unchanged]
│   │   │   ├── pcm/
│   │   │   │   ├── mod.rs                                 [EXTEND]  add `pub mod generator;`
│   │   │   │   └── generator.rs                           [NEW]     PcmFrameGenerator: sine/ramp generator, send_loop(socket, channel_ids, target_mbps)
│   │   │   ├── ingest/                                    [unchanged - already complete]
│   │   │   ├── bridge/                                    [unchanged - already complete]
│   │   │   ├── stream/                                    [unchanged]
│   │   │   ├── data_ref/                                  [unchanged]
│   │   │   └── ... (other 17 modules unchanged)
│   │   ├── src/bin/
│   │   │   └── pcm_gen.rs                                 [NEW]     thin CLI: parse args (--bind, --target, --bitrate, --channels), run generator::send_loop
│   │   └── tests/
│   │       ├── pcm_throughput_smoke.rs                    [ADAPT]   currently gated by RUN_PERF_SMOKE env var; v2 adapts to call new generator submodule and asserts F1 (60s, 0% loss, ≥9.5 Mbps)
│   │       ├── datagram_throughput_smoke.rs               [ADAPT]   same — exercise generator → managed receiver loopback
│   │       ├── generator_loopback.rs                      [NEW]     short (5s) generator + ManagedReceiverRuntime loopback, asserts 0 dropped, CRC ≥ 99.9%
│   │       └── pcm_decode.rs, pcm_sync_scan.rs            [unchanged - already cover F4 CRC fail rate semantics]
│   │
│   ├── src-tauri/
│   │   ├── Cargo.toml                                     [unchanged]   already declares rti_core path dep
│   │   ├── src/main.rs                                    [EXTEND]  small surgical changes:
│   │   │                                                              (1) ensure start_managed_receiver_loop's default channel_ids includes 1001 when caller omits;
│   │   │                                                              (2) ensure the PanelSubscription seeded inside start_managed_receiver_loop registers panel-1001 subscribed to #1001 with TimeseriesV1 schema;
│   │   │                                                              (3) confirm app.emit("rti://bridge-event", &BridgeEvent::PanelStreamData(...)) fires for #1001.
│   │   │                                                              No new commands. No structural changes.
│   │   └── tauri.conf.json                                [EXTEND] beforeDevCommand = "npm run dev"; identifier; allowlist
│   │
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx                                    [EXTEND] strip down to 30-line shell wrapping <WorkstationLayout/>; extract fallbackInvoke
│   │   │   ├── main.tsx                                   [EXTEND] mount providers (StoreProvider, ThemeProvider)
│   │   │   └── fallbackInvoke.ts                          [NEW]   extracted from current App.tsx; consumes mock/synthesizer
│   │   │
│   │   ├── bridge/
│   │   │   ├── client.ts                                  [EXTEND/PORT] port project/src/bridge/client.js to .ts; add subscription lifecycle helpers
│   │   │   ├── schemas.ts                                 [PORT]  port project/src/bridge/schemas.js → strict TS (current .d.ts becomes .ts)
│   │   │   └── eventBus.ts                                [NEW]   typed listener for rti://bridge-event with discriminated-union dispatch
│   │   │
│   │   ├── mock/
│   │   │   ├── channels.ts                                [EXTEND] 10 → 36 channels (port from public/app/data.jsx CHANNELS)
│   │   │   ├── anomalies.ts                               [NEW]   port ANOMALY fixture
│   │   │   ├── events.ts                                  [NEW]   port EVENTS fixture
│   │   │   ├── trackPoints.ts                             [NEW]   port TRACK_POINTS map track
│   │   │   └── synthesizer.ts                             [NEW]   port bus.jsx 30 Hz logic, exposed as iterable for fallbackInvoke
│   │   │
│   │   ├── types/
│   │   │   ├── domain.ts                                  [NEW]   LayoutNode = SplitNode | TabNode | PanelNode | FlatGridNode (revision 6); PanelInstance, PanelBinding, DragChannelPayload, EvidenceNode/Edge, SelectedPoint
│   │   │   ├── panels.ts                                  [NEW]   13-kind discriminated union of panel options
│   │   │   └── api.ts                                     [NEW]   bridge surface types (re-exported from schemas.ts)
│   │   │
│   │   ├── store/
│   │   │   ├── workspaceStore.ts                          [NEW]   Zustand: LayoutNode tree (FlatGridNode for slice 1), panels, presets, dirty
│   │   │   ├── sessionStore.ts                            [NEW]   Zustand: appMode, playback, ingest
│   │   │   ├── selectionStore.ts                          [NEW]   Zustand: selectedChannelIds, selectedPanelId, selectedPoint, globalCursorNs
│   │   │   ├── streamStore.ts                             [NEW]   Zustand + RAF coalescer; single notifyListeners()/RAF; owns subscriptions
│   │   │   ├── integrationStore.ts                        [NEW]   Zustand: matlab, llm, simdis, exportJobs, offlineAssets
│   │   │   └── presets/
│   │   │       └── workstationDefault.ts                  [NEW]   FlatGridNode preset reproducing INITIAL_PANELS exactly (gx,gy,gw,gh per panel)
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
│   │   │   ├── ChannelExplorer.tsx                        [NEW]   search + filter chips + virtualized tree (react-window)
│   │   │   ├── DockGrid.tsx                               [NEW]   FlatGridNode renderer (slice 1) + recursive SplitNode/TabNode renderer (built but inactive in slice 1) + 5-zone DropOverlay
│   │   │   ├── PanelFrame.tsx                             [NEW]   header / body / footer chrome
│   │   │   ├── InsightPane.tsx                            [NEW]   tabs: root-cause, evidence, llm, tools
│   │   │   └── BottomConsole.tsx                          [NEW]   bitrate, FPS, CRC, alarms (reads ingestStore + streamStore.perf)
│   │   │
│   │   ├── panels/                                                [PORT from public/app/panels.jsx, panels2.jsx, trajectory.jsx, hexmap.jsx]
│   │   │   ├── strip/
│   │   │   │   ├── StripPanel.tsx                         [NEW]   canvas-based, RAF-driven, decimation; subscribes to #1001 via StreamStore for live mode
│   │   │   │   └── stripRenderer.ts                       [NEW]   pure render fn (testable without canvas)
│   │   │   ├── numeric/NumericPanel.tsx                   [NEW]   + numericRenderer.ts
│   │   │   ├── discrete/DiscretePanel.tsx                 [NEW]
│   │   │   ├── eventlog/EventLogPanel.tsx                 [NEW]
│   │   │   ├── map2d/
│   │   │   │   ├── Map2DPanel.tsx                         [NEW]   MapLibre with LOCAL style.json (no CDN)
│   │   │   │   └── localStyle.ts                          [NEW]   solid-color background + GeoJSON track layer
│   │   │   ├── video/VideoPanel.tsx                       [NEW]   <video> element with cursor sync
│   │   │   ├── attitude3d/
│   │   │   │   ├── Attitude3DPanel.tsx                    [NEW]   three + @react-three/fiber wrapper
│   │   │   │   └── sceneBuilder.ts                        [NEW]   pure scene-graph builder (testable in isolation)
│   │   │   ├── trajectory3d/
│   │   │   │   ├── Trajectory3DPanel.tsx                  [NEW]
│   │   │   │   └── sceneBuilder.ts                        [NEW]
│   │   │   ├── waterfall/
│   │   │   │   ├── WaterfallPanel.tsx                     [NEW]   canvas, mock spectrum
│   │   │   │   └── waterfallRenderer.ts                   [NEW]
│   │   │   ├── relationgraph/
│   │   │   │   ├── RelationGraphPanel.tsx                 [NEW]   d3-force layout
│   │   │   │   └── forceSetup.ts                          [NEW]   pure simulation seeder
│   │   │   ├── simdisbridge/SimdisBridgePanel.tsx         [NEW]   uses demo_simdis_bridge_status (existing command)
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
│   │   │   ├── ExportModal.tsx                            [NEW]   FULL — §16 quality policy radio (4 options)
│   │   │   ├── MatlabModal.tsx                            [NEW]   STUB — renders title + close button (A10)
│   │   │   ├── CommandPalette.tsx                         [NEW]   FULL — Ctrl+K
│   │   │   ├── OfflineAssetsDialog.tsx                    [NEW]   PLACEHOLDER — A12/E3
│   │   │   ├── LayoutPresetModal.tsx                      [NEW]   STUB (slice-1.5)
│   │   │   ├── LLMDrawer.tsx                              [NEW]   STUB (slice-1.5)
│   │   │   ├── ChannelMappingEditor.tsx                   [NEW]   STUB (slice-1.5)
│   │   │   ├── StreamConfigModal.tsx                      [NEW]   STUB (slice-1.5)
│   │   │   ├── SequenceValidator.tsx                      [NEW]   STUB (slice-1.5)
│   │   │   ├── TestReportModal.tsx                        [NEW]   STUB (slice-1.5)
│   │   │   ├── RecordingLibrary.tsx                       [NEW]   STUB (slice-1.5)
│   │   │   ├── WorkspaceManagerDialog.tsx                 [NEW]   STUB (slice-1.5)
│   │   │   └── SettingsDialog.tsx                         [NEW]   STUB (slice-1.5)
│   │   │
│   │   └── styles/
│   │       ├── tokens.css                                 [PORT from public/app/styles.css §:root vars]
│   │       └── app.css                                    [PORT from public/app/styles.css remainder]
│   │
│   └── tests/
│       ├── unit/                                          [NEW vitest tests]
│       │   ├── store/{workspaceStore,streamStore,selectionStore,sessionStore,integrationStore}.test.ts
│       │   ├── bridge/{client,schemas,eventBus}.test.ts
│       │   ├── mock/{synthesizer,channels}.test.ts
│       │   ├── hooks/{useStreamSubscription,useDropZone,useGlobalCursor}.test.ts
│       │   ├── shell/{ChannelExplorer,DockGrid,InsightPane,BottomConsole}.test.tsx
│       │   ├── panels/<one .test.tsx per kind>.test.tsx           # 13 files; canvas/3D-heavy panels split out renderer tests
│       │   ├── panels/strip/stripRenderer.test.ts                 # tests pure render fn against mocked CanvasRenderingContext2D
│       │   ├── panels/attitude3d/sceneBuilder.test.ts             # tests pure scene-graph fn
│       │   ├── panels/relationgraph/forceSetup.test.ts            # tests d3-force seeding
│       │   ├── modals/{ExportModal,MatlabModal,CommandPalette,OfflineAssetsDialog}.test.tsx        # FULL/STUB/PLACEHOLDER coverage
│       │   ├── modals/<8 stub modals>.test.tsx                    # "renders without crash" only
│       │   └── presets/workstationDefault.test.ts                 # asserts FlatGridNode 14-cell preset matches prototype INITIAL_PANELS exactly (gx,gy,gw,gh per panel)
│       ├── integration/                                   [NEW + ported]
│       │   ├── workspace_save_restore.test.ts             # A11/B3
│       │   ├── stream_subscription_lifecycle.test.ts
│       │   ├── anomaly_click_to_insight.test.ts           # A7/C3
│       │   ├── drag_drop_overlay.test.ts                  # A3/C1
│       │   ├── drag_drop_split.test.ts                    # A4/C2 (drag-to-split mutates LayoutNode tree even though preset is FlatGridNode — split converts FlatGridNode → SplitNode subtree on first split)
│       │   ├── global_cursor_sync.test.ts                 # C4 — per-panel render-side cursor assertion (not just store fan-out)
│       │   ├── live_to_replay_toggle.test.ts              # A1
│       │   ├── channel_search_filter.test.ts              # A2/E2
│       │   ├── export_quality_policy.test.ts              # A9/D3
│       │   ├── bitrate_readout.test.ts                    # F3
│       │   ├── end_to_end_bitrate.test.ts                 # §11.1 Scenario B mitigation: spawn rti_core managed receiver in-process, drive generator submodule, observe StreamStore output bitrate
│       │   ├── ported/bridge_schema_test.ts               # PORTED from project/tests/unit/bridge_schema_test.js
│       │   ├── ported/bridge_client_test.ts               # PORTED from project/tests/unit/bridge_client_test.js
│       │   ├── ported/app_contract_test.ts                # PORTED from project/tests/unit/app_contract_test.js
│       │   ├── ported/pcm_decoder_test.ts                 # PORTED from project/tests/unit/pcm_decoder_test.js
│       │   ├── ported/channel_metadata_test.ts            # PORTED from project/tests/unit/channel_metadata_test.js
│       │   └── ported/scaffold_contract_test.ts           # PORTED from project/tests/unit/scaffold_contract_test.js
│       ├── e2e/                                           [NEW Playwright — PR-blocking in slice 1]
│       │   ├── visual_regression_workstation.spec.ts      # Playwright headless Chromium; tolerance 5px text / 2px chrome / 10px canvas
│       │   ├── e2e_60fps.spec.ts                          # NEW Phase 14: real-browser perf gate. Mounts WorkstationSheet under tauri:dev OR a stub harness; measures performance.now() across 10s; asserts mean ≤16.7ms, p95 ≤25ms.
│       │   └── __snapshots__/                              # baseline images cached as CI artifacts
│       └── perf/
│           └── streamstore_raf.test.ts                    # F2 unit-level sanity (NOT the gate): asserts StreamStore RAF coalescer notifies ≤1×/RAF tick. Real F2 gate lives in tests/e2e/e2e_60fps.spec.ts.
│
└── project/tests/integration/legacy/                      [MOVED]   markdown-content + smoke *_test.js files; npm run test:legacy (markdown PR-blocking) and npm run test:legacy:nightly (smoke)
```

**Counts (revised from v1):**
- Rust files (NEW): **3–5** (`pcm/generator.rs`, `bin/pcm_gen.rs`, `tests/generator_loopback.rs`, optional `pcm/generator_internal.rs`, ≤200 LOC each)
- Rust files (ADAPT): 2 (`tests/pcm_throughput_smoke.rs`, `tests/datagram_throughput_smoke.rs`)
- Rust files (EXTEND): 2 (`pcm/mod.rs` adds `pub mod generator;`, `Cargo.toml` adds `[[bin]]`)
- Tauri-shell (EXTEND): 1 (`src-tauri/src/main.rs` — surgical ≤30 LOC delta)
- TS source files (NEW): ~110 (unchanged from v1)
- TS test files (NEW): ~80 (unchanged), of which 6 are ported from `project/tests/unit/*_test.js`
- TSX panel ports: 13 + 4 sheets = 17
- TSX modals: 4 FULL/STUB/PLACEHOLDER + 9 STUB = 13

**Effort delta from v1: ≈ −1.5 to −2 weeks of Rust greenfield removed.**

---

## 4. Phased Implementation Steps

| # | Phase | Deliverable | Failing tests written first (RED) | Files modified/created | Depends on | Cov target |
|---|---|---|---|---|---|---|
| 0 | Tooling | Vitest + c8 config (with c8 exclusions per architect §7.5), package.json scripts (`test`, `test:cov`, `test:legacy`, `test:legacy:nightly`, `cargo:test`, `e2e:visual`, `e2e:perf`). **No new Cargo workspace.** Just verify existing `cargo test --manifest-path project/src-tauri/Cargo.toml` works. | `vitest run` exits clean on empty suite; `cargo test -p rti_core` passes (existing baseline). | `vitest.config.ts`, `tsconfig.test.json`, `package.json` scripts, `playwright.config.ts`, `scripts/check-perf.mjs`, `scripts/build-acceptance-report.mjs` | — | n/a (infra) |
| 1 | Mock data port | All 36 channels + ANOMALY + EVENTS + TRACK_POINTS as TS modules; bus.jsx synthesizer port | `mock/channels.test.ts`: assert 36 channels, all valid `ChannelSummary` shape; `mock/synthesizer.test.ts`: 30 Hz tick produces deterministic samples for channel #1001 | `project/src/mock/{channels,anomalies,events,trackPoints,synthesizer}.ts` | 0 | ≥80% |
| 2 | Domain types | `types/domain.ts` (LayoutNode = SplitNode \| TabNode \| PanelNode \| **FlatGridNode**, PanelInstance, PanelBinding, DragChannelPayload, EvidenceNode/Edge, SelectedPoint), `types/panels.ts`, `types/api.ts`. **FlatGridNode = `{ type: 'flat-grid', columns: number, rows: number, cells: { panelId, gx, gy, gw, gh }[] }`.** Document migration to recursive splits in the source comment. | Type assertion tests via `expectTypeOf`; LayoutNode discriminated-union exhaustiveness incl. FlatGridNode | `project/src/types/*.ts`, `project/src/bridge/schemas.ts` (port from .js) | 1 | ≥80% (assertion fns) |
| 3 | Stores | All 5 Zustand stores; StreamStore RAF coalescer with single `notifyListeners()`/RAF; useStreamSubscription hook | `workspaceStore.test.ts`: addPanel, removePanel, saveWorkspace round-trips; **FlatGridNode → SplitNode conversion test** (when first split happens, the FlatGridNode "expands" into a SplitNode subtree); `streamStore.test.ts`: subscribe with 14 different panels, push 200 samples, **assert exactly 1 React notification per RAF tick** (mitigates pre-mortem Scenario A); `selectionStore.test.ts`: setSelectedPoint emits to InsightPane subscribers; `sessionStore.test.ts`: appMode toggle resets playback; A1, A11, B3 covered by store tests | `project/src/store/*.ts`, `project/src/hooks/useStreamSubscription.ts` | 1, 2 | ≥80% |
| 4 | Bridge integration | `bridge/client.ts` PORT from `client.js` + extension; `bridge/eventBus.ts` typed listener; `fallbackInvoke.ts` extracted from `App.tsx`; **6 ported tests from project/tests/unit/** (architect §7.7) | `tests/integration/ported/{bridge_schema,bridge_client,app_contract,pcm_decoder,channel_metadata,scaffold_contract}_test.ts` (vitest equivalents); `bridge/eventBus.test.ts`: bad event type rejected | `project/src/bridge/{client,eventBus,schemas}.ts`, `project/src/app/fallbackInvoke.ts` | 2 | ≥80% |
| 5 | **Rust extension** | Add `rti_core::pcm::generator` submodule (≤200 LOC): `PcmFrameGenerator { profile, channel_ids, target_mbps, mode: { Sine, Ramp, CrcCorrupt } }` + `pub fn send_loop(socket: &UdpSocket, generator: &mut PcmFrameGenerator, deadline: Instant)`. Reuses `pcm::create_test_frame`, `pcm::frame_to_bits`, `pcm::bits_to_bytes`. Add `[[bin]] pcm_gen` for tauri:dev sidecar use. | `tests/generator_loopback.rs`: spawn generator on port 0 (kernel-assigned), spawn `ManagedReceiverRuntime::start_with_sink`, run for 5s @ 10 Mbps, assert `accepted_frames > 0`, `rejected_frames == 0`, `accepted_samples` consistent with bitrate within 5%. **No new crate, no new workspace.** | `project/crates/rti_core/src/pcm/generator.rs`, `project/crates/rti_core/src/pcm/mod.rs` (add `pub mod generator;`), `project/crates/rti_core/Cargo.toml` (add `[[bin]] name = "pcm_gen"`), `project/crates/rti_core/src/bin/pcm_gen.rs`, `project/crates/rti_core/tests/generator_loopback.rs` | 0 (parallel with phases 1–4) | tarpaulin ≥80% on **new** Rust only (existing crate grandfathered) |
| 6 | **Perf gate adaptation** | Adapt existing `tests/pcm_throughput_smoke.rs` and `tests/datagram_throughput_smoke.rs` to drive the generator submodule. Both already gated by `RUN_PERF_SMOKE=1`. Add a `--ignored` 60s variant for F1; per-PR runs the existing 5s variant. CI script `scripts/check-perf.mjs` parses `cargo test --ignored` JSON output and gates F1, F3, F4. | `tests/pcm_throughput_smoke.rs` (ADAPT): parameterize over generator-driven 60s @ 10 Mbps; assert `mean_bitrate_mbps ∈ [9.5, 10.5]`, `dropped_frames == 0`, `crc_failures < 0.1%`. `tests/datagram_throughput_smoke.rs` (ADAPT): same with managed receiver loop. | `project/crates/rti_core/tests/pcm_throughput_smoke.rs` [ADAPT], `project/crates/rti_core/tests/datagram_throughput_smoke.rs` [ADAPT], `scripts/check-perf.mjs` [NEW] | 5 | n/a (perf gate); F1, F3, F4 |
| 7 | **Tauri-shell wiring (extension)** | Surgical changes to `project/src-tauri/src/main.rs`: (1) `start_managed_receiver_loop` defaults `channel_ids` to include `1001`; (2) the `PanelSubscription` registered inside the command names a panel-id matching what the TS WorkspaceStore preset uses for the Power Bus Strip panel (e.g., `panel-strip-1001`) and subscribes to `[1001]` with `TimeseriesV1`. (3) Confirm the existing `app.emit("rti://bridge-event", &event)` covers PanelStreamData for #1001. **No new commands. No structural changes.** | `tests/managed_receiver_loop.rs` is existing — verify it still passes. New TS-side `tests/integration/end_to_end_bitrate.test.ts` (phase 12) is the cross-stack assertion. | `project/src-tauri/src/main.rs` [EXTEND, ≤30 LOC delta] | 5, 6 | existing Rust grandfathered; no new lines added that need new tests beyond §11.1 Scenario B's E2E test |
| 8 | Shell components | TopBar, LeftSidebar (ChannelExplorer with virtualized list via react-window), DockGrid, InsightPane, BottomConsole, PanelFrame | `ChannelExplorer.test.tsx`: typing 'voltage' filters list (A2); virtualized list mounts only visible rows when given 10000-row synthetic (E2); `DockGrid.test.tsx`: renders FlatGridNode preset, drop on edge calls `addSplit` action which converts to SplitNode subtree (A4/C2); `InsightPane.test.tsx`: setSelectedPoint updates Root Cause tab (A7/C3); `BottomConsole.test.tsx`: bitrate readout reflects ingest store + streamStore.perf.framesPerSecond | `project/src/shell/*.tsx`, `project/src/styles/{tokens,app}.css` | 1–4 | ≥80% |
| 9 | Panel TSX ports (13 kinds) | strip, multi-strip, numeric, discrete, eventlog, map2d (MapLibre with local style.json), video, attitude3d (R3F), trajectory3d (R3F), waterfall, relationgraph (d3-force), simdisbridge, globe, gpslos | One `.test.tsx` per kind asserting (a) renders given empty bindings (b) renders given one binding (c) panel-local state isolated (E1) — **plus RAF-budget assertion** (architect revision 9: `requestAnimationFrame` callbacks complete in <16.7ms wall-clock under 1s of synthetic samples) (d) Strip overlays 2 channels when 2 bindings present (C1). Pure renderer tests: `stripRenderer.test.ts`, `attitude3d/sceneBuilder.test.ts`, `trajectory3d/sceneBuilder.test.ts`, `waterfallRenderer.test.ts`, `relationgraph/forceSetup.test.ts`. **Map2D test asserts `e3_no_network_requests` — `MapPanel` mount fires 0 network requests** (architect §7.4). | `project/src/panels/<kind>/*Panel.tsx` + extracted renderer/builder | 1–4, 8 | ≥80% (logic via extracted renderer fns; visual coverage gated by phase 13) |
| 10 | Sheet routing + workstation-default preset | 4 sheets switchable in TopBar; `WorkstationSheet` uses live `StreamStore` data path for #1001 + mock for the 13 other panels; **preset uses `FlatGridNode`** reproducing prototype's 14-panel grid via 14 explicit `(gx, gy, gw, gh)` cells; in **browser dev**, the #1001 panel renders a "Bridge offline — start `npm run tauri:dev`" placeholder (Tension 2.4 mitigation) | `presets/workstationDefault.test.ts`: FlatGridNode has 14 cells, each cell's `(gx,gy,gw,gh)` matches prototype's `INITIAL_PANELS` exactly; `WorkstationSheet.test.tsx`: mounts 14 panel frames; **`WorkstationSheet.test.tsx`: when bridge unavailable, the #1001 panel renders the "Bridge offline" placeholder** (Tension 2.4 lock); `SpaceSheet/EwSheet/GpsLosSheet.test.tsx`: each renders without crash from mock (A5, A6, D2) | `project/src/sheets/*.tsx`, `project/src/store/presets/workstationDefault.ts` | 3, 8, 9 | ≥80% |
| 11 | Modals (4 FULL/STUB/PLACEHOLDER + 9 STUB) | ExportModal exposes 4 quality policies (A9/D3); MatlabModal STUB shell (A10); OfflineAssetsDialog placeholder (A12/E3); CommandPalette Ctrl+K; the other 9 modals are STUB (slice-1.5 cut line per W1) | `ExportModal.test.tsx`: each radio sets `qualityPolicy` correctly, submit calls bridge.exportData; `MatlabModal.test.tsx`: render + present mode; `CommandPalette.test.tsx`: Ctrl+K opens; `OfflineAssetsDialog.test.tsx`: render placeholder. STUB modals: "renders without crash" only. | `project/src/modals/*.tsx` | 8 | ≥80% (FULL/STUB still need module-level cov even if STUB body trivial) |
| 12 | E2E acceptance verification | Vitest integration suite covering all spec §22 items A1–A12, B1–B3, C1–C4, D1–D3, E1–E3 (see §5 mapping); F-series wired into CI script. **`tests/integration/end_to_end_bitrate.test.ts`: spawns generator submodule + ManagedReceiverRuntime in-process via Rust binding harness OR exercises the path through Tauri test helpers (whichever is feasible in vitest), drains events for 30s, asserts ≥9.5 Mbps observed at StreamStore output** (Scenario B mitigation). | `tests/integration/*.test.ts` (12 files in §3); `scripts/check-perf.mjs` parses cargo + criterion JSON, fails build if F1/F3/F4 violated; `scripts/build-acceptance-report.mjs` produces `.omc/reports/slice-1-acceptance-report.md` | 1–11 | ≥80% (overall gate); F1, F3, F4 |
| 13 | **Visual regression — PR-BLOCKING** (architect revision 4) | Playwright headless Chromium @ 1920×1080 in CI Docker; spec navigates to `npm run dev` (deterministic mock-only render of WorkstationSheet) and screenshots DockGrid; baseline generated **once on first CI run**, cached as artifact, diffed on subsequent PRs. **Tolerance: 5px text-heavy regions, 2px chrome, 10px canvas content** (Scenario C mitigation). Moved from §8.4 step 8 (manual) to step 5 (PR-blocking). | `tests/e2e/visual_regression_workstation.spec.ts`: navigate, snapshot, compare; PR-blocking. | `tests/e2e/visual_regression_workstation.spec.ts`, `playwright.config.ts` | 10 | n/a (visual gate, PR-blocking) |
| 14 | **Real-browser perf gate** (architect revision 5, NEW phase split out from v1's phase 12 F2) | Playwright headed Chromium spec mounts `WorkstationSheet` via `npm run tauri:dev` (or a stub harness exposing the same StreamStore + bridge surface). Drives the generator submodule (or its TS mock equivalent) to push 10s of live data into the StreamStore. Measures `performance.now()` deltas between RAF callbacks during the 10s window. **PR-blocking gate: `mean_frame_ms ≤ 16.7 && p95_frame_ms ≤ 25`.** The vitest-jsdom F2 (`tests/perf/streamstore_raf.test.ts`) stays as unit-level sanity, **not the gate**. | `tests/e2e/e2e_60fps.spec.ts`: navigate, mount WorkstationSheet, drive 10s of live data, collect RAF deltas, assert. | `tests/e2e/e2e_60fps.spec.ts`, `tests/perf/streamstore_raf.test.ts` (sanity, not gate) | 5, 6, 10 | n/a (perf gate, PR-blocking); F2 |

**Phase ordering rationale:** 0→1→2→3→4 is a strict TS chain. Phase 5 (Rust extension) starts in parallel with phase 1; it is small (≤5 files). Phase 6 depends on 5. Phase 7 is a small surgical extension to existing `main.rs` and depends on 5+6. Phase 8 depends on 1–4. Phase 9 depends on 1–4 and 8. Phase 10 stitches 3+8+9 + Tension 2.4 placeholder. Phase 11 is parallelizable with 9 once 8 lands. Phase 12 is the integration gate. Phase 13 is the visual gate (PR-blocking). Phase 14 is the perf E2E gate (PR-blocking). Realistic critical path: 0 → (1‖5) → (2‖6) → (3‖7) → 4 → 8 → 9 → 10 → 11 → 12 → 13 → 14.

**Slice-1.5 cut line at week 5 (architect revision 7):** if at end of week 5 phases 0–10 are not green, defer phase 11 STUB modals (LayoutPresetModal, LLMDrawer, ChannelMappingEditor, StreamConfigModal, SequenceValidator, TestReportModal, RecordingLibrary, WorkspaceManagerDialog, SettingsDialog) and ship slice-1 with phases 0–10 + ExportModal + MatlabModal stub + OfflineAssetsDialog + CommandPalette. The 9 deferred modals become slice-1.5.

---

## 5. Acceptance Mapping (Spec §22 ↔ Test Locations) — fixes for A5, C4, E1, F1, F2, F4

| ID | Criterion | Test file : test name | Phase |
|---|---|---|---|
| A1 | Live/Replay 토글 → SessionStore.appMode | `tests/integration/live_to_replay_toggle.test.ts : "TopBar mode switch updates SessionStore.appMode"` | 12 |
| A2 | ChannelExplorer 'voltage' 검색 | `tests/unit/shell/ChannelExplorer.test.tsx : "filters channels by 'voltage' substring (case-insensitive)"` | 8 |
| A3 | 채널 → Strip 중앙 드래그 | `tests/integration/drag_drop_overlay.test.ts : "channel drop on strip panel center adds binding"` | 12 |
| A4 | 채널 → 패널 가장자리 드래그 → split | `tests/integration/drag_drop_split.test.ts : "channel drop on right edge converts FlatGridNode cell into SplitNode subtree"` | 12 |
| **A5 (FIX)** | workstation-default 프리셋 14패널 동시 렌더 | `tests/unit/presets/workstationDefault.test.ts : "FlatGridNode preset has 14 cells with (gx,gy,gw,gh) matching prototype INITIAL_PANELS exactly"` + `tests/unit/sheets/WorkstationSheet.test.tsx : "mounts 14 PanelFrame nodes"`. **Asserts faithful reproduction of heterogeneous 12-col grid via FlatGridNode (Tension 2.3 fix).** | 10 |
| A6 | 13 패널 종류 슬라이스 1 최소 UI | `tests/unit/panels/<kind>/<Kind>Panel.test.tsx : "renders without crash with empty bindings"` × 13 | 9 |
| A7 | 이상점 클릭 → InsightPane | `tests/integration/anomaly_click_to_insight.test.ts : "EventLog row click updates SelectionStore.selectedAnomalyId and InsightPane root-cause tab"` | 12 |
| A8 | RelationGraph 패널 존재 | `tests/unit/panels/relationgraph/RelationGraphPanel.test.tsx : "renders force layout with mock evidence graph"` | 9 |
| A9 | Export modal quality policy 4-way | `tests/unit/modals/ExportModal.test.tsx : "qualityPolicy radio cycles keep-all/good-crc-only/decode-valid-only/split-by-quality"` | 11 |
| A10 | MATLAB handoff modal 존재 | `tests/unit/modals/MatlabModal.test.tsx : "STUB renders title and close button"` | 11 |
| A11 | Workspace 저장/복원 | `tests/integration/workspace_save_restore.test.ts : "WorkspaceStore.saveWorkspace + loadWorkspace round-trips LayoutNode tree (FlatGridNode preserved)"` | 12 |
| A12 | Offline asset state UI | `tests/unit/modals/OfflineAssetsDialog.test.tsx : "renders airgapped/offline-preferred/online-allowed states"` | 11 |
| B1 | 패널 생성/분할/닫기/저장 | `tests/unit/store/workspaceStore.test.ts : "addPanel/splitPanel(FlatGridNode→SplitNode)/removePanel/saveWorkspace"` (4 tests) | 3 |
| B2 | 채널 드래그 앤 드롭 | covered by A3+A4 | 12 |
| B3 | Workspace 복원 후 동일 배치 | covered by A11 | 12 |
| C1 | Strip 2+ 채널 overlay | `tests/unit/panels/strip/StripPanel.test.tsx : "renders 2 channel series in overlay mode"` | 9 |
| C2 | Edge drop으로 split | covered by A4 | 12 |
| C3 | 이상점 클릭 → InsightPane 갱신 | covered by A7 | 12 |
| **C4 (FIX)** | Global cursor 동기화 (5 panel kinds) | `tests/integration/global_cursor_sync.test.ts : "updating SelectionStore.globalCursorNs propagates to subscribers AND **Strip cursor line moves, Map2D track marker moves, Video frame jumps**"` (architect revision 8: per-panel render-side cursor assertion, not just store fan-out count). EventLog highlights row by `cursorNs`; RelationGraph highlights node by selection. | 12 |
| D1 | Boot 시 mock으로 즉시 렌더 | `tests/unit/sheets/WorkstationSheet.test.tsx : "renders 14 panels with mock-only data when bridge unavailable; #1001 panel shows 'Bridge offline' placeholder"` | 10 |
| D2 | 최소 3종 패널 mock 렌더 | covered by A6 (13 kinds, ≥3) | 9 |
| D3 | Export dialog mock 동작 | covered by A9 | 11 |
| **E1 (FIX)** | 패널 리렌더 회피 | `tests/unit/panels/strip/StripPanel.test.tsx : "memoized: changing other panel props does not re-render"` (uses React render counter) **AND `tests/unit/panels/strip/StripPanel.test.tsx : "RAF-budget: 1s of synthetic 200 Hz samples — render fn callback wall-clock < 16.7ms avg"`** (architect revision 9: RAF-budget assertion in addition to React render-count) | 9 |
| E2 | 1만+ 채널 검색 | `tests/unit/shell/ChannelExplorer.test.tsx : "virtualized list mounts only visible rows when given 10000-channel synthetic dataset"` | 8 |
| E3 | Airgapped/offline UI | covered by A12 + `tests/unit/panels/map2d/Map2DPanel.test.tsx : "no network requests fire during MapPanel mount"` | 9, 11 |
| **F1 (FIX)** | cargo 60s 10 Mbps 0% loss | **`project/crates/rti_core/tests/pcm_throughput_smoke.rs` [ADAPT existing] + `project/crates/rti_core/tests/datagram_throughput_smoke.rs` [ADAPT existing]** — both gated `#[ignore]` for 60s long-form; PR run uses 5s. Asserts `mean_bitrate_mbps ∈ [9.5, 10.5]`, `dropped_frames == 0`, `crc_failures < 0.1%`. CI script `scripts/check-perf.mjs` parses `cargo test --ignored` JSON. **No new test files.** | 6, 12 |
| **F2 (FIX)** | UI 60 FPS @ Workstation + live #1001 | **PR-BLOCKING gate: `tests/e2e/e2e_60fps.spec.ts` (Playwright headed Chromium, real-browser, 10s of live data, `mean_frame_ms ≤ 16.7 && p95_frame_ms ≤ 25`)** (architect revision 5). Vitest jsdom test `tests/perf/streamstore_raf.test.ts` stays as RAF-coalescer sanity, NOT the gate. | 14 |
| F3 | BottomConsole bitrate 9.5–10.5 Mbps | `tests/integration/bitrate_readout.test.ts : "BottomConsole bitrate text falls in [9.5, 10.5] Mbps when receiver running"` | 12 |
| **F4 (FIX)** | CRC fail rate < 0.1% | **`project/crates/rti_core/tests/pcm_decode.rs` [existing] + `project/crates/rti_core/tests/pcm_sync_scan.rs` [existing] + F1 perf gate adapted bench** (architect revision 10: adapt existing tests rather than create new). | 6 |
| G1 | TS c8 line cov ≥80% | CI gate `vitest run --coverage --coverage.thresholds.lines=80` | 0, 12 |
| G2 | Rust tarpaulin cov ≥80% | CI gate `cargo tarpaulin --manifest-path project/crates/rti_core/Cargo.toml --fail-under 80` **on new files only** (existing crate grandfathered) | 5, 12 |
| G3 | First commit RED, then RED/GREEN explicit | git history check; commit msgs prefixed `[RED]` or `[GREEN]` | all phases |
| G4 | 새 production 코드 라인 cover | `vitest run --coverage` CI gate per PR | 0, 12 |

---

## 6. ADR — Architecture Decision Record

### Decision

Adopt **Path B**: port `public/app/*.jsx` (babel-standalone, 11.2k LOC across 19 files + 1.7k LOC styles.css) to a TypeScript module architecture under `project/src/`, backed by a `LayoutNode` discriminated-union type that includes `SplitNode | TabNode | PanelNode | FlatGridNode`. The `'workstation-default'` preset uses **`FlatGridNode`** to reproduce the prototype's 14-panel heterogeneous flat 12-col grid exactly (slice 1 frozen geometry); recursive split mutation (drag-to-split A4) **converts** the FlatGridNode cell into a SplitNode subtree on first split. Wire the first Strip panel's Power Bus Voltage channel (#1001) to live data from the **already-existing** Rust ingest pipeline at `project/crates/rti_core/`, extended only with a small `pcm::generator` submodule (≤200 LOC) that emits 10 Mbps loopback PCM frames. Tauri shell at `project/src-tauri/src/main.rs` is **already wired** for the 5 spec-named commands; v2 makes ≤30 LOC of surgical changes to ensure default channel #1001 subscription. Keep the remaining 13 panels and the 3 non-Workstation sheets reading from in-memory mock (the prototype's `bus.jsx` synthesizer ported to TS).

### Drivers (in order)

1. **TDD requirement** (spec §1 G1–G4) — babel-standalone runtime cannot be type-checked or unit-tested with reasonable coverage tooling.
2. **Type safety** (spec §10–§11 contracts) — domain types must be enforceable at compile time so panel/store/bridge boundaries don't drift.
3. **Spec compliance** (spec §22) — 30+ acceptance criteria require structured stores, bridge contract, and quality gates that the JSX prototype does not enforce.
4. **Visual fidelity user demand** ("최대한 비주얼 살려달라", Round 1) — port must preserve warm-graphite + amber theme, IBM Plex + JetBrains Mono fonts, exact panel arrangement, and 4-sheet topology — backed by a PR-blocking Playwright pixel-diff gate.
5. **Strict perf bar** (Round 11) — 60s × 10 Mbps × 0% loss is achievable with the existing Rust UDP path; no new sidecars, no fixture files, no Node-process bridge.
6. **Existing assets are canonical** (architect §0) — `project/crates/rti_core/` and `project/src-tauri/src/main.rs` are not rewrites; they are the foundation. v2 extends.

### Alternatives Considered (and Why Not)

- **Path A (babel-standalone runtime preserved + bridge added):** invalidated in deep-interview Round 1. Cannot reach 80% TS coverage; type safety zero; CDN imports violate spec §14, §19.
- **Path C (hybrid: keep JSX for visual demo, add TS shell separately):** invalidated in Round 1. Doubles maintenance, runtime ambiguity, prevents store/bridge integration.
- **Path D (rebuild from scratch):** invalidated in Round 1. Discards 11k LOC of vetted visual design.
- **v1's B1 Cargo workspace at `src-tauri/`:** invalidated by architect §0 + §2.2. Duplicates `project/crates/rti_core/`. v2 keeps single-crate dependency layout.
- **v1's B2 root `crates/` workspace:** invalidated for the same reason.
- **B3 three separate Cargo projects:** invalidated on build-time and DX grounds (v1 §1.3).
- **Mock data as JSON (spec §18 default):** invalidated in Round 8. TS source files give compile-time type checking.
- **`*_test.js` Node harness as-is:** invalidated in Round 6. Cannot test React. **6 contract-relevant `*_test.js` files PORT to vitest (architect §7.7)**; markdown + smoke files demote to `legacy/`.
- **Flat 12-col grid as primary backing model (drop spec §7.1 LayoutNode):** invalidated in Round 10. **Compromise: FlatGridNode added to LayoutNode union as a slice-1 frozen-geometry variant (architect revision 6); recursive splits remain the canonical mutation model for slice 2+.**
- **W2 (defer 3 panel kinds to slice-1.5):** invalidated on A6 grounds. v2 chooses W1 (defer 9 STUB modals if pacing slips at week 5).
- **W3 (cut Rust extension):** invalidated on F-series grounds.
- **jsdom F2 as the perf gate:** invalidated by architect Tension 2.6. v2 splits F2 into a real-browser Playwright gate (phase 14) and a unit-level RAF-coalescer sanity test.

### Why Chosen (ranked rationale)

1. Only path satisfying all of: TDD purity (G1–G4), spec contracts (§10–§11), visual fidelity, offline-first, AND principled reuse (P3) of existing Rust.
2. Existing `project/crates/rti_core/` + `project/src-tauri/src/main.rs` cover ~95% of the data-plane work; slice 1 extends rather than rewrites.
3. `FlatGridNode` is principled: it's a discriminated-union variant for *frozen* layouts (presets, replays), distinct from runtime drag-mutation `SplitNode`. Documented migration path: drag-to-split converts FlatGridNode cell into SplitNode subtree on first user mutation.
4. PR-blocking visual + perf gates close the v1 "gate that doesn't gate" failure mode.

### Consequences

**Positive:**
- Testability: every store and panel has unit tests; coverage gated in CI; visual + perf gated in Playwright.
- Refactor safety: TypeScript catches breaking changes across 5 stores × 13 panel kinds × 13 modals.
- Offline-first: no CDN dependencies; airgap-deployable from day 1.
- Slice-2 momentum: real LLM, replay, multi-monitor, etc. all bolt onto stable contracts.
- Reuse: Rust effort drops ~1.5–2 weeks vs v1.

**Negative:**
- **Porting effort: 6–8 person-weeks single-eng / 4–5 weeks pair** (architect revision 7 baseline). v1's 3–5 estimate was optimistic by ~50%.
- **Slice-1.5 cut line at week 5:** 9 STUB modals may slip to slice-1.5 if pacing falters. Communicated upfront.
- **Visual regression risk:** the FlatGridNode preset rendering must match prototype's flat-grid layout pixel-faithfully; phase 13 PR-blocking gate enforces this.
- **Performance discipline:** RAF coalescing + extracted-renderer pattern across 13 panels is non-trivial. Phases 9 (E1 RAF-budget per panel) + 14 (e2e_60fps) catch breakage.
- **Grandfathered Rust coverage:** `rti_core` existing tests are not retroactively held to ≥80%; only new files (pcm/generator.rs, bin/pcm_gen.rs) are gated.

### Follow-ups (slice 2+)

- Drag-to-split FlatGridNode → SplitNode mutation UI polish.
- Replay mode (load recorded raw/decoded data, scrub timeline).
- Real LLM provider with local Ollama/Gemma.
- E2E test layer expansion beyond visual + perf gates.
- Multi-monitor / pop-out windows.
- Workspace import/export to file.
- Real offline map tile cache (MBTiles via Rust tile server).
- Full IRIG channel mapping editor.
- Port `hexmap.jsx` and `rf.jsx` to TSX.
- Real anomaly detection (replace static fixture).
- Real Tauri impl of remaining 22 commands (LLM/SimDIS/MATLAB/export beyond demos).
- 9 STUB modals → FULL impls (slice-1.5 if cut applies).

---

## 7. Risk Register — updated

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | **Babel-CDN → npm migration breaks visual fidelity** (kept from v1) | Medium | High (user-facing) | Keep `public/app/` pristine as the visual-diff oracle. **Phase 13 Playwright pixel-diff is PR-blocking** (architect revision 4). Use `@fontsource/*` packages instead of Google Fonts. Port `styles.css` byte-for-byte first. CI baseline cached as artifact, regenerated on first run, tolerance 5px text / 2px chrome / 10px canvas. |
| **R2 (DEMOTED)** | **Rust UDP packet loss under load** (demoted from v1 — existing impl handles it) | Low | Medium | The existing `ingest::udp::UdpReceiver` and `ingest::managed::ManagedReceiverRuntime` already validate up to 30 Mbps in `udp_receiver.rs` tests. The existing throughput-smoke tests (which v2 adapts in phase 6) are the operational proof. Demoted from v1 R2 because the impl already exists and is tested. Mitigation: phase 6's 60s `--ignored` run is the definitive gate. |
| **R3** | **FlatGridNode preset doesn't visually match prototype** | Medium | Medium | `FlatGridNode` stores literal `(gx,gy,gw,gh)` cells, so reproduction is mechanical. Phase 10 unit test asserts each cell matches `INITIAL_PANELS` from prototype exactly. Phase 13 Playwright pixel-diff is the visual confirmation (PR-blocking). |
| **R4** | **60 FPS UI under live data + canvas charts** | Medium | High (F2 gate) | StreamStore RAF coalescer with **single `notifyListeners()` per RAF tick** (not per-panel selectors). Panels subscribe via `panelDataRefs` ref + RAF read. `React.memo` per panel. **Phase 9 E1 RAF-budget assertion catches per-panel cost; phase 14 Playwright real-browser gate catches end-to-end FPS** (architect revisions 5, 9). |
| **R5** | **80% coverage on canvas-heavy panels** | Medium | Medium (G1 gate) | Extract render logic into pure functions (`stripRenderer.ts`, `waterfallRenderer.ts`, `attitude3d/sceneBuilder.ts`, `trajectory3d/sceneBuilder.ts`, `relationgraph/forceSetup.ts`) — these get unit-test coverage. Wrapper TSX is ~30 LOC. **Phase 13 Playwright pixel-diff is the visual correctness gate** (PR-blocking, architect revision 4). |
| **R6 (NEW)** | **Existing `rti_core` API drift during integration** | Medium | Medium | Phase 7's surgical changes to `main.rs` may surface latent issues in `ManagedReceiverRuntime` snapshot semantics or `subscribe_panel_data` payload shape. Mitigation: phase 12's `tests/integration/end_to_end_bitrate.test.ts` is the cross-stack canary; the existing `tests/managed_receiver_loop.rs`, `tests/bridge_contract.rs`, and `tests/receiver_session.rs` provide regression coverage. If `main.rs` changes uncover deeper API mismatches, the fallback path is to add `pcm-generator` as a sibling crate at `project/crates/pcm-generator/` (introducing a `[workspace]` in `project/Cargo.toml`) rather than a `[[bin]]` in `rti_core`. |
| **R7 (NEW)** | **Effort overrun beyond 6–8 weeks** | High | Medium | **Slice-1.5 cut line at week 5** (architect revision 7): if phases 0–10 are not green, defer 9 STUB modals (LayoutPresetModal, LLMDrawer, ChannelMappingEditor, StreamConfigModal, SequenceValidator, TestReportModal, RecordingLibrary, WorkspaceManagerDialog, SettingsDialog). Slice 1 still ships ExportModal, MatlabModal stub, OfflineAssetsDialog, CommandPalette + all spec §22 acceptance items. User communicated upfront. |

---

## 8. Test Strategy

### 8.1 TS test stack (Vitest + c8)

- Runner: `vitest run` (CI) and `vitest` (watch).
- Env: `jsdom` for component tests; `node` for store/bridge/mock unit tests.
- Component lib: `@testing-library/react` + `@testing-library/user-event`.
- Coverage: `@vitest/coverage-v8` with thresholds `lines: 80, branches: 75, functions: 80, statements: 80`. **Excludes (architect §7.5): `**/*.d.ts`, `**/types/*.ts`, `**/__mocks__/**`.**
- Mocks: hand-rolled mocks in `tests/__mocks__/` for `__TAURI__`, MapLibre (asserts no network), three.js Canvas. No `vi.mock` of own modules unless absolutely needed.
- Setup: `tests/setup.ts` configures jsdom RAF polyfill, IBM Plex font-face fallback, `ResizeObserver` mock.
- **Migration (architect §7.7):** triage of 24 `*_test.js` files:
  - **PORT to vitest (phase 4):** `bridge_schema_test.js`, `bridge_client_test.js`, `app_contract_test.js`, `pcm_decoder_test.js`, `channel_metadata_test.js`, `scaffold_contract_test.js` → `tests/integration/ported/*.test.ts`.
  - **DEMOTE to `tests/integration/legacy/`** with `npm run test:legacy` (markdown PR-blocking) and `npm run test:legacy:nightly` (smoke).

### 8.2 Rust test stack (cargo + tarpaulin)

- Unit: `cargo test --manifest-path project/crates/rti_core/Cargo.toml` runs every `#[test]` and `tests/*.rs`.
- Perf: `cargo test --manifest-path project/crates/rti_core/Cargo.toml --test pcm_throughput_smoke -- --ignored` runs the 60s F1 variant (existing test ADAPTED to call new generator submodule).
- Per-PR: existing 5s short variant (`RUN_PERF_SMOKE=1 cargo test --test pcm_throughput_smoke`).
- Coverage: `cargo tarpaulin --manifest-path project/crates/rti_core/Cargo.toml --fail-under 80` — **applies to new files (pcm/generator.rs, bin/pcm_gen.rs); existing crate grandfathered.**
- Cross-stack E2E (phase 12): `tests/integration/end_to_end_bitrate.test.ts` — vitest-side test that drives the generator submodule + ManagedReceiverRuntime via a thin Node binding harness or by spawning `pcm_gen` + `tauri:dev`.

### 8.3 Visual regression (Playwright, **PR-BLOCKING — architect revision 4**)

- `playwright.config.ts` configured for desktop Chromium @ 1920×1080, headless in CI Docker.
- One spec file: `tests/e2e/visual_regression_workstation.spec.ts` boots `npm run dev`, navigates to `http://127.0.0.1:5173/`, screenshots the DockGrid, compares to baseline `tests/e2e/__snapshots__/workstation-default.png`.
- Baseline image is generated **in CI itself on first `e2e:visual` run** and cached as a workflow artifact (mitigates Scenario C: cross-machine font drift).
- **Tolerance: 5 px text-heavy regions, 2 px chrome, 10 px canvas content** (architect revision 4).
- `npm run e2e:visual` runs it; **PR-blocking** (no longer opt-in).

### 8.4 Real-browser perf gate (Playwright, **PR-BLOCKING — architect revision 5**)

- `tests/e2e/e2e_60fps.spec.ts`: Playwright headed Chromium navigates to `npm run tauri:dev` (or a stub harness exposing the same StreamStore + bridge surface that ingests from the running generator submodule). Drives 10s of live data. Collects RAF-callback `performance.now()` deltas.
- **Gate: `mean_frame_ms ≤ 16.7 && p95_frame_ms ≤ 25`.**
- The vitest jsdom test `tests/perf/streamstore_raf.test.ts` stays as **unit-level RAF-coalescer sanity (not the gate)**: asserts StreamStore's notifyListeners() fires ≤1×/RAF tick under 200 simulated samples.

### 8.5 CI gate composite

```
1. npm install                              # cache by package-lock hash
2. npm run lint                             # eslint + tsc --noEmit
3. npm run test:cov                         # vitest run --coverage --coverage.thresholds.lines=80
4. npm run test:legacy                      # markdown-content *_test.js (PR-blocking)
5. cargo test --manifest-path project/crates/rti_core/Cargo.toml             # short tests
6. cargo test --manifest-path project/crates/rti_core/Cargo.toml -- --ignored # 60s F1 perf (PR-blocking via scripts/check-perf.mjs)
7. cargo tarpaulin --manifest-path project/crates/rti_core/Cargo.toml --fail-under 80
8. npm run e2e:visual                       # Playwright pixel-diff (PR-BLOCKING)
9. npm run e2e:perf                         # Playwright e2e_60fps (PR-BLOCKING)
10. (nightly only) npm run test:legacy:nightly   # smoke *_test.js
```

PR is blocked if any of 2–9 fail. **Steps 8 and 9 are new in v2 (architect revisions 4, 5).**

---

## 9. Open Questions for Architect/Critic — **target ≤2**

Architect open questions §7.1–§7.7 are all **locked** in v2 (see §1.3 cargo, §1.1 P4 maplibre, §1.4 W1 effort, §8.1 c8 exclusions, §8.1 test triage, §1.4 Zustand by reference). Remaining:

1. **Is W1's STUB-modal cut acceptable to user?** v2 ships ExportModal (FULL), MatlabModal (STUB), OfflineAssetsDialog (PLACEHOLDER), CommandPalette (FULL), and **9 other modals as STUB** (slice-1.5 if cut applies at week 5). Spec §22 names only ExportModal (A9), MatlabModal (A10), and OfflineAssetsDialog (A12); the 9 STUB modals satisfy A10-style "modal exists" without full impls. **User confirmation needed before slice 1 sign-off.**
2. **Cross-stack E2E test feasibility:** `tests/integration/end_to_end_bitrate.test.ts` (Scenario B mitigation) needs to either drive the Rust generator submodule from vitest via a Node-side spawn of `pcm_gen` binary OR exercise the path through Tauri test helpers. **The exact harness (Node spawn vs Tauri test runner) is left to the executor; both viable.** No re-debate needed at consensus stage.

---

## 10. Plan Summary (for the consensus pipeline)

- **Plan file:** `C:\jkim\RealTimeInsight-main\.omc\plans\rti-bridge-wire-slice1-plan-v2.md`
- **Phases:** 15 (phase 0 tooling + phases 1–14 implementation/verification, phase 14 NEW for real-browser perf gate)
- **Total acceptance criteria mapped:** 30 (A1–A12, B1–B3, C1–C4, D1–D3, E1–E3, F1–F4, G1–G4) — **fixes for A5, C4, E1, F1, F2, F4** vs v1
- **New files (revised counts):** ~110 TS source + ~80 TS test + **3–5** new Rust + 6 ported `*_test.js` → vitest + 17 panel ports + 13 modals (4 FULL/STUB/PLACEHOLDER + 9 STUB)
- **Effort estimate:** **6–8 person-weeks single full-stack engineer / 4–5 weeks pair** (architect revision 7), with **slice-1.5 cut line at week 5** deferring 9 STUB modals if phases 0–10 not green.
- **Effort delta from v1:** ≈ −1.5 to −2 weeks of Rust greenfield removed (Phase 5 collapses from 25 new files to 3–5; Phase 7 collapses from greenfield Tauri shell to ≤30 LOC delta on existing `main.rs`); offset by +0.5 week for new phase 14 (Playwright real-browser perf) and +0.5 week for porting 6 contract `*_test.js` files (architect §7.7).

---

## 11. DELIBERATE Mode Additions

The strict perf gate (F1–F4) plus visual-fidelity demand keep this in DELIBERATE mode. Pre-mortem and expanded test plan retained from v1 with v2 corrections.

### 11.1 Pre-mortem (3 failure scenarios) — updated

**Scenario A — "We shipped slice 1 and the demo is at 35 FPS not 60."**
- Root cause: 14 React panels each subscribing to StreamStore via individual `useSyncExternalStore`, every sample triggers per-panel reconciliation.
- Why it happened: `useStreamSubscription` hook took the easy path with one selector per channel; RAF coalescing was added to the buffer fill but not to the React notify path.
- **Mitigation now:** phase 3 unit test `streamStore.test.ts`: subscribe with 14 different panels, push 200 samples, assert exactly **1 React notification per RAF tick**. Phase 9 per-panel **E1 RAF-budget assertion** (architect revision 9). Phase 14 **real-browser e2e_60fps gate** (architect revision 5) is the integration-time canary. The notify path uses a single `notifyListeners()` called from the RAF coalescer; per-panel selectors compute on read, not on push.

**Scenario B — "Cargo bench is green but `npm run tauri:dev` drops every 10th frame."**
- Root cause: Rust loopback measures generator→receiver in-process; the Tauri shell adds command-channel + IPC + JSON serialization overhead, bottleneck moves there.
- Why it happened: the perf gate tested only the Rust loopback, not the end-to-end Rust→Tauri→Webview→StreamStore path.
- **Mitigation now:** phase 12 adds `tests/integration/end_to_end_bitrate.test.ts` that drives the generator submodule + ManagedReceiverRuntime, drains events for 30s via `bridge.drainManagedReceiverEvents()`, computes observed bitrate at the StreamStore output, asserts ≥9.5 Mbps. Phase 14 e2e_60fps additionally measures FPS under the same path. **Two independent gates** beyond F1.

**Scenario C — "Phase 13 visual regression keeps failing because fonts render slightly differently in Chromium-headless vs prototype's Chromium."**
- Root cause: font-rendering is platform/version-sensitive even with `@fontsource` packages; baseline screenshot taken on dev laptop, CI runs on a different OS.
- Why it happened: assumed `@fontsource` would produce byte-identical text rendering across machines.
- **Mitigation now:** phase 13 baseline is generated **in CI itself on the first `e2e:visual` run** and cached as a workflow artifact. PRs compare to the cached baseline. **Tolerance: 5 px text-heavy, 2 px chrome, 10 px canvas content.** PR-blocking but tolerance-tuned to absorb cross-version anti-aliasing without false positives.

### 11.2 Expanded test plan (unit / integration / e2e / observability)

| Layer | Coverage | Tools | Gate |
|---|---|---|---|
| **Unit (TS)** | Stores, hooks, mock data, bridge schemas, render fns | Vitest + c8 | ≥80% lines (G1) |
| **Unit (Rust, new files)** | `pcm::generator`, `bin/pcm_gen` | cargo test + tarpaulin | ≥80% lines (G2, new files only) |
| **Unit (Rust, existing)** | All existing modules | cargo test | regression-only (grandfathered) |
| **Component (TS)** | Each shell + panel + modal renders, handles user input, propagates state. **Per-panel E1 RAF-budget assertion** (architect revision 9). | Vitest + jsdom + RTL + user-event | covered by ≥80% gate + E1 budget |
| **Integration (TS)** | Full app boot, drag-drop overlay, drag-drop split (FlatGridNode → SplitNode), anomaly→insight, save/restore, mode switch, channel search, export quality policy, **per-panel render-side global cursor sync** (architect revision 8), bitrate readout | Vitest + jsdom + mocked Tauri + real synthesizer | all of §5 spec §22 items pass |
| **Integration (Rust)** | Generator → managed-receiver loopback (5s short, 60s `--ignored`), CRC failure path, bitrate meter accuracy, command contract round-trip — **all via existing tests adapted, no greenfield** | cargo test + cargo test --ignored | 0% loss, CRC <0.1% |
| **E2E (cross-stack)** | Tauri shell boot → managed receiver event → StreamStore → BottomConsole bitrate readout | `tests/integration/end_to_end_bitrate.test.ts` (vitest, real bridge against spawned `pcm_gen` + tauri-shell) | ≥9.5 Mbps observed at StreamStore output |
| **Visual (PR-BLOCKING)** | DockGrid 14-panel layout pixel-diff vs prototype | Playwright headless Chromium | PR-blocking; tolerance 5/2/10 px |
| **Performance — real browser (PR-BLOCKING)** | RAF tick budget under 10s of live data via tauri:dev | Playwright headed Chromium | `mean_frame_ms ≤ 16.7 && p95_frame_ms ≤ 25` (F2) |
| **Performance — Rust loopback (PR-BLOCKING)** | Generator → receiver 60s @ 10 Mbps | cargo test --ignored + scripts/check-perf.mjs | 9.5–10.5 Mbps, 0 dropped, CRC <0.1% (F1, F3, F4) |
| **Observability (manual)** | Phase 12 produces `slice-1-acceptance-report.md` listing every spec §22 item with PASS/FAIL status | `scripts/build-acceptance-report.mjs` parses vitest JSON + cargo JSON + tarpaulin XML | manual review before slice 1 sign-off |

### 11.3 Rollback plan

If slice 1 cannot meet F1–F4 within 8 weeks (single-eng) / 5 weeks (pair):

- **Tier 1 (preferred):** trigger slice-1.5 cut at week 5 (defer 9 STUB modals); slice 1 ships data-plane vertical + ExportModal + MatlabModal stub + OfflineAssetsDialog + CommandPalette + all spec §22 acceptance items.
- **Tier 2 (if F-series specifically fails after Tier 1):** relax F1 from "60s 10 Mbps 0% loss" to "30s 5 Mbps <0.5% loss" *only* on a `slice-1-tier-2` branch; ship that as tech preview while continuing strict bar on `slice-1-tier-1`. **User must sign off on the relaxation explicitly.** Spec §22 F-series do not allow silent relaxation.
- **Tier 3 (worst case):** revert phase 14 e2e_60fps from PR-blocking to nightly-only; ship slice 1 with phase 6 Rust F1 as the only perf gate. **User sign-off required.** This is the path of last resort.

---

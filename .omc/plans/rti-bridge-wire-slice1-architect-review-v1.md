# RealTimeInsight Bridge-Wire Slice 1 — Architect Review v1

- Plan reviewed: `.omc/plans/rti-bridge-wire-slice1-plan-v1.md`
- Spec: `.omc/specs/deep-interview-rti-bridge-wire.md`
- Stage: 2 of 3 (Architect, READ-ONLY)
- Verdict: **UNSOUND** — return to Planner

---

## 0. Decisive Pre-Finding (changes the whole review)

The spec's Round-5 "contrarian discovery" and the plan's Decision Driver #3 both state "zero existing Rust." This is **factually false**. The repository already contains a substantial Rust implementation at `project/` (not the repo root which the deep-interview searched):

- `project/src-tauri/src/main.rs` — Tauri 2 shell with `#[tauri::command]` impls of `current_ingest_status`, `subscribe_panel_data`, `start_managed_receiver_loop`, `stop_managed_receiver_loop`, `managed_receiver_status`, `drain_managed_receiver_events`, `live_session_status`, `start_live_session`, `stop_live_session`, `init_demo_receiver_session`, `export_demo_csv`, `write_demo_csv_export`, plus more. File imports `rti_core::bridge`, `ingest::managed`, `export`, `graph`, `llm`, `matlab`, `simdis`, `video`, `jobs`, `pcm`.
- `project/crates/rti_core/` — fully realized lib crate with modules: `bridge/`, `ingest/{managed,pipeline,receiver,udp}`, `pcm/`, `data_ref/`, `stream/`, `export/`, `graph/`, `llm/`, `matlab/`, `simdis/`, `video/`, `replay/`, `mission_edge/`, `assets/`, `runtime_policy/`, `jobs/`. 30+ Rust test files including `pcm_throughput_smoke.rs`, `datagram_throughput_smoke.rs`, `datagram_soak_smoke.rs`, `multi_rate_soak_smoke.rs`, `udp_receiver.rs`, `managed_receiver_loop.rs`, `pcm_performance.rs`.
- `project/src-tauri/Cargo.toml` declares `rti_core = { path = "../crates/rti_core" }`. Workspace root: **`project/`**, not `src-tauri/`. There is no `[workspace]` table; this is a single-project Cargo layout, not a workspace.

The plan's File Tree §3 proposes `src-tauri/Cargo.toml [NEW] workspace = ["crates/*"]` with three new crates `pcm-generator`, `pcm-receiver`, `tauri-shell`. **This duplicates code that already exists** under different module names. Phases 5–7 are largely redundant; phases 12 and the F1/F3/F4 perf gate already have throughput-smoke tests in `project/crates/rti_core/tests/`.

This is a load-bearing error. Every downstream reasoning step that assumes Rust is greenfield (effort estimate, phase ordering, "Path B requires Rust bring-up") must be re-derived. Returning to Planner is therefore unavoidable — but the rest of the review still has value because the TS-port half of the plan is independent of this error.

---

## 1. Steelman Antithesis

**Strongest case AGAINST Path B + LayoutNode preset + new Cargo workspace:**

> *"Path B-prime: keep the working `public/app/*.jsx` runtime as the production demo for slice 1, harden it with a thin TS shim that proxies to the existing `rti_core` Tauri commands, and defer the full TS port to slice 2 once requirements are validated against a running 60-FPS UI."*

Argument:

1. Slice 1's real goal is a 10 Mbps PCM data path → live Strip in 14-panel Workstation with visual fidelity. The prototype already renders 14 panels at 60 FPS; `rti_core` already streams; only **bridge wiring** is missing.
2. The prototype is canonical for look-and-feel by Principle 1. Re-rendering it in TSX accomplishes nothing the original did not, except introducing visual-regression risk (R3).
3. TDD-pure 80% coverage on canvas-heavy panels is theater (R5 admits this). The wrapper is ~30 LOC; coverage measures wrapper, not rendering. Playwright is opt-in in §8.4. CI green proves nothing about the canvas.
4. 4-week-minimum effort for 110 new TS files + 80 test files + 13 panel ports + 13 modal ports is the dominant cost. Building 200+ files first to *learn* whether bridge architecture is right is opposite of fast learning.
5. Existing `App.tsx` already proves bridge wiring works against `rti_core`. Adding 1 panel that subscribes to #1001 via existing `bridge.subscribePanelData` is a 1-week task.
6. Spec §22 criteria describe behaviors observable in a running app — JSX vs TSX is irrelevant to the user. G1 only applies to *new* TS code; a thin shim has very little new TS.

**Why it still loses:**

1. **G1, G2, G4 require TS coverage gates on production code.** Babel-standalone JSX is not statically type-checked, has no AST that c8 can instrument. Round 1, 4, 6 of deep-interview were explicit: TDD pure 80% non-negotiable. Steelman fails G outright.
2. **Spec §10–§11 contracts cannot be enforced at compile time on JSX.** A single rename in `rti_core` breaks the demo at runtime with no warning.
3. **Offline-first (Principle 4)** is impossible with `unpkg` CDN imports. Replacing CDN with npm in JSX is already 30% of Path B.
4. User said "preserve visuals as much as possible," not "ship the JSX prototype." Visual fidelity = property of rendered DOM, not source format.
5. Slice 2+ momentum (real LLM, replay, multi-monitor) need typed stores. Steelman defers cost without reducing it.

Antithesis is **strong but loses** — Path B is correct. But it exposes a real risk: the plan over-spends on greenfield work that **duplicates existing assets**, particularly Rust.

---

## 2. Real Tradeoff Tensions

### Tension 2.1 — TDD-pure 80% coverage vs canvas-heavy panels (severe)

R5 mitigation works for Strip/Waterfall but breaks for:
- **Attitude3D / Trajectory3D** (`@react-three/fiber`). Render tree built inside `<Canvas>` via JSX; "scene-builder fn tested in isolation" covers a small fraction.
- **Map2DPanel** (MapLibre). Constructor calls `requestAnimationFrame`, WebGL, DOM measurement APIs jsdom doesn't implement. `vi.mock('maplibre-gl')` tests nothing useful.
- **VideoPanel**. `<video>` behavior in jsdom is null. Cursor-sync logic is the only testable surface.
- **RelationGraphPanel** with `d3-force`. Simulation runs on RAF; freezing it for snapshot removes the thing being tested.

**Risk:** 80% gate is reached by testing wrappers; rendering logic uncovered. CI passes; bugs ship. Phase 13 Playwright is opt-in (§8.4), so visual correctness has **no enforced gate** in slice 1.

### Tension 2.2 — Cargo workspace at `src-tauri/` vs existing `project/crates/rti_core/` (decisive)

Plan locks B1: workspace under `src-tauri/` with new crates. But `project/crates/rti_core/` already has `pcm`, `ingest::udp`, `ingest::managed`, `ingest::pipeline`, `ingest::receiver` modules + 30+ tests. B1 means:
- Ignoring `rti_core` and re-implementing — wastes weeks, two parallel impls diverge.
- Migrating modules into new crates — large refactor, breaks existing tests.
- Adding crates alongside `rti_core` — 3-crate workspace + standalone crate is exactly the B3 the plan invalidated.

The actual question: extend `rti_core` with generator submodule + CRC-validating receiver wrapper, or fork into workspace? Plan never asks because it never opened the existing code.

### Tension 2.3 — `LayoutNode` preset reproducing flat 12-col grid (leaky abstraction)

Prototype's `INITIAL_PANELS` (`public/app/app.jsx:3-19`) uses CSS `grid-column: gx / span gw; grid-row: gy / span gh` on 12×12. Sample positions:
- p1: (1,1) span 5×3 / p2: (6,1) span 4×3 / p3: (10,1) span 3×3
- p11: (1,10) span 4×2 / p12: (5,10) span 5×2 / p13: (10,10) span 3×2

No clean recursive 2-level split reproduces this. Row 1: 5/4/3; row 4: 4/4/4; row 10: 4/5/3. Column ratios differ per row. R3 mitigation ("outer split = horizontal 5/4/3, then nested vertical splits") only works if every row's ratio is identical — it isn't.

To reproduce faithfully: vertical first (rows 3,3,3,2 high), horizontal per row with three different ratios. 2-level tree, 4 children L1, 3-5 children L2 each, ratios `[5,4,3]`, `[4,4,4]`, `[3,2,3,2,2]`, `[4,5,3]`. Every prototype tweak requires recomputing **two levels of ratios**, not one cell. Leaky abstraction for slice 1 lifetime, where prototype is visual oracle (Principle 1).

R3 unit test ("assert preset reproduces every panel's `(col_start, row_start, col_span, row_span)`") cannot pass without nested-split structure being correct.

### Tension 2.4 — Browser dev mode `fallbackInvoke` retained (maintenance fork)

§3 keeps `fallbackInvoke.ts` for `npm run dev`, real Rust for `npm run tauri:dev`. Two problems:
1. Fallback already lies: `App.tsx:155` `live_session_status` returns `running: false`; if dev iterates assuming this and Rust returns `running: true`, behavior diverges.
2. Mock synthesizer at 30 Hz vs Rust at 200 Hz @ 10 Mbps — F2 (60 FPS under live) **cannot be tested in browser dev** because load is 7× lower. Slice-1 perf bugs surface only in `tauri:dev`, late.

### Tension 2.5 — 26 components in 3–5 weeks under TDD pure (effort)

13 panels + 13 modals + 5 shell + 5 stores + 4 sheets + ~80 tests + Rust + Playwright + reporting. Plan says "3-5 weeks." Optimistic by ~50%:
- 13 panels × 200-400 LOC + 1500 LOC tests + pure render fn extractions.
- Per-panel visual fidelity validation = manual work.
- LayoutNode preset reverse-engineering = 1-2 days alone (Tension 2.3).
- Three.js / MapLibre / d3-force jsdom adaptations each (Tension 2.1).

Realistic: 6-8 weeks single-eng, 4-5 pair. Plan's R-series misses effort overrun as a top-5 risk; should be R0.

### Tension 2.6 — StreamStore RAF coalescing as the answer to 60 FPS

Driver #1 sound in principle but hidden assumption: 14 panels each consuming `panelDataRefs` ref + RAF read. R4 asserts "≤1×/frame." But:
- 14 panels × canvas redraw + React reconcile + Strip decimation + Waterfall FFT + Map2D track + R3F scene + d3-force tick = **5–10 ms optimistically**.
- 16.7 ms budget gone before StreamStore emits first sample.
- F2 runs in jsdom + RAF mock (§8.5). jsdom doesn't run real canvas/WebGL. F2 measures synthetic flush callback, not real rendering. **F2 as designed cannot fail** until production hardware testing.

"Gate that doesn't gate" failure mode. Pre-mortem Scenario A identifies it but fix ("phase 3 unit test asserts exactly 1 React notification per RAF tick") still doesn't measure rendering cost.

---

## 3. Synthesis (where viable)

### S1. Replace "Rust bring-up" with "Rust extension"
- **Phase 5-revised:** Extend `project/crates/rti_core/` with `pcm::generator` submodule (UDP sender; reuse existing `pcm::create_test_frame`, `frame_to_bits`) + CRC-fail-injection harness. Existing `ingest::udp::UdpReceiver`, `ingest::managed::ManagedReceiverRuntime`, `pcm::decode_bitstream` reused.
- **Phase 6-revised:** Add 60s 10 Mbps criterion bench at `project/crates/rti_core/benches/pcm_throughput.rs`. Existing `tests/pcm_throughput_smoke.rs`, `datagram_throughput_smoke.rs`, `datagram_soak_smoke.rs` already exercise the path; bench is parameter sweep, not new code.
- **Phase 7-revised:** `project/src-tauri/src/main.rs` already registers the 5 commands. Diff is small: add `#[tauri::command]` wrapper around generator + ensure receiver feeds `panel_stream_data` events for #1001.
- **Effort saved:** ~1.5–2 weeks; risk eliminated: workspace fork.

### S2. Make Playwright pixel-diff a CI gate, not opt-in
- 80% line-coverage gate is performative without it. Move `npm run e2e:visual` from §8.4 step 8 (manual) to step 5 (PR-blocking, headless Chromium in CI Docker). Tolerance: 5 px text, 2 px chrome, 10 px canvas (canvas content timing-dependent — snapshot chrome only).
- Without this, R1, R3, R5 mitigations have no enforcement.

### S3. Replace LayoutNode preset round-trip with bidirectional invariant + escape hatch
- Assert preset produces (col, row, span, span) per panel AND serialize tree → deserialize → render → DOM positions match. Catches "leaky abstraction" silent divergence.
- Add **`FlatGridNode`** to LayoutNode union for prototype's slice-1 frozen geometry. Spec §7.1 union becomes `SplitNode | TabNode | PanelNode | FlatGridNode`. Slice 2 migrates to recursive splits when drag-to-split lands; slice 1 ships prototype geometry verbatim.
- Principled spec deviation: spec §7.1 LayoutNode is for *runtime drag-split mutation*; prototype's frozen layout is a different domain object.

### S4. Add end-to-end perf test with real rendering
- F2 in jsdom is fake gate. Add `tests/perf/e2e_60fps.spec.ts` under Playwright headed Chromium, navigating to `npm run tauri:dev` (or stub harness), measuring `performance.now()` deltas across 10s of live data. PR-blocking: `mean_frame_ms <= 16.7 && p95_frame_ms <= 25`.

### S5. Eliminate `fallbackInvoke` for the bridge-wired channel
- Slice 1: channel #1001 (Power Bus Strip) **only renders when `tauri:dev` is running**. Browser dev mode shows "Bridge offline — start `tauri:dev`" placeholder for that one panel. Other 13 keep mock data in both modes.
- Tension 2.4 fork narrows from "two backends drift" to "one panel renders in only one mode" — acceptable, forces Rust path dogfooding.

### S6. Re-baseline effort to 6–8 weeks single / 4–5 weeks pair
- Plan §10 estimate optimistic. Make it explicit. Add slice-1.5 cut line: if week 5 hits without phases 0–10 green, defer phase 11 modal ports (except ExportModal — A9/D3 require) to slice 2. Slice 1 ships data-plane vertical; slice 2 ships UI completeness.

---

## 4. Principle-Violation Flags

| Principle | Phase | Violation | Severity |
|---|---|---|---|
| P3 Reuse before rewrite | Phase 5, 6, 7 | New `src-tauri/crates/{pcm-generator,pcm-receiver,tauri-shell}` duplicate `project/crates/rti_core/{pcm,ingest::udp,ingest::managed,ingest::pipeline}` and `project/src-tauri/src/main.rs`. | **Critical** |
| P3 Reuse before rewrite | Phase 1 | `mock/synthesizer.ts` ports `bus.jsx` to TS. No existing TS synthesizer. | None |
| P3 Reuse before rewrite | Phase 4 | `bridge/client.ts [EXTEND]` correct. `bridge/schemas.ts [NEW]` flagged as porting; needs verification. | Low |
| P2 TDD non-negotiable | Phase 9 | Canvas/3D/Map panels reach 80% by testing wrappers; visual correctness no enforced gate. G-series passes without proving rendering. | High |
| P2 TDD non-negotiable | Phase 6, 12 (F2) | F2 jsdom RAF-mock test cannot fail under reasonable bug conditions; gate performative. | High |
| P4 Offline-first, no CDN | All | Migrates to `@fontsource/*` and npm correctly. MapLibre default basemap gap (open Q4); plan flags it. | None (caveat) |
| P5 StreamStore subscriptions | Phase 3, 9 | Architecture sound; `useStreamSubscription` hook firewall. R4 correct. | None |
| P1 Prototype canonical for pixels | Phase 10 | LayoutNode preset cannot reproduce heterogeneous row ratios with 2-level splits (Tension 2.3); preset diverges on first edit. | Medium |
| P1 Prototype canonical for pixels | Phase 13 | Visual regression opt-in, not gating. Pixel canonicality has no CI enforcement. | High |

**Summary:** P3 critically violated (decisive), P2/P1 violated in enforcement (high). P4/P5 honored.

---

## 5. Acceptance Criteria Coverage Check

| ID | Coverage | Issue |
|---|---|---|
| A1 | OK | Phase 12 — adequate |
| A2 | OK | Phase 8 — adequate |
| A3 | OK | Phase 12 — adequate |
| A4 | OK | Phase 12 — adequate |
| A5 | **WEAK** | Tension 2.3 — assertion fails unless tree handles heterogeneous ratios |
| A6 | OK | 13 component tests, "renders without crash" — shallow but conforming |
| A7 | OK | Phase 12 — adequate |
| A8 | OK | Phase 9 — adequate |
| A9 | OK | Phase 11 — adequate |
| A10 | OK | Phase 11 — modal scaffolded |
| A11 | OK | Phase 12 — adequate |
| A12 | OK | OfflineAssetsDialog placeholder meets "placeholder 가능" |
| B1 | OK | Phase 3 store tests |
| B2 | OK | Covered by A3+A4 |
| B3 | OK | Covered by A11 |
| C1 | OK | Phase 9 |
| C2 | OK | Covered by A4 |
| C3 | OK | Covered by A7 |
| C4 | **WEAK** | Test verifies store fan-out, not per-panel render-side cursor sync |
| D1 | OK | Phase 10 |
| D2 | OK | Covered by A6 |
| D3 | OK | Covered by A9 |
| E1 | **WEAK** | Measures React render counter only; misses RAF tick budget |
| E2 | OK | Virtualized list test against 10000-row synthetic |
| E3 | OK | Covered by A12 |
| F1 | **DUPLICATIVE** | `pcm_throughput_smoke.rs` and `datagram_throughput_smoke.rs` already exist; adapt instead of recreate |
| F2 | **VIOLATION** | jsdom RAF-mock test performative (Tension 2.6); needs Playwright + real browser |
| F3 | OK | Phase 12, assuming bridge wired |
| F4 | **DUPLICATIVE** | `pcm_decode.rs`, `pcm_sync_scan.rs`, existing `rti_core::pcm` already CRC-validate |
| G1 | OK | CI gate configured; weakened by Tension 2.1 |
| G2 | OK | Tarpaulin gate; verify CI runner OS (Windows partial support) |
| G3 | OK | Commit convention |
| G4 | OK | Per-PR coverage gate |

**Orphans:** F2 (no real gate), C4 (sync-rendering proof missing), E1 (RAF-budget proof missing).

---

## 6. Verdict

**UNSOUND** — return to Planner.

### Required revisions

1. **Re-survey existing Rust assets.** Read `project/crates/rti_core/src/lib.rs`, `project/src-tauri/src/main.rs`, 30+ Rust tests. Rewrite §1.2 driver #3, §3 file tree, phases 5/6/7. Path B remains correct; "Rust bring-up" → "Rust extension." Cargo workspace question (B1 vs B2) **moot** — keep `project/crates/rti_core/`, optionally add `[workspace]` to `project/Cargo.toml` if second crate needed.
2. **Phase 5 = extend `rti_core::pcm` with generator submodule + 10 Mbps UDP loopback bench.** Reuse existing `ingest::udp`, `ingest::managed`, `ingest::pipeline`, `pcm::create_test_frame`, `pcm::decode_bitstream`. Effort drops from ~25 new Rust files to ~3-5.
3. **Phase 7 = ensure existing `project/src-tauri/src/main.rs` commands emit `panel_stream_data` events for channel #1001 from live receiver path.** Wiring + glue, not greenfield.
4. **Make Playwright pixel-diff PR-blocking** (not opt-in). Without it, P1 has no enforcement.
5. **Add real-browser perf test for F2** (Playwright headed, `performance.now()` deltas under 10s live). jsdom test stays as unit sanity check, not F2 gate.
6. **Add `FlatGridNode` to LayoutNode union** for prototype's slice-1 frozen geometry; document migration to recursive splits in slice 2.
7. **Re-baseline effort to 6–8 person-weeks single / 4–5 weeks pair** with slice-1.5 cut line at week 5.
8. **Fix C4 test:** add per-panel render-side cursor assertion.
9. **Fix E1 test:** add RAF-budget assertion in addition to React render-count.
10. **Mark F1, F4 deliverables as "adapt existing tests in `project/crates/rti_core/tests/`"** rather than create new in non-existent paths.

---

## 7. Open Questions — Architect Recommendations

1. **Cargo workspace location:** **Neither B1 nor B2.** Use existing `project/crates/rti_core/` as-is. If separate `pcm-generator` binary needed, add as `[[bin]]` inside `rti_core` or sibling `project/crates/pcm-generator/`. Add `[workspace]` to `project/Cargo.toml` only if second crate appears.

2. **State library:** **Zustand correct** for slice 1 — small bundle, no provider boilerplate, works with non-React StreamStore consumers. Selector-misuse risk mitigated by Principle 5 (`useStreamSubscription` hook). Lock; do not revisit until slice 3.

3. **three.js vs raw WebGL:** **`three` + `@react-three/fiber`.** Bundle ~150 KB gz acceptable; raw WebGL triples panel TSX size, pushes Attitude3D/Trajectory3D to 1-2 weeks each. A6 demands all 13 in slice 1.

4. **MapLibre offline fallback:** **Ship local style.json with solid-color background layer + prototype's mock track lines as GeoJSON source.** No tiles required. Slice 3 swaps in MBTiles via Rust tile server. E3 test asserts "no network requests during MapPanel mount."

5. **c8 coverage exclusions:** Exclude `**/*.d.ts`, `**/types/*.ts`, `**/__mocks__/**`. Type files have no runtime; including tanks denominators with no signal. Document in `vitest.config.ts`.

6. **Time budget:** **6–8 person-weeks single / 4–5 weeks pair.** 3-5 weeks optimistic by ~50%. Confirm with user before proceeding.

7. **Existing 24 `*_test.js`:** **Triage now.** Files testing markdown content (runbooks, readiness bundles, operator quickstart, simdis/gstreamer/matlab setup docs, performance docs, certification soak plan, ralph completion gate) → `legacy/`, `npm run test:legacy`. Files testing bridge contracts (`bridge_schema_test.js`, `bridge_client_test.js`, `app_contract_test.js`, `pcm_decoder_test.js`, `channel_metadata_test.js`, `scaffold_contract_test.js`) → port to vitest in phase 4 — real regression coverage. Smoke tests (ollama/matlab/gstreamer/simdis/runtime_discovery/local_verifier/external_runtime_*/runtime_readiness/implementation_status/export_artifact) → `legacy/`, nightly only.

---

**For the Critic:** focus on (a) §0 finding (existing Rust crates) — verify against actual `project/crates/rti_core/` and `project/src-tauri/src/main.rs`; (b) whether LayoutNode preset can reproduce prototype's heterogeneous row ratios with recursive splits, or whether `FlatGridNode` required; (c) whether jsdom F2 is real gate or theater; (d) 6-8 vs 3-5 week effort question.

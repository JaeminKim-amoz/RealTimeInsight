# RTI Bridge-Wire Slice 1 — Consensus Final Plan

- Status: **APPROVED_WITH_CONDITIONS** by Critic v1 (3-stage: deep-interview → ralplan → autopilot, ralplan stage complete)
- Iteration: 2 of 5 (max)
- Effort: 6-8 person-weeks single / 4-5 weeks pair, slice-1.5 cut at week 5 (with week-4 tripwire per C5)
- Authority: This document is the canonical consensus output. Autopilot Phase 2+ executes against this.

## Inputs (read order for autopilot)

1. **Spec:** `.omc/specs/deep-interview-rti-bridge-wire.md` — 30 acceptance criteria (A1-A12, B1-B3, C1-C4, D1-D3, E1-E3, F1-F4, G1-G4), strict perf bar (60s @ 10Mbps, 0% loss, 60 FPS), TDD pure ≥80% coverage.
2. **Plan v2:** `.omc/plans/rti-bridge-wire-slice1-plan-v2.md` — 15 phases, file tree, RALPLAN-DR §1, ADR §6, pre-mortem §11.1, 11-layer test plan §11.2.
3. **Architect v2 review (SOUND):** `.omc/plans/rti-bridge-wire-slice1-architect-review-v2.md` — 10/10 v1 revisions PASS verification.
4. **Critic v1 review (APPROVE_WITH_CONDITIONS):** `.omc/plans/rti-bridge-wire-slice1-critic-review-v1.md` — 10 conditions C1-C10 below.

## 10 Conditions to enforce inline during autopilot Phase 2

Each is <30 min, citable, verifiable. Autopilot must surface these as explicit phase-0 items before any TDD Red-Green starts.

| # | Condition | File touched | Verification |
|---|---|---|---|
| **C1** | Phase 14 CI runner profile (self-hosted Linux pinned CPU; median-of-3 × 10s; Vite stub-harness default with `tauri:dev` nightly; auto Tier-3 rollback on median p95 >30ms × 3 PRs) | plan §8.4 | text exists |
| **C2** | `[[bin]] pcm_gen` → sibling-crate fallback trigger (>5% src-tauri build inflation OR non-no-std feature OR tarpaulin lib/bin divergence) | plan §1.3 R6 + §7 R6 | text exists |
| **C3** | WorkstationSheet placeholder lock test (`no env-conditional bypass; placeholder always renders when subscribePanelData rejects 'bridge offline'`) | plan §3 phase 10 deliverable | test name + assertion text |
| **C4** | Playwright cache key in CI (`npx playwright install chromium --with-deps` on `~/.cache/ms-playwright` keyed by Playwright version) | plan §8.5 step 1a | cache key text |
| **C5** | W1 active tripwire at end-of-week-4 (if phases 0-7 not green → immediate W1 cut, do not wait week 5) | plan §1.4 + §7 R7 | text exists |
| **C6** | Cross-stack harness Option A lock (Node spawn `pcm_gen` + headless Tauri + WebSocket bridge listener; raise Phase 7 LOC budget ≤30 → ≤50 to accommodate `--test-bridge-port` flag) | plan §9 + §3 phase 7 + §1.4 | "Locked: Option A" |
| **C7** | F1 test ownership clarification (verified `pcm_throughput_smoke.rs` is loop-internal not UDP; UDP gate = `datagram_throughput_smoke.rs` ADAPT; `pcm_throughput_smoke.rs` ADAPT covers F4 + decoder throughput, NOT UDP) | plan §5 row F1 | both files named with specific roles |
| **C8** | Phase 7 main.rs seeding citation (cite `core_subscribe_panel_data` lines 7, 250-251 the default seeds piggyback on; confirm Rust-side seed vs TS-bootstrap) | plan §3 phase 7 | line numbers cited |
| **C9** | Workspace fallback decision criterion (verify `project/Cargo.toml` exists/doesn't; document workspace creation impact on `cargo test --manifest-path` invocations + existing CI) | plan §1.3 | verification result text |
| **C10** | ADR assumption-break hedge (1 line under "Why Chosen": "If existing `rti_core::ingest::managed::ManagedReceiverRuntime` snapshot semantics do not preserve channel-#1001 ordering across drains, wiring path needs revisiting (R6 trigger).") | plan §6 | line exists |

## Open questions for autopilot to answer inline (4)

1. Tarpaulin "new files only" — verify rti_core baseline coverage; if <80% use `--include-files` filter or accept crate-wide reset.
2. Chromium pinning — pin major.minor in `playwright.config.ts`; document baseline-regen on Chromium bump.
3. `bridge/client.ts` vs `client.js` — both exist; clarify Phase 4 = "delete .js + extend .ts" vs "merge .js into .ts".
4. Phase 7 ≤30 LOC delta — sketch actual seeding code before week-4 tripwire to confirm.

## Phase 0 (consensus delta) — autopilot must do FIRST before any code

1. Apply C1-C10 to plan-v2 (these are pure-text additions; produce `.omc/plans/rti-bridge-wire-slice1-plan-v3.md` with conditions integrated).
2. Run open-question 1 verification (existing rti_core tarpaulin baseline) — output `.omc/notes/rti-baseline-coverage.md`.
3. Verify open-question 3 (`client.ts` vs `client.js` content overlap) — decision recorded in v3 plan §3 phase 4.
4. Sketch Phase 7 main.rs delta (open-question 4) — pseudocode in v3 plan §3 phase 7.

After Phase 0 (estimated 1-2 hours), autopilot enters Phase 2 (Execution) per its own protocol, working through plan v3's 15 phases with TDD pure + ≥80% coverage, leveraging:
- Vitest + c8 (TS unit/component/integration)
- cargo test + criterion (Rust unit/perf, adapting existing tests)
- Playwright (visual regression PR-blocking + e2e_60fps PR-blocking)
- 5 Zustand stores (WorkspaceStore with FlatGridNode union, SessionStore, SelectionStore, StreamStore, IntegrationStore)
- 14-panel TSX ports preserving prototype visual fidelity
- 4 sheet tabs (Workstation full live; Space/EW/GPS LOS layout-only with mock data)
- 13 modal TSX ports (with W1 cut allowing 9 of 13 to be STUB if pacing slips)
- Existing rti_core::pcm extension (~3-5 new Rust files for generator submodule + adapt 2 existing throughput tests)

## Acceptance gate (slice 1 done)

All 30 spec acceptance criteria PASS:
- A1-A12 (UI Spec §22): 12 items — Live/Replay toggle, channel search, drag-drop overlay+split, 14-panel dock, 13 panel kinds, anomaly→insight, RelationGraph, ExportModal with quality policy, MatlabModal, workspace save/restore, OfflineAssetsDialog placeholder.
- B1-B3 (Frontend §22 structural): 3 items — panel CRUD, drag-drop, restore.
- C1-C4 (Frontend §22 interaction): 4 items — Strip multi-overlay, edge-drop split, anomaly→insight update, global cursor sync (per-panel render-side proof per C4 fix).
- D1-D3 (Frontend §22 mock): 3 items — boot renders, 13 mock panels, ExportModal demo.
- E1-E3 (Frontend §22 quality): 3 items — render isolation (RAF-budget per E1 fix), 10k+ channel virtualization, offline UI.
- F1-F4 (Strict perf): 4 items — F1 cargo 60s @ 10Mbps 0% loss (UDP via datagram_throughput_smoke per C7), F2 UI 60 FPS Playwright real-browser (per F2 fix), F3 BottomConsole bitrate 9.5-10.5 Mbps, F4 CRC fail rate <0.1%.
- G1-G4 (TDD discipline): 4 items — c8 ≥80% TS new code, tarpaulin ≥80% Rust new code, Red→Green commit pattern, per-PR coverage gate.

## Hand-off

This document + plan v2 + Critic conditions C1-C10 = consensus deliverable.
Next: invoke `Skill("oh-my-claudecode:autopilot")` with this file as Phase 0+1 output. Autopilot skips Expansion + Planning, starts at Phase 2 (Execution).

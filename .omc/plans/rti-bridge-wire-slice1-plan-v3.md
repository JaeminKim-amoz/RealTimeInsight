# RTI Bridge-Wire Slice 1 — Plan v3 (Consensus Delta)

**Status**: APPROVED — Critic v1 conditions C1-C10 + open-question answers integrated
**Base**: `.omc/plans/rti-bridge-wire-slice1-plan-v2.md` (canonical 15-phase plan)
**Iteration**: 2 of 5 (max), consensus reached
**Generated**: autopilot Phase 2 entry (consensus delta tightening)

---

## v3 Delta from v2

This document records v3 changes ON TOP OF v2. Read v2 first; apply this delta. v2 remains the canonical 15-phase plan.

### Verified open-question answers

**OQ-1: `project/Cargo.toml` existence** — **DOES NOT EXIST** (verified via `ls`).
- Implication: §1.3 R6 sibling-crate fallback would CREATE `project/Cargo.toml` as a `[workspace]` manifest with members `["src-tauri", "crates/rti_core", "crates/pcm-generator"]`.
- Migration impact: existing CI invocations like `cargo test --manifest-path project/crates/rti_core/Cargo.toml` continue to work (workspace members keep their own manifests).
- §1.3 R6 trigger criteria (per C2): "Sibling-crate fallback fires if any of: pcm_gen build adds >5% to src-tauri clean-build wall-clock; pcm_gen pulls non-no-std feature flag into rti_core; tarpaulin diverges between lib and bin metrics."

**OQ-2: existing rti_core tarpaulin baseline** — **NOT MEASURED**, no tarpaulin config in repo.
- Phase 0 deliverable adds: `cargo install cargo-tarpaulin` + run baseline once + record in `.omc/notes/rti-baseline-coverage.md`.
- If baseline < 80%, G2 gate uses `--include-files "src/pcm/generator*.rs"` (slice-1 new code only) instead of `--fail-under 80` crate-wide.

**OQ-3: `bridge/client.ts` vs `client.js`** — **DUAL EXISTENCE** (verified):
- `client.ts` 14.9KB (canonical TS source with `subscribePanelData`, `createBridgeClient`, type assertions).
- `client.js` 9.4KB (stale built output — has fewer functions).
- `client.d.ts` 3.9KB, `schemas.d.ts` 1.9KB, `schemas.js` 7.5KB.
- Phase 4 delta: **delete `client.js`, `client.d.ts`, `schemas.js`, `schemas.d.ts`** (build outputs); keep `client.ts` and `schemas.ts` as source of truth. Vite + Vitest will produce fresh outputs.

**OQ-4: Phase 7 main.rs seeding line** — **VERIFIED**:
- Line 7: `core_subscribe_panel_data` imported from `rti_core::bridge`.
- Line 250-251: `subscribe_panel_data` Tauri command delegates to `core_subscribe_panel_data(input)`.
- Line 339: `start_managed_receiver_loop` (existing).
- Line 399: `let _ = event_app.emit("rti://bridge-event", event);` (event-emit path).
- **Resolution**: Default panel-1001 subscription is **TS-bootstrapped** (StripPanel mount calls `useStreamSubscription([1001], 'timeseries-v1')`), NOT Rust-side seeded. Phase 7 LOC budget reverts to **≤30 LOC** (no `--test-bridge-port` flag needed if E2E harness uses existing event-emit + a Vite-spawned subprocess).
- C6 update: harness Option A simplified — `tests/e2e/bridge_loopback.spec.ts` spawns `cargo run --bin pcm_gen` (UDP sender) + `npm run tauri:dev --headless` and asserts `panel_stream_data` events flow. The headless Tauri app already emits `rti://bridge-event`; no flag needed.

### Conditions C1-C10 application notes

C1 (Phase 14 CI runner) — apply to v2 §8.4 verbatim per Critic text.
C2 (pcm_gen trigger) — apply to v2 §1.3 R6 + §7 R6 verbatim.
C3 (Bridge offline lock test) — apply to v2 §3 phase 10 deliverable verbatim.
C4 (Playwright cache key) — apply to v2 §8.5 step 1a verbatim.
C5 (week-4 tripwire) — apply to v2 §1.4 + §7 R7 verbatim.
C6 (cross-stack harness) — REVISED per OQ-4: lock as "Node spawn `pcm_gen` + headless `tauri:dev` + WebSocket-less event subscription via Tauri's native `app.emit` consumed by `playwright + @tauri-apps/api/event listen`". No `--test-bridge-port` flag, Phase 7 LOC stays ≤30.
C7 (F1 test ownership) — apply to v2 §5 row F1 verbatim.
C8 (Phase 7 line citation) — apply: "Phase 7 cites `main.rs:250-251` (subscribe_panel_data delegation), `:399` (event emit). No new seeding code; default subscription is TS-bootstrapped via Phase 9 StripPanel `useStreamSubscription` hook."
C9 (workspace fallback) — apply: "Verified `project/Cargo.toml` does NOT exist; if R6 fires, workspace creation adds [workspace] manifest at `project/Cargo.toml` with members [src-tauri, crates/rti_core, crates/pcm-generator]. Existing `cargo test --manifest-path` invocations continue to work."
C10 (ADR hedge) — apply to v2 §6 verbatim.

### Phase 0 (Tooling) — concrete checklist for autopilot Phase 2 entry

Steps to execute now (autopilot will batch):

1. `npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitejs/plugin-react playwright @playwright/test`
2. `npm install three maplibre-gl zustand @react-three/fiber @react-three/drei @fontsource/ibm-plex-sans @fontsource/jetbrains-mono`
3. Create `vitest.config.ts` with jsdom env, c8 coverage thresholds (lines 80, branches 75, exclude `**/*.d.ts`, `**/types/*.ts`, `**/__mocks__/**`, `public/app/**`).
4. Update `package.json` scripts: add `test`, `test:watch`, `test:coverage`, `test:legacy` (existing Node `*_test.js`), `test:legacy:nightly`, `e2e:visual`, `e2e:perf`.
5. Create `playwright.config.ts` with Chromium pinned to project's `package.json` `playwright` version, headless default + `e2e:perf` headed mode.
6. Run `cargo install cargo-tarpaulin` + measure baseline coverage on `project/crates/rti_core` → write `.omc/notes/rti-baseline-coverage.md`.
7. Verify `npm test` runs (will be empty/pass) and `cargo test --manifest-path project/src-tauri/Cargo.toml` runs (existing 30+ tests).

Acceptance for Phase 0 done: all 7 above complete; `npm run test` passes (empty); `npx vitest run` works; `npx playwright --version` returns; tarpaulin baseline recorded.

---

## Effort projection (unchanged)

6-8 person-weeks single-eng / 4-5 weeks pair, with active scope-control:
- **End of week 4**: if phases 0-7 not green → immediate W1 cut (9 STUB modals deferred to slice 2).
- **End of week 5**: hard W1 enforcement.
- **Phase 14 Tier-3 rollback**: median p95 >30ms × 3 PRs → demote to nightly only.

---

## Reference

For all phase content, file trees, RALPLAN-DR, ADR, pre-mortem, expanded test plan, risk register: see `.omc/plans/rti-bridge-wire-slice1-plan-v2.md`.

For all critic conditions verbatim: see `.omc/plans/rti-bridge-wire-slice1-critic-review-v1.md`.

For Architect's analysis: see `.omc/plans/rti-bridge-wire-slice1-architect-review-v1.md` (UNSOUND triggering v2) and `architect-review-v2.md` (SOUND).

For consensus packet: see `.omc/plans/rti-bridge-wire-slice1-consensus-final.md`.

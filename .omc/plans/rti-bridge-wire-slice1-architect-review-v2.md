# RealTimeInsight Bridge-Wire Slice 1 — Architect Review v2

- Plan reviewed: `.omc/plans/rti-bridge-wire-slice1-plan-v2.md`
- v1 review: `.omc/plans/rti-bridge-wire-slice1-architect-review-v1.md`
- Spec: `.omc/specs/deep-interview-rti-bridge-wire.md`
- Stage: 2 of 3 (Architect, READ-ONLY), iteration 2
- Verdict: **SOUND** — proceed to Critic

---

## 0. Verification of v1 Required Revisions

| # | v1 revision | v2 status | Citation |
|---|---|---|---|
| 1 | Re-survey existing Rust; file tree §3 uses `[EXTEND]` not `[NEW]` | **PASS** | v2 §0 (lines 13–22) enumerates existing `project/crates/rti_core/` modules + 31 test files; §3 uses `[EXTEND]`/`[ADAPT]`. Verified: `project/crates/rti_core/src/pcm/mod.rs` exposes `create_test_frame`, `frame_to_bits`, `bits_to_bytes`, `decode_bitstream`, `crc16_ccitt`. |
| 2 | Phase 5 = extend `rti_core::pcm` with generator, ~3-5 new files | **PASS** | v2 phase 5 (line 369): "Add `rti_core::pcm::generator` submodule (≤200 LOC) … No new crate, no new workspace." §10 line 579 confirms 3–5 new Rust files. |
| 3 | Phase 7 = wiring/glue on existing `main.rs` | **PASS** | v2 phase 7 (line 371): "Surgical changes … defaults `channel_ids` to include `1001`; PanelSubscription wiring; confirm `app.emit("rti://bridge-event", &event)` … ≤30 LOC delta." Verified: `main.rs` already has 36 `#[tauri::command]` and emits `rti://bridge-event`. |
| 4 | Playwright pixel-diff is PR-blocking CI gate | **PASS** | v2 phase 13 (line 377): "PR-BLOCKING (architect revision 4)"; §8.3 (line 532); §8.5 step 8 PR-blocking. Tolerance 5/2/10 px. |
| 5 | Real-browser perf test for F2 | **PASS** | v2 phase 14 (line 378): NEW phase, `tests/e2e/e2e_60fps.spec.ts`, Playwright headed Chromium, gate `mean_frame_ms ≤ 16.7 && p95_frame_ms ≤ 25`. PR-blocking. jsdom test demoted to RAF-coalescer sanity. |
| 6 | `FlatGridNode` added to LayoutNode union | **PASS** | v2 §1.1 P1, §2 architecture diagram, phase 2 types/domain.ts: `LayoutNode = SplitNode \| TabNode \| PanelNode \| FlatGridNode`. Phase 3 includes FlatGridNode → SplitNode conversion test. ADR §6 line 451. |
| 7 | Effort 6-8 / 4-5 weeks with slice-1.5 cut at W5 | **PASS** | v2 §10 (line 580): "6–8 person-weeks single / 4–5 weeks pair"; §1.4 W1 cut line at week 5; ADR Consequences (line 473); R7 (line 506). |
| 8 | C4 fix: per-panel render-side cursor assertion | **PASS** | v2 §5 row C4 (line 408): asserts Strip cursor line moves, Map2D track marker moves, Video frame jumps, EventLog highlight, RelationGraph node highlight. |
| 9 | E1 fix: RAF-budget assertion | **PASS** | v2 §5 row E1 (line 412): memoization render-counter test PLUS RAF-budget wall-clock <16.7ms avg under 200 Hz synthetic. |
| 10 | F1, F4 marked as adapt existing | **PASS** | v2 §5 row F1: `pcm_throughput_smoke.rs` + `datagram_throughput_smoke.rs` ADAPT. Row F4: `pcm_decode.rs` + `pcm_sync_scan.rs` reuse. |

**Score: 10/10 PASS.**

---

## A. Steelman Antithesis (fresh angle)

**"Phase 14 Playwright headed Chromium perf test in CI is fragile and slow — kills CI cycle time and produces flaky F2 verdicts."**

Argument:

1. Playwright headed Chromium under Tauri devserver is the slowest, most fragile test we can write. Requires Linux CI Docker, Xvfb, GPU stub. Tauri 2 dev launcher boots a native shell, not a browser; pointing Playwright requires either stub harness (maintenance fork) or alpha Tauri WebDriver shim.
2. `mean ≤ 16.7 && p95 ≤ 25` noisy in CI. GitHub-hosted runners share noisy host; SwiftShader fallback adds 3-8ms; GC pauses dominate p95. Intermittent gate = developers reflexively re-run, gate silently ignored.
3. CI cycle time +30-90s per PR on top of cargo perf +60s and visual-diff +30s. 2-3 minutes new CI. Over 200-300 PRs = significant overhead.
4. Unit-level streamstore RAF + per-panel E1 RAF-budget already prove the integral is bounded.

**Why it still loses:**

1. v1 antithesis-author (me) made this exact recommendation; reversing reasserts the v1 Tension 2.6 "gate that doesn't gate" failure mode. Compositional failure (Chromium layout invalidation, GC correlated with RAF) is exactly what real-browser testing catches; unit tests prove isolation, not composition.
2. CI flakiness is a tooling problem. Median-of-3 + 25ms p95 (50% headroom) absorbs runner noise. v2 should make this explicit (B1) but directional correctness stands.
3. Slice-1 differentiator IS the data plane. Cutting phase 14 ships slice 1 with no integration-time proof of 60 FPS end-to-end. F2 was upgraded to "Strict" in deep-interview Round 11.
4. v2 §11.3 Tier 3 rollback already addresses catastrophic flake — revert phase 14 to nightly with user sign-off. Right escape hatch.

Antithesis loses, exposes B1 below.

---

## B. New Tradeoff Tensions

### B1 — Phase 14 Playwright flake risk (medium-high)

v2 doesn't specify CI runner class, median-of-N strategy, stub-harness option, or tolerance band review. **Mitigation in-plan:** §8.4 add ≤200 words specifying self-hosted Linux pinned CPU, median of 3 × 10s, stub-harness via Vite + mock bridge proxy, tolerance review trigger if median p95 >30ms in 3 consecutive PRs → Tier 3 rollback.

### B2 — `[[bin]] pcm_gen` inside `rti_core` couples binary to lib (low-medium)

Pro: simplest diff. Con: `rti_core` becomes lib+bin hybrid; `src-tauri/Cargo.toml` consumers compile bin transitively. Cargo handles via `default-run` + `bin = false` flags but subtle. **Mitigation:** v2 §1.3 R6 fallback (sibling crate) already documented; add deliberate trigger: "If pcm_gen deps inflate src-tauri build by >5% or pull non-no-std features, escalate to sibling crate fallback."

### B3 — "Bridge offline" placeholder for #1001 in browser dev — UX paper cut (low)

7-week porting team will see placeholder thousands of times; risk: hack a "dev override" that mocks #1001 in browser dev too, overrides accidentally ship. **Mitigation:** Phase 10 WorkstationSheet test asserts "no env-conditional bypass of placeholder exists" OR accept dev-only synthesizer for #1001 with visible "MOCK FEED" banner. v2 should pick one and lock.

### B4 — Playwright CI ~30-60s setup overhead (low-medium)

`npx playwright install chromium` cached but 200MB; Xvfb headed; Vite/Tauri server startup. CI minutes +3-5 per PR. **Mitigation:** GitHub Actions cache `~/.cache/ms-playwright` with explicit cache key in §8.5 step 1.

---

## C. Synthesis

All four B-tensions in-plan mitigatable, none requiring v3 round.

Tightening additions for Critic to require:
1. (B1) §8.4 ≤200 words on CI runner / median strategy / stub-harness / tolerance review.
2. (B2) §1.3 R6 deliberate trigger condition.
3. (B3) Phase 10 WorkstationSheet placeholder lock test.
4. (B4) §8.5 step 1 Playwright cache key.

These are tightening, not redirecting.

---

## D. Verdict

**SOUND** — proceed to Critic.

Justification: 10/10 v1 revisions applied with file-and-section attribution; cross-referenced existing assets (verified 31 Rust tests, 17 prototype JSX files, named pcm functions, 36 commands). New B-tensions minor, in-plan mitigatable, bounded by Tier 1/2/3 rollback. SOUND_WITH_REVISIONS would punt B1-B4 to v3 round, costing iteration; Critic can require them as approval conditions. Iteration economy favors SOUND.

---

## E. Acceptance Criteria Coverage Delta

| ID | v1 status | v2 status | Evidence |
|---|---|---|---|
| A5 | WEAK | **OK** | FlatGridNode reproduces literal cells; phase 10 test asserts 14-cell heterogeneous grid mechanically. |
| C4 | WEAK | **OK** | Phase 12 asserts Strip cursor line, Map2D marker, Video frame, EventLog highlight, RelationGraph node — per-panel render-side. |
| E1 | WEAK | **OK** | Phase 9 panel tests include memoization + RAF-budget wall-clock <16.7ms avg under 200 Hz synthetic. |
| F1 | DUPLICATIVE | **OK** | `pcm_throughput_smoke.rs` + `datagram_throughput_smoke.rs` adapted, not duplicated. |
| F2 | VIOLATION | **OK** | Phase 14 NEW Playwright headed real-browser gate, PR-blocking. |
| F4 | DUPLICATIVE | **OK** | `pcm_decode.rs` + `pcm_sync_scan.rs` reused; F1 perf gate adds CRC fail rate <0.1%. |

**6/6 prior weaknesses resolved.** Other 24 criteria already OK in v1 still OK in v2.

---

## F. Open Questions

### Q1: Is W1 STUB-modal cut acceptable to user?
**Recommendation: ACCEPT W1 with active tripwire.** Tripwire: "End of week 4: if phases 0–7 not green, immediately invoke W1 cut for 9 STUB modals; do not wait until week 5." Converts W1 from passive cut to active scope-control. User sign-off needed once before slice 1 starts; not a blocker for plan consensus.

### Q2: Cross-stack E2E harness — Node spawn vs Tauri test runner
**Recommendation: Option A — Node spawn `pcm_gen` + headless Tauri app + WebSocket bridge listener.** Phase 7 surgical change adds `--test-bridge-port` flag (raises ≤30 LOC to ≤50 LOC). Option B (Node UDP only, no Tauri) loses IPC-boundary coverage — Scenario B says IPC is the failure mode.

---

## Summary

v2 substantively addressed all 10 v1 required revisions with file-and-section citations matching repo state. Plan correctly identifies existing Rust, switches "bring-up" → "extension," adds PR-blocking visual + perf gates, fixes C4/E1 test designs, re-baselines effort with slice-1.5 cut. Four new minor tensions in-plan mitigatable.

**Verdict: SOUND.** Proceed to Critic. Critic should require B1-B4 tightening as conditions on plan approval; none require returning to Planner for v3.

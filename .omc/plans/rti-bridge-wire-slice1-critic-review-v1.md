# Critic Review v1 — RTI Bridge-Wire Slice 1

- Plan reviewed: `.omc/plans/rti-bridge-wire-slice1-plan-v2.md` (630 lines, 15 phases)
- Architect v2 review: `.omc/plans/rti-bridge-wire-slice1-architect-review-v2.md` (SOUND)
- Spec: `.omc/specs/deep-interview-rti-bridge-wire.md`
- Stage: 3 of 3 (Critic), iteration 2
- Verdict: **APPROVE_WITH_CONDITIONS** (10 conditions, all <30 min by executor)

---

## Section 1: Verdict

**APPROVE_WITH_CONDITIONS**

The v2 plan is substantively complete and addresses all 10 v1 required revisions with file-and-section attribution verified against the repo. Architecture is sound: extending existing `rti_core::pcm` rather than greenfield rewriting, surgical edits to `project/src-tauri/src/main.rs`, FlatGridNode for slice-1 frozen geometry, PR-blocking visual + perf gates. Architect v2 left 4 tightening items (B1–B4) and 2 open-question recommendations (Q1, Q2); v2 plan acknowledges them but does not fully encode. These are the conditions below.

### 10 Conditions (each <30 min by executor; concrete; verifiable)

**C1. Pin Phase 14 CI runner profile (Architect B1).** Add ≤200 words to §8.4: (a) self-hosted Linux CI runner with pinned CPU class (no GitHub-hosted shared); (b) median-of-3 across three independent 10s runs; (c) stub-harness via Vite + mock bridge proxy as default Phase-14 target with `tauri:dev` reserved as nightly; (d) tolerance escape hatch: median p95 >30ms in 3 consecutive PRs auto-triggers Tier 3 rollback. Verifiable: text in §8.4.

**C2. `[[bin]] pcm_gen` deliberate trigger (Architect B2).** Add to §1.3 R6 + §7 R6: "Trigger sibling-crate move if any of: pcm_gen build adds >5% to src-tauri clean-build wall-clock; pcm_gen pulls a non-no-std feature flag into rti_core; tarpaulin diverges between lib and bin metrics."

**C3. Lock Bridge offline placeholder (Architect B3).** Add to §3 phase 10 deliverable: `WorkstationSheet.test.tsx : "no env-conditional bypass exists; placeholder always renders when bridge.subscribePanelData rejects with 'bridge offline'"`. Prevents accidental dev-mock #1001 leakage to production.

**C4. Cache Playwright browsers (Architect B4).** §8.5 step 1a: `npx playwright install chromium --with-deps` cached on `~/.cache/ms-playwright` with explicit cache key including Playwright version. Saves 3-5 min CI/PR.

**C5. Q1 active tripwire (Architect §F.Q1).** §1.4 W1 + §7 R7: "End of week 4: if phases 0–7 not green, immediately invoke W1 cut for 9 STUB modals; do not wait until week 5." Active scope-control, not passive cut.

**C6. Q2 cross-stack harness lock (Architect §F.Q2).** §9 / §3 phase 7 / §1.4 lock Option A (Node spawn `pcm_gen` + headless Tauri app + WebSocket bridge listener). Raise Phase 7 LOC budget from ≤30 to ≤50 to accommodate `--test-bridge-port` flag. Prevents executor re-debate.

**C7. Phase 6 perf gate UDP loopback clarification (verified gap).** I verified `pcm_throughput_smoke.rs` is loop-internal (creates frames in-process, calls `decode_bitstream` directly) — does NOT use UDP. UDP loopback path is `datagram_throughput_smoke.rs` and `multi_rate_soak_smoke.rs`. Tighten §5 F1: F1 (UDP, 60s, 0% loss, 9.5–10.5 Mbps) is enforced primarily by `datagram_throughput_smoke.rs` ADAPT; `pcm_throughput_smoke.rs` ADAPT covers F4 (CRC fail rate) + decoder throughput component, NOT the UDP gate.

**C8. Phase 7 main.rs seeding line citation.** Plan's "≤30 LOC delta" assumes default panel-1001 subscription seeded inside `start_managed_receiver_loop`. Verified `main.rs:339` `start_managed_receiver_loop` and `:399` `app.emit("rti://bridge-event", ...)`. Cite exact `core_subscribe_panel_data` line (lines 7, 250–251) the new default seeds will piggyback on. Confirm whether seeding is Rust-side or needs TS-bootstrap call.

**C9. Cargo workspace fallback decision criterion (R6).** §1.3 + R6 say "if pcm_gen needs sibling crate, add `[workspace]` to project/Cargo.toml" — but `project/Cargo.toml` may not exist. Confirm in §1.3: "verified project/Cargo.toml does/does not exist; workspace creation impact = X" (e.g., does it change `cargo test --manifest-path project/crates/rti_core/Cargo.toml` invocation?). Document migration if needed.

**C10. ADR §6 assumption-break hedge.** Plan §6 "Why Chosen" ranks 4 reasons; missing explicit "what we'd revisit if X breaks" hedge. Add 1 line: "If existing `rti_core::ingest::managed::ManagedReceiverRuntime` snapshot semantics do not preserve channel-#1001 ordering across drains, the wiring path needs revisiting (R6 trigger)."

---

## Section 2: Score per criterion (1-9)

| # | Criterion | Score | Finding |
|---|---|---|---|
| 1 | Principle-option consistency | **8/10** | P1-P5 traced through 15 phases; FlatGridNode principled (P1+P3); P3 reuse honored. Phase 10 placeholder at P5 boundary (acceptable, lock test required — C3). |
| 2 | Fair alternatives | **9/10** | §1.4 + ADR §6 invalidate 12 options; spot-checks W3 (cut Rust) + B3 (3-Cargo-projects) honest steelmen. |
| 3 | Risk mitigation clarity | **7/10** | R1, R3, R4, R7 clear. R2 demoted with evidence. R5 missing rollback for canvas coverage gap. R6 trigger vague (C9). |
| 4 | Testable acceptance criteria | **8/10** | 30/30 mapped. F1 has UDP-vs-decoder gap (C7). F2 has right gate. C4/E1 fixes good. |
| 5 | Concrete verification steps | **8/10** | §8.5 9-10 numbered steps, real commands. Missing explicit "all 9 green AND acceptance report reviewed → slice 1 done" rubric. |
| 6 | Pre-mortem (deliberate) | **9/10** | All 3 scenarios plausible, mitigations specific + would catch failure. |
| 7 | Expanded test plan layers (deliberate) | **9/10** | §11.2 covers 11 layers (>min 8); each names concrete tool + file. |
| 8 | Architect B1-B4 | **6/10** | Plan acknowledges implicitly but does not encode B1 CI/median, B2 trigger, B3 lock test, B4 cache key. C1-C4 close. |
| 9 | Architect open Q1/Q2 | **7/10** | Q1 W1 cut only at week 5 (no week-4 tripwire). Q2 left to executor. C5/C6 close. |

**Average: 7.9/10. Substantively sound; conditions sharpen edges.**

---

## Section 3: Risk register critique

| # | Trigger | Mitigation | Owner | Rollback | Improvements |
|---|---|---|---|---|---|
| R1 Babel→npm visual drift | Implicit | Specific (PR-blocking pixel-diff, named tolerance) | Phase 13 | Tier-3 | OK |
| R2 Rust UDP loss | DEMOTED | Existing tests | Phase 6 ADAPT | Tier-2 | OK |
| R3 FlatGridNode mismatch | Phase 10 unit fail | Specific (literal cells + Phase 13 pixel-diff) | Phase 10+13 | Tier-3 | OK |
| R4 60 FPS degradation | Phase 9 E1 fail | Specific (RAF coalescer + memo + extracted fns + Phase 14 e2e) | Phase 3, 9, 14 | Tier-3 | OK |
| R5 80% canvas coverage | CI tarpaulin/c8 fail | Extracted pure fns + Playwright | Phase 9, 13 | **Missing** | **Add: if c8 ≥80% unreachable on a panel after extraction, document `c8 ignore next` with justification + Playwright pixel coverage match.** |
| R6 rti_core API drift | Phase 7 ≤30 LOC uncovers mismatch | Vague (Phase 12 canary + sibling-crate fallback) | Phase 7+12 | Sibling crate | **C9: trigger criteria not concrete.** |
| R7 Effort overrun | Week 5 (W1) | Specific (defer 9 STUB modals) | All phases | Tier-2/3 | **C5: add week-4 tripwire.** |

**Summary:** R5 missing rollback; R6 trigger vague; R7 missing earlier tripwire. C5+C9+R5 tightening close. **7/10.**

---

## Section 4: Acceptance spot check (5 random)

**A1 (Live/Replay):** Mapped to `live_to_replay_toggle.test.ts` Phase 12. Two-step path testable in vitest jsdom + mock bridge. **PASS**.

**A5 (14-panel preset):** Mapped to `presets/workstationDefault.test.ts` + `WorkstationSheet.test.tsx` Phase 10. Verified `public/app/app.jsx` has 14 entries (incl p8b). FlatGridNode preset test mechanical, catches v1 weakness. **PASS**.

**C4 FIX (cursor sync):** Per-panel render-side assertions: Strip cursor line, Map2D marker, Video frame, EventLog highlight, RelationGraph node. Right level (integration). **PASS**.

**F1 FIX (60s 10Mbps):** Mapped to `pcm_throughput_smoke.rs` + `datagram_throughput_smoke.rs` ADAPT, `--ignored`, gate via `scripts/check-perf.mjs`. **Verified gap (C7):** `pcm_throughput_smoke.rs` does NOT use UDP. UDP gate = `datagram_throughput_smoke.rs`. Plan should clarify which test owns which gate. **PASS-WITH-CAVEAT**.

**G2 (Rust tarpaulin ≥80%):** Mapped to `cargo tarpaulin --fail-under 80` on new files. Concrete + runnable. **Caveat:** tarpaulin doesn't natively support "new files only" — measures crate-wide. If existing rti_core baseline <80%, gate blocks. **Open Question** (not condition): verify baseline before slice-1 starts; if <80% use `--include-files` filter or accept crate-wide reset. **PASS-WITH-CAVEAT**.

---

## Section 5: Pre-mortem critique (deliberate mode)

| Scenario | Plausible | Mitigation specific | Catches failure |
|---|---|---|---|
| **A** Demo at 35 FPS (per-panel `useSyncExternalStore`) | Y | Y (3 layered gates: Phase 3 unit ≤1 notification/RAF + Phase 9 E1 + Phase 14 e2e) | Y |
| **B** Cargo bench green but tauri:dev drops every 10th frame | Y | Y (Phase 12 30s drain + Phase 14 under tauri:dev) | Y, **but only if Q2 = Option A (C6)** |
| **C** Phase 13 visual regression on font drift | Y | Y (CI-generated baseline cached, 5/2/10 px tolerance) | Y, **with caveat:** Chromium minor bump → stale baseline silently. Tightening: pin Chromium major.minor in `playwright.config.ts`. |

**3/3 plausible + specific + catch the failure.** Minor C-tightening: pin Chromium + document baseline-regen.

---

## Section 6: B1-B4 enforcement

| # | Architect Tightening | Decision |
|---|---|---|
| B1 Phase 14 flake risk | **REQUIRE as C1** — F2 gate fragile without it |
| B2 [[bin]] coupling | **REQUIRE as C2** — 1 paragraph, prevents subtle build-time surprise |
| B3 Bridge offline lock | **REQUIRE as C3** — risk: developer adds dev-mock #1001 that ships |
| B4 Playwright CI cache | **REQUIRE as C4** — 5min/PR over 200+ PRs is real |

All four <30 min total by executor before slice-1 begins.

---

## Section 7: Open questions enforcement

| # | Architect Recommendation | Plan Status | Decision |
|---|---|---|---|
| Q1 W1 cut + week-4 tripwire | Plan §1.4 has W1 with week-5 only | **REQUIRE as C5** |
| Q2 Option A harness lock + LOC raise | Plan §9 leaves to executor | **REQUIRE as C6** |

---

## Section 8: ADR completeness

Spec §6 demands: Decision | Drivers | Alternatives | Why chosen | Consequences | Follow-ups.

Plan §6: All 6 present. **PASS**. Minor: "Why Chosen" missing assumption-break hedge → C10 (1 line).

---

## Section 9: Recommendation to user

v2 plan approved with 10 conditions C1-C10. All addressable in <30 min total by executor before slice-1. Conditions sharpen Phase 14 CI strategy (B1), lock pcm_gen fallback trigger (B2), enforce Bridge offline placeholder (B3), cache Playwright (B4), add week-4 tripwire (Q1), lock Option A harness (Q2), clarify F1 UDP-vs-decoder owner, confirm Phase 7 seeding line, document workspace impact, add ADR hedge. Once encoded, plan is autopilot-ready. Effort: 6-8 weeks single / 4-5 weeks pair.

---

### Open Questions (unscored, for autopilot)

1. **Tarpaulin "new files only" scoping.** Verify existing rti_core baseline; if <80% use `--include-files` filter or accept crate-wide reset.
2. **Chromium pinning for visual baseline.** Pin major.minor in `playwright.config.ts`; document baseline-regen on bump.
3. **TS bridge/client.ts vs client.js.** Both files exist in `project/src/bridge/`; .ts already has `subscribePanelData`. Phase 4 should clarify "delete .js + extend .ts" vs "merge .js into .ts".
4. **5 spec-named bridge commands.** All 5 verified in main.rs. Phase 7 ≤30 LOC delta plausible but unverified until actual seeding code sketched.

---

**Verdict Justification:** APPROVE_WITH_CONDITIONS. Plan substantively complete (architecture sound, alternatives fairly invalidated, 30/30 acceptance items mapped, pre-mortem credible, expanded test plan 11 layers). C1-C10 are tightening, not redirecting. Iteration economy strongly favors approval — pushing v3 burns iteration cycle for tightening that autopilot enforces inline.

**Ralplan summary:**
- Principle/Option Consistency: PASS — P1-P5 traced; FlatGridNode principled.
- Alternatives Depth: PASS — 12 invalidated; honest steelmen.
- Risk/Verification Rigor: PASS-WITH-CONDITIONS — R5/R6 closed by C9 + R5 tightening.
- Deliberate Additions: PASS — pre-mortem 3/3; 11-layer test plan.

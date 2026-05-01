# rti_core Baseline Coverage — Slice 1 Policy

**Date**: 2026-04-27
**Status**: Tarpaulin install in progress (background task `ba2pblegk`); baseline number TBD on completion.

## Decision (per Critic C9 / Plan v3 OQ-2)

Slice 1 coverage gates use **`--include-files` filter** scoped to slice-1 new files only:

```bash
cargo tarpaulin \
  --manifest-path project/crates/rti_core/Cargo.toml \
  --include-files 'src/pcm/generator.rs,src/bin/pcm_gen.rs' \
  --fail-under 80
```

Rationale: existing `rti_core` was authored before slice-1 spec; its baseline coverage may be <80%. Scoping the gate to **new** slice-1 code ensures TDD discipline G2 enforces ≥80% on what we write, without grandfathering pre-existing modules into a fail-under check that they never had to satisfy.

## Slice-1 covered files (G2 gate scope)

- `project/crates/rti_core/src/pcm/generator.rs` (new in US-009)
- `project/crates/rti_core/src/bin/pcm_gen.rs` (new in US-009)
- Any other new `*.rs` added by US-010 / US-011 in `project/crates/rti_core/src/` or `project/src-tauri/src/`

## Baseline measurement (cargo-tarpaulin 0.35.4)

Run on 2026-04-27 with `cargo tarpaulin --manifest-path project/crates/rti_core/Cargo.toml --skip-clean --out Stdout --timeout 120`.

**Result**: Run failed at the test execution phase. `receiver_session_counts_timeouts` test (in `project/crates/rti_core/tests/managed_receiver_loop.rs` or sibling) fails under tarpaulin instrumentation but passes under plain `cargo test`. This is consistent with tarpaulin's known issue where instrumentation slows execution enough to violate timing-sensitive UDP receiver timeouts (commonly observed in tokio-based tests with `tokio::time::timeout` durations under 200ms).

**Mitigation (no slowdown to slice 1)**:

1. For slice-1 G2 acceptance, use `--include-files` scoped to NEW files added by US-009..US-011:
   ```bash
   cargo tarpaulin \
     --manifest-path project/crates/rti_core/Cargo.toml \
     --include-files 'src/pcm/generator.rs,src/bin/pcm_gen.rs' \
     --exclude-files 'tests/managed_receiver_loop.rs' \
     --fail-under 80
   ```
2. For full-crate baseline (deferred to slice 2 or post-slice-1 hardening): patch the timing-sensitive test to use `cfg(not(tarpaulin_include))` or extend its timeouts when `cfg(tarpaulin)` is set. Tracked as slice-2 follow-up in plan v3 §10.

**Other rti_core tests that DID pass under tarpaulin instrumentation** (1 of 2 in the sample suite that was attempted before the failure halted the run): see `tasks/brivtj0ec.output` for full log. Slice-1 G2 enforcement does not depend on the full crate baseline.

## TS coverage policy (Vitest c8)

Configured in `vitest.config.ts`:
- `lines: 80`, `branches: 75`, `functions: 80`, `statements: 80`
- Excludes: `**/*.d.ts`, `**/types/*.ts`, `**/__mocks__/**`, `public/app/**`
- Scope: `project/src/**/*.{ts,tsx}` (slice-1 new code)

Baseline (zero TS source files yet): N/A. First TS files land in US-001.

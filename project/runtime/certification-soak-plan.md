# Certification Soak Plan

Date: 2026-04-22

This plan is for long-duration validation after the developer smoke tests pass.
It is intentionally separate from `performance-smoke.md`: developer smokes catch
obvious regressions, while this plan collects release evidence.

## Preconditions

- Runtime readiness report has no unexpected blockers:

```bash
node project/runtime/runtime-readiness-report.js --strict
```

- Operator stream profiles are configured for 10, 20, and 30 Mbps UDP PCM.
- The app is launched in the target OS profile: Linux workstation and Windows
  workstation are both required for final acceptance.
- Logs are written under `project/runtime/reports/soak/<run-id>/`.

## Soak Matrix

| Profile | Duration | Input | Required Evidence |
| --- | ---: | --- | --- |
| 10 Mbps live ingest | 2 h | UDP PCM | packet/frame counters, CRC rate, sync loss, UI status |
| 20 Mbps live ingest | 2 h | UDP PCM | packet/frame counters, CRC rate, sync loss, UI status |
| 30 Mbps live ingest | 2 h | UDP PCM | packet/frame counters, CRC rate, sync loss, UI status |
| Replay parity | 30 min/run | recorded run | live/replay sample parity, quality flags preserved |
| Export stress | 1M samples | decoded store | CSV manifest, row count, quality policy, elapsed time |
| Evidence graph | 10k queries | fixture graph | p95 query latency, deterministic ranking |
| External runtime | 30 min | MATLAB/GStreamer/SimDIS/Ollama | health, errors, tool traces, operator actions |

## Acceptance Thresholds

- App-induced packet loss: `0` in controlled synthetic/local tests.
- Sync loss: explained by source fixture or `0`.
- Bad CRC samples are retained in diagnostics but excluded from display samples.
- 30 Mbps ingest queue depth remains bounded for the full run.
- UI remains responsive; chart/cursor update p95 under `50 ms` on the target
  workstation profile.
- Export 1M samples completes under `10 s`.
- Root-cause query p95 under `300 ms` for the default graph.
- Every LLM answer accepted into the report includes cited evidence IDs.
- Any operator-approved Mission Edge handoff has an audit record.

## Required Artifacts

Each soak run writes:

- `runtime-readiness.json`
- `ingest-counters.jsonl`
- `bridge-events.jsonl`
- `ui-latency.jsonl`
- `export-manifest.json`
- `graph-query-latency.jsonl`
- `external-runtime-health.jsonl`
- `operator-audit.jsonl`
- `summary.md`

## Developer Smoke Before Soak

```bash
cd /mnt/c/jkim/RealTimeInsight-main/project/crates/rti_core
RUN_PERF_SMOKE=1 cargo test --release --test pcm_throughput_smoke -- --nocapture
RUN_PERF_SMOKE=1 cargo test --release --test datagram_throughput_smoke -- --nocapture
RUN_SOAK_SMOKE=1 cargo test --release --test datagram_soak_smoke -- --nocapture
RUN_MULTI_RATE_SOAK=1 cargo test --release --test multi_rate_soak_smoke -- --nocapture
```

## Stop Conditions

- Any unexpected app crash.
- Unbounded queue growth.
- Display includes bad-CRC samples without an explicit operator override.
- External runtime executes an action without operator approval.
- Missing required artifact.

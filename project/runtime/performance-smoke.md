# Performance Smoke Tests

Date: 2026-04-22

These tests are opt-in because they are performance gates rather than normal unit tests.

## Commands

```bash
cd /mnt/c/jkim/RealTimeInsight-main/project/crates/rti_core
RUN_PERF_SMOKE=1 cargo test --release --test pcm_throughput_smoke -- --nocapture
RUN_PERF_SMOKE=1 cargo test --release --test datagram_throughput_smoke -- --nocapture
RUN_SOAK_SMOKE=1 cargo test --release --test datagram_soak_smoke -- --nocapture
RUN_MULTI_RATE_SOAK=1 cargo test --release --test multi_rate_soak_smoke -- --nocapture
```

## Current Evidence

PCM decode release smoke:

- 10 Mbps profile: 245 frames in about 5-6 ms
- 20 Mbps profile: 489 frames in about 10-12 ms
- 30 Mbps profile: 733 frames in about 15-16 ms

Datagram ingest + event release smoke:

- 30 Mbps profile: 733 frames in about 35 ms

Datagram ingest + event release soak:

- 30 Mbps, 2 s equivalent profile: accepted 5832 frames, rejected 28 frames,
  75816 samples, about 385 ms

Multi-rate ingest + event release soak:

- 10 Mbps, 2 s equivalent profile: accepted 1932 frames, rejected 8 frames,
  25116 samples, about 132 ms
- 20 Mbps, 2 s equivalent profile: accepted 3884 frames, rejected 16 frames,
  50492 samples, about 240 ms
- 30 Mbps, 2 s equivalent profile: accepted 5836 frames, rejected 24 frames,
  75868 samples, about 384 ms

The 250 ms throughput smoke profiles are comfortably under their synthetic
window. The 2 s equivalent soak has its own 2 s developer-gate window.

## Policy

- Debug builds are not used for final throughput claims.
- CUDA `nvcc` is optional until a CUDA-specific acceleration lane is selected.
- The default acceleration direction is WebGPU/wgpu-first.
- These smoke tests are not substitutes for longer soak tests at 10/20/30 Mbps, but they protect against obvious regressions in the PCM/data-plane hot path.
- The 2 s equivalent soak is still a developer smoke, not a certification soak.
- The multi-rate soak guards 10/20/30 Mbps together, but is still a developer
  smoke rather than a certification soak.

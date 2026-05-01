# RealTimeInsight Test Layout

All production work follows TDD.

## TDD Rule

1. RED: write a focused failing test first.
2. GREEN: implement the smallest production change that passes.
3. REFACTOR: simplify without changing behavior.
4. VERIFY: rerun the focused test and the affected suite.

## Layout

- `unit/`: deterministic pure-code tests such as PCM sync/CRC decoding.
- `integration/`: MATLAB MCP, Ollama, SimDIS/DIS, Tauri bridge, and export integration tests.
- MATLAB MCP, Ollama, and GStreamer real runtime calls are opt-in through `RUN_MATLAB_MCP_SMOKE=1`, `RUN_MATLAB_MCP_TOOL_SMOKE=1`, `RUN_MATLAB_MCP_RUN_FILE_SMOKE=1`, `RUN_OLLAMA_SMOKE=1`, and `RUN_GSTREAMER_SMOKE=1`.
- `e2e/`: desktop app workflows and visual smoke tests.
- `fixtures/`: PCM bitstreams, DIS packets, export fixtures, and graph fixtures.
- `performance/`: 10/20/30 Mbps ingest, decode latency, export throughput, graph query, and LLM latency benchmarks.

## Current Test

- `unit/pcm_decoder_test.js`: verifies bit-slip sync recovery, CRC rejection, frame counter reconstruction, subcommutation, and extracted display samples.

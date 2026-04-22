# RealTimeInsight Folder Map

This repository is now organized as a handoff-preserving production workspace.

## Top-Level Areas

- `app/`: legacy Claude Design prototype. Keep it runnable while production code is built.
- `uploads/`: original product/UI/implementation references and reports.
- `src/`: production frontend source for the React/Tauri app.
- `src-tauri/`: Tauri shell and desktop command surface.
- `crates/rti_core/`: Rust hot-path core for ingest, decode, export, graph, and integrations.
- `gpu/`: GPU compute/render references, shaders, kernels, and backend notes.
- `runtime/`: local runtime discovery, install checks, and smoke-test evidence.
- `tests/`: TDD tests split by unit, integration, e2e, fixtures, and performance.
- `docs/`: architecture, decisions, and implementation notes.

## Frontend Layout

`src/` follows the uploaded implementation spec:

- `src/app`: boot, providers, app composition.
- `src/shell`: top bar, sidebars, workspace shell, status console.
- `src/modules/ingest`: receiver state, stream config, live/replay source adapters.
- `src/modules/panels`: panel registry and panel controllers.
- `src/modules/integrations`: MATLAB MCP, SimDIS/DIS, Ollama, export bridges.
- `src/modules/graph`: evidence graph, root-cause ranking, hybrid search.
- `src/modules/llm`: local LLM prompts, tool calling, evidence citation.
- `src/panels`: strip, numeric, waterfall, map, video, 3D, relation graph panels.
- `src/store`: global/session/stream/workspace stores.
- `src/bridge`: Tauri command and event schemas.
- `src/types`: shared domain types.

## Rust Core Layout

`crates/rti_core/src/` is the production compute boundary:

- `ingest`: UDP receiver, backpressure, capture/replay buffers.
- `pcm`: bitstream sync, bit-slip recovery, frame extraction, subcommutation.
- `quality`: CRC, decode validity, frame/sample quality flags.
- `export`: CSV/Parquet/Arrow/MATLAB export hot paths.
- `simdis`: DIS/IEEE-1278.1 entity state and time-sync network bridge.
- `matlab`: MATLAB MCP client adapter and script/test handoff contracts.
- `llm`: Ollama/Gemma 4 client and evidence-grounded tool calls.
- `graph`: typed evidence graph, hybrid ranking, causal/root-cause queries.
- `gpu`: GPU dispatch adapters for FFT, decimation, waterfall, and graph kernels.

## GPU Direction

CyberEther is the reference pattern for the GPU boundary: keep low-latency signal processing and visualization close to native APIs, with WebGPU/Vulkan/CUDA-style acceleration behind a clean pipeline boundary. RealTimeInsight should borrow the architectural idea, not copy CyberEther code.

Source reference: https://github.com/luigifcruz/CyberEther


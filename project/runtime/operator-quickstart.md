# RealTimeInsight Operator Quickstart

Date: 2026-04-22

Use this after checkout or handoff to verify the current workstation build and
understand what remains before full production operation.

## Windows Workstation

```powershell
cd C:\jkim\RealTimeInsight-main
npm install
npm test
npm run build
node project\runtime\runtime-readiness-report.js
node project\runtime\generate-readiness-bundle.js
node project\runtime\verify-local.js
node project\runtime\verify-external-runtimes.js
```

The app build and JS contract tests should pass on Windows. Full external
runtime readiness may still fail until MATLAB MCP, GStreamer, and SimDIS are
configured for the target workstation.

## Linux / WSL Workstation

```bash
cd /mnt/c/jkim/RealTimeInsight-main
npm install
npm test
npm run build
cd project/src-tauri && cargo check
node ../../project/runtime/runtime-readiness-report.js
node ../../project/runtime/generate-readiness-bundle.js
node ../../project/runtime/verify-local.js
node ../../project/runtime/verify-external-runtimes.js
```

Use WSL for Rust/Tauri validation and PCM/data-plane tests.

## Core Rust Verification

```bash
cd /mnt/c/jkim/RealTimeInsight-main/project/crates/rti_core
cargo test
RUN_PERF_SMOKE=1 cargo test --release --test pcm_throughput_smoke -- --nocapture
RUN_PERF_SMOKE=1 cargo test --release --test datagram_throughput_smoke -- --nocapture
RUN_SOAK_SMOKE=1 cargo test --release --test datagram_soak_smoke -- --nocapture
RUN_MULTI_RATE_SOAK=1 cargo test --release --test multi_rate_soak_smoke -- --nocapture
```

## Optional External Runtime Smokes

```bash
RUN_MATLAB_MCP_TOOL_SMOKE=1 node project/runtime/matlab-mcp-tool-smoke.js
RUN_MATLAB_MCP_RUN_FILE_SMOKE=1 node project/runtime/matlab-mcp-tool-smoke.js
RUN_GSTREAMER_SMOKE=1 node project/runtime/gstreamer-smoke.js
RUN_OLLAMA_SMOKE=1 node project/runtime/ollama-evidence-smoke.js
```

## Full Readiness Gate

```bash
node project/runtime/runtime-readiness-report.js --strict
```

This intentionally fails until all full external runtime blockers are resolved.

## Next Documents

- `project/runtime/external-runtime-blockers.json`
- `project/runtime/setup-external-runtimes.md`
- `project/runtime/setup-matlab-mcp.md`
- `project/runtime/setup-gstreamer.md`
- `project/runtime/setup-simdis.md`
- `project/runtime/certification-soak-plan.md`
- `project/runtime/ralph-completion-gate.md`

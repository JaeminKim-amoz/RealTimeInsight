# Runtime Discovery

Date: 2026-04-22

## Detected

- Node.js: `C:\Program Files\nodejs\node.exe`, version `22.17.0.0`
- npm: `C:\Program Files\nodejs\npm.ps1`
- MATLAB executable: `C:\Program Files\MATLAB\R2026a\bin\matlab.exe`
- NVIDIA GPU: `NVIDIA GeForce RTX 3050 Ti Laptop GPU`
- NVIDIA driver: `511.81`
- GPU memory: `4096 MiB`
- CUDA runtime reported by `nvidia-smi`: `11.6`
- WSL Node.js: `/usr/bin/node`, version `v22.22.2`
- WSL npm: `/usr/bin/npm`, version `10.9.7`
- WSL Rust: `rustc 1.95.0`, `cargo 1.95.0`
- Tauri CLI: `tauri-cli 2.10.1`
- MATLAB MCP Core Server: `github.com/matlab/matlab-mcp-core-server v0.8.0`
- Ollama: `0.21.0`
- Ollama model: `gemma4:31b`, 19 GB
- SIMDIS SDK source baseline: `project/vendor/simdissdk` (US Naval Research Laboratory SIMDIS SDK, shallow clone).

## Not Found On PATH

- full SimDIS executable/sidecar profile (SDK source baseline is present)
- GStreamer video runtime (`gst-launch-1.0`, `gst-inspect-1.0`, `tsdemux`, `appsink`)

## Smoke Test Findings

Command:

```powershell
matlab -batch "disp(version); exit"
```

Result:

```text
Fatal Startup Error:
Dynamic exception type: class std::runtime_error
std::exception::what: System Error: File system inconsistency
ERROR: MATLAB error Exit Status: 0x00000001
```

Historical note: this was the initial RED condition for the MATLAB integration TDD track. Current WSL smoke now reaches MATLAB version output, and MATLAB MCP Core Server is installed at the detected v0.8.0 baseline.

## Required Next Runtime Steps

- Build DIS packet validation and SimDIS bridge tests against the local SDK source baseline.
- Identify a full SimDIS executable/profile later if a sidecar workflow is required.
- Install GStreamer runtime/plugins later for real MPEG-TS/H.264 demux and appsink video seek.

## Automated Smoke Runner

Command:

```bash
node project/runtime/runtime-discovery.js --json
```

Purpose:

- report PASS/FAIL status for every Phase 0 runtime prerequisite without
  adding npm/Rust dependencies;
- keep missing external runtimes as explicit RED readiness items instead of
  silently mocking them;
- classify the local hardware profile for degraded/developer/full runtime
  decisions.

## Performance Smoke

See `project/runtime/performance-smoke.md` for opt-in release-mode throughput
commands and latest 10/20/30 Mbps PCM evidence.

## Latest Automated Readiness

Run date: 2026-04-22

Summary:

- Phase 0 smoke runner readiness: **YES** (`node` and `npm` available).
- Production prerequisite discovery readiness: **YES** for the approved current baseline.
- Hardware profile: **developer laptop**.

Current PASS checks:

- `node-npm`: Node `v22.22.2`, npm `10.9.7`.
- `rust-cargo`: `rustc 1.95.0`, `cargo 1.95.0`.
- `nvidia-gpu`: `NVIDIA GeForce RTX 3050 Ti Laptop GPU`, driver `511.81`,
  CUDA runtime `11.6`, memory `4096 MiB`.
- `matlab`: MATLAB startup smoke now reaches version output:
  `26.1.0.3030274 (R2026a) Prerelease`.
- `tauri-cli`: `tauri-cli 2.10.1`.
- `matlab-mcp-core-server`: `v0.8.0`.
- `ollama-gemma4:31b`: Ollama `0.21.0`, model `gemma4:31b` present.
- `vite-build`: `npm run build` passes.
- `rti-core`: `cargo check` passes for `project/crates/rti_core`.
- `tauri-shell`: `cargo check` passes for `project/src-tauri` after installing Linux desktop prerequisites.

Current non-blocking / policy checks:

- `cuda-toolkit-nvcc`: skipped by policy. CUDA-specific kernels are optional
  until a CUDA acceleration lane is selected; use `wgpu`/WebGPU first.
- `simdis`: SDK source baseline present at `project/vendor/simdissdk`.
- `gstreamer`: missing on current PATH; video segment/seek contracts are implemented, real demux/appsink execution is pending runtime installation.
- `dis-entity-state`: Rust encode/decode/validation tests pass for Entity State PDU.

Readiness decision:

- Phase 1 scaffold checks are now passing for frontend build, bridge schema tests,
  `rti_core` cargo check, and Tauri shell cargo check.
- Phase 2 baseline checks are now passing for Rust PCM parity, quality filtering,
  ingest sample buffering, and DIS Entity State PDU validation.
- MATLAB, MATLAB MCP Core Server, Ollama, and `gemma4:31b` are installed and
  detected. A dedicated LLM answer-quality/latency lane still exists for final
  acceptance evidence.
- Runtime discovery now has a local SIMDIS SDK source baseline. Full SimDIS
  bridge acceptance now includes basic DIS Entity State PDU encode/decode
  validation. A configured executable/profile is still needed only for a full
  sidecar workflow.

## LLM Evidence Smoke

Command:

```bash
RUN_OLLAMA_SMOKE=1 node project/runtime/ollama-evidence-smoke.js
```

Current result:

- PASS: `gemma4:31b` endpoint is available and the tuned evidence-answer smoke
  returns an answer containing both required citations.
- Latest observed answer: `EVT-1 and CH-1002 show the hydraulic pressure spike
  followed a bus current transient.`
- Latest observed duration: about 180s for the evidence-specific smoke on the
  developer laptop profile.
- Deterministic citation validation remains green through
  `validate_demo_llm_answer` and `rti_core::llm`.

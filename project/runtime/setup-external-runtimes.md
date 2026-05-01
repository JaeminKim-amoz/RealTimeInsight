# External Runtime Readiness Runbook

Date: 2026-04-22

RealTimeInsight core workflows run offline without every optional runtime, but
full production operation requires these external runtimes to be installed and
discoverable on the host profile.

## One-Command Readiness

```bash
node project/runtime/runtime-discovery.js --json
node project/runtime/runtime-readiness-report.js
node project/runtime/runtime-readiness-report.js --strict
node project/runtime/verify-external-runtimes.js
```

Optional real-runtime smoke commands:

```bash
RUN_MATLAB_MCP_TOOL_SMOKE=1 node project/runtime/matlab-mcp-tool-smoke.js
RUN_MATLAB_MCP_RUN_FILE_SMOKE=1 node project/runtime/matlab-mcp-tool-smoke.js
RUN_GSTREAMER_SMOKE=1 node project/runtime/gstreamer-smoke.js
RUN_OLLAMA_SMOKE=1 node project/runtime/ollama-evidence-smoke.js
```

## Linux / WSL Runtime Requirements

- Rust/Cargo and Tauri prerequisites installed in WSL.
- MATLAB MCP Core Server on PATH.
- Linux MATLAB executable available to MCP as `bin/matlab`.
- GStreamer tools/plugins installed:
  - `gst-launch-1.0`
  - `gst-inspect-1.0`
  - `tsdemux`
  - `appsink`
- SimDIS executable/profile configured if full sidecar operation is required:
  - `SIMDIS_PATH`
  - `SIMDIS_SDK_PATH`
  - `SIMDIS_PROFILE`

## Windows Runtime Requirements

- Node/npm and Vite build use Windows-compatible Rollup optional native package.
- MATLAB `matlab.exe` is discoverable for Windows runtime smoke.
- GStreamer MSVC x86_64 runtime `bin` folder on PATH.
- SimDIS executable/profile configured if full sidecar operation is required:
  - `SIMDIS_PATH`
  - `SIMDIS_SDK_PATH`
  - `SIMDIS_PROFILE`

## Current Known Blockers

- MATLAB MCP `run_matlab_file` is blocked in WSL until a Linux MATLAB
  executable is visible to the MCP server. Windows `matlab.exe` under `/mnt/c`
  is not sufficient for the Linux MCP binary.
- GStreamer real demux/appsink execution is blocked until the runtime and
  required plugins are installed.
- Full SimDIS process launch is blocked until a Linux or Windows executable and
  profile are configured.
- Certification-grade soak/load testing remains beyond the current developer
  smoke gates.

## Related Guides

- `project/runtime/setup-gstreamer.md`
- `project/runtime/setup-simdis.md`
- `project/runtime/setup-matlab-mcp.md`
- `project/runtime/install-matlab-mcp.sh`
- `project/runtime/performance-smoke.md`

# RealTimeInsight Implementation Status

Date: 2026-04-22

## Current Baseline

- Production scaffold exists for Vite/React/TypeScript, Tauri 2, and Rust `rti_core`.
- Legacy prototype remains preserved under `project/app`.
- WSL runtime discovery reports the current baseline as production-ready for the implemented foundation.

## Implemented

- PCM frame decode with bit-slip sync search, CRC-16/CCITT, frame counter, subcommutation, quality flags, and display samples.
- UDP receiver configuration and local datagram receive helpers.
- Datagram-to-PCM ingest pipeline.
- DatagramSource abstraction and scripted datagram tests for receiver logic without OS UDP dependency.
- Ingest store with bad-CRC display exclusion and per-channel ring buffers.
- DataRef registry and panel stream event generation.
- Tauri command stubs for live session, subscriptions, demo stream event, export, LLM validation, jobs, and root-cause candidates.
- Tauri bridge event listener contract and command-side `rti://bridge-event` emission for panel stream events.
- Managed background UDP receiver loop in `rti_core`, push event sink, Tauri start/stop/status/drain commands, and UI status panel.
- Managed receiver start accepts operator-configured bind IP, bind port, channel IDs, and expected bitrate.
- React workstation shell with top bar, channel explorer, workspace panels, insight pane, and bottom status.
- Channel search and click-to-subscribe flow.
- CSV export preview and CSV + manifest file writer.
- Export manifests with source run ID, app version, creation time, quality policy, value mode, row count, range, and channel IDs.
- Evidence graph candidate ranking and insight UI selection.
- Deterministic LLM evidence prompt/citation gate and manual Ollama request preview.
- Background job queue with timestamps and UI controls.
- Receiver diagnostics for CRC failures and sync loss events.
- Replay store/cursor for decoded sample windows with quality preservation.
- MATLAB script path/content safety boundary and generated anomaly bundle scripts.
- MATLAB MCP launch argument contract, run request contract, and opt-in MCP server smoke script.
- MATLAB MCP stdio tools/list contract and opt-in `detect_matlab_toolboxes` tool-call smoke.
- App-level MATLAB handoff panel, generated anomaly-bundle script command, `run_matlab_file` request preview, and MATLAB job queue entry.
- Opt-in MATLAB MCP `run_matlab_file` smoke exists; current WSL environment is blocked because MATLAB MCP requires a Linux MATLAB executable (`bin/matlab`), while only Windows MATLAB `matlab.exe` is visible under `/mnt/c`.
- Linux/Windows MATLAB MCP setup guide documents MCP server installation, Linux `bin/matlab` requirement, and Windows `matlab.exe` limitation.
- Runtime command allowlist and air-gapped action policy checks.
- Mission Edge operator approval and append-only audit record boundary.
- Offline asset/runtime inventory for map/video/MATLAB/Ollama/SimDIS status.
- Offline map/video asset validation for GeoPackage, GeoTIFF, CDB, and MPEG-TS fixtures.
- Live offline asset discovery scans `project/runtime/assets` for supported map/video formats.
- Runtime path policy resolves assets/exports from repo root, `project`, and `project/src-tauri` working directories.
- Linked map/video cursor contract and demo `video_sync_event` surfaced in the workstation UI.
- MPEG-TS segment index validation and cursor-to-frame seek contract for video sync.
- GStreamer runtime discovery, opt-in smoke script, and shell-free local MPEG-TS seek launch arguments.
- Linux/Windows GStreamer runtime setup guide with post-install smoke commands.
- Unified external runtime readiness runbook for MATLAB MCP, GStreamer, SimDIS, Ollama, and soak gates.
- Runtime readiness report script with per-runtime next actions and strict production blocker exit code.
- Certification soak plan for Linux/Windows long-duration ingest, replay, export, graph, and external-runtime evidence.
- Operator quickstart for Windows/WSL app verification, Rust verification, optional runtime smokes, and full readiness gate.
- Machine-readable external runtime blocker manifest for MATLAB MCP, GStreamer, SimDIS, and certification soak.
- Generated readiness bundle with runtime discovery JSON, external blockers, and handoff summary.
- Local verification runner for npm, Vite, TypeScript, Rust core, and Tauri checks with Windows/WSL fallback.
- Ralph completion gate defining when local code work is complete and only external runtime blockers remain.
- External runtime verification script that reruns strict readiness, MATLAB MCP, GStreamer, Ollama, and readiness bundle checks after installation.
- 30 Mbps, 2 s equivalent datagram ingest/event soak smoke.
- 10/20/30 Mbps multi-rate ingest/event soak smoke contract.
- DIS Entity State PDU encode/decode validation, entity ID policy, rate limit, bridge profile validation, Linux/Windows sidecar executable path contract, local UDP publish, SimDIS bridge UI status, and sidecar heartbeat degraded-state handling.
- Linux/Windows SimDIS runtime setup guide with `SIMDIS_PATH`, `SIMDIS_SDK_PATH`, and `SIMDIS_PROFILE` validation path.
- SIMDIS SDK source baseline under `project/vendor/simdissdk`.

## Verification

- `npm test`
- `npm run build`
- `cargo test` in `project/crates/rti_core`
- `cargo check` and `cargo test` in `project/src-tauri`
- Opt-in release performance smoke:
  - `RUN_PERF_SMOKE=1 cargo test --release --test pcm_throughput_smoke -- --nocapture`
  - `RUN_PERF_SMOKE=1 cargo test --release --test datagram_throughput_smoke -- --nocapture`
- Opt-in Ollama evidence smoke:
  - `RUN_OLLAMA_SMOKE=1 node project/runtime/ollama-evidence-smoke.js`

## Remaining Work

- Replace remaining demo receiver tick fallback with synthetic replay fixtures or configured source profiles.
- Expand production panel rendering beyond counters and dataRef metadata.
- Add durable raw/decoded storage and replay.
- Add MATLAB MCP tool execution flows.
- Add full Ollama job execution with nonblocking progress updates.
- Add actual full SimDIS process launch/heartbeat integration once a Linux or Windows executable/profile path is configured.
- Add map/video/offline asset pipeline.
- Install GStreamer runtime/plugins for real demux/appsink execution beyond discovery and segment/seek contracts.
- Add security/audit tests for external runtime command boundaries.

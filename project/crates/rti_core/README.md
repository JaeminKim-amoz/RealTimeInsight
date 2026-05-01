# rti_core

Rust production core for RealTimeInsight.

This crate owns hot-path behavior that should not live in React:

- UDP ingest and buffering.
- PCM bit-sync, bit-slip recovery, frame extraction, CRC, and subcommutation.
- Quality flag generation and bad-frame filtering.
- Export writers.
- DIS/SimDIS network bridge.
- MATLAB MCP and Ollama client adapters.
- Evidence graph and root-cause ranking.
- GPU dispatch adapters.

The current JavaScript decoder in `project/app/pcm.js` is the executable prototype contract. Port behavior into Rust with tests first.


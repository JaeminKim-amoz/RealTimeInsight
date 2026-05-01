# Tauri Shell

This folder is reserved for the Tauri 2 desktop shell.

The shell should expose stable commands/events to the frontend:

- receiver lifecycle and stream configuration
- panel data subscriptions
- export jobs
- MATLAB MCP tool calls
- SimDIS/DIS network bridge status
- Ollama/Gemma 4 inference calls
- runtime discovery and diagnostics

Rust toolchain is not currently detected on PATH, so Tauri build work is blocked until `rustc` and `cargo` are installed.

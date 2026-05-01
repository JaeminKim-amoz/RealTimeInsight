# GPU Acceleration Notes

RealTimeInsight should use GPU acceleration where it protects realtime throughput or visual density:

- FFT/waterfall generation.
- Min/max or LTTB-style chart decimation.
- Video/telemetry overlay composition.
- Large evidence graph layout/ranking when CPU latency exceeds budget.
- Batch signal transforms used by anomaly detection.

CyberEther is the architectural reference for keeping signal processing and visualization close to native GPU APIs while still supporting WebGPU/WASM-style portability. For this project, the likely production path is:

1. Rust CPU implementation with benchmarks.
2. `wgpu` or WebGPU rendering/compute path for cross-platform acceleration.
3. CUDA-specific kernels only where DGX Spark or NVIDIA workstation profiles justify the extra backend.

Source reference: https://github.com/luigifcruz/CyberEther


# SimDIS Runtime Setup

Date: 2026-04-22

RealTimeInsight treats SimDIS as an optional bridge/sidecar, not as the core
renderer. The app can run with only the SDK baseline, but full sidecar operation
requires a configured SimDIS executable or sidecar profile.

## Linux

Install or build the SimDIS sidecar/executable for the target Linux workstation.
Then expose it through one of these environment variables:

```bash
export SIMDIS_PATH=/opt/simdis/bin/simdis
export SIMDIS_SDK_PATH=/mnt/c/jkim/RealTimeInsight-main/project/vendor/simdissdk
export SIMDIS_PROFILE=/mnt/c/jkim/RealTimeInsight-main/project/runtime/simdis/local-simdis.json
node project/runtime/runtime-discovery.js --json
```

Allowed executable basenames are:

- `simdis`
- `simdis-sidecar`

## Windows

Install SimDIS or a compatible sidecar on Windows. Then expose the executable
and optional profile:

```powershell
$env:SIMDIS_PATH = "C:\Program Files\SIMDIS\simdis.exe"
$env:SIMDIS_SDK_PATH = "C:\jkim\RealTimeInsight-main\project\vendor\simdissdk"
$env:SIMDIS_PROFILE = "C:\jkim\RealTimeInsight-main\project\runtime\simdis\local-simdis.json"
node project/runtime/runtime-discovery.js --json
```

Allowed executable basenames are:

- `simdis.exe`
- `simdis-sidecar.exe`

## Bridge Profile Contract

- DIS Entity State PDU publish rate must be at least 20 Hz.
- Target UDP port must be non-zero.
- Heartbeat timeout must be non-zero.
- Validation rate limit must cover the configured publish rate.
- URLs, parent traversal, shell executables, and non-SimDIS executable basenames
  are rejected.
- Missing sidecar executable is degraded, not fatal, when the SDK baseline is
  configured.

## Current Status

Runtime discovery currently finds the SDK baseline at
`project/vendor/simdissdk`, but no full SimDIS executable/profile is configured.
The DIS Entity State PDU, bridge profile validation, local UDP publish, and
Linux/Windows executable path contracts are implemented and tested.

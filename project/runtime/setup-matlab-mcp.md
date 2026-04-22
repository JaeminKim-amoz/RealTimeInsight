# MATLAB MCP Runtime Setup

Date: 2026-04-22

RealTimeInsight uses MathWorks MATLAB MCP Core Server for MATLAB handoff,
script checking, script execution, and toolbox/runtime discovery.

## MCP Server

Install the Linux MCP binary in WSL:

```bash
bash project/runtime/install-matlab-mcp.sh
matlab-mcp-core-server --version
matlab-mcp-core-server --help
```

## Linux / WSL MATLAB Requirement

For MCP `run_matlab_file` execution, the MCP server must be able to start a
Linux MATLAB executable at:

```text
<MATLAB_ROOT>/bin/matlab
```

Set the root explicitly when needed:

```bash
export MATLAB_MCP_MATLAB_ROOT=/usr/local/MATLAB/R2026a
RUN_MATLAB_MCP_RUN_FILE_SMOKE=1 node project/runtime/matlab-mcp-tool-smoke.js
```

Important: a Windows MATLAB executable such as
`/mnt/c/Program Files/MATLAB/R2026a/bin/matlab.exe` is not sufficient for the
Linux MCP binary because the server looks for Linux `bin/matlab`.

## Windows MATLAB

Windows `matlab.exe` is still useful for Windows-local runtime smoke:

```powershell
matlab -batch "disp(version); exit"
```

For MCP execution from WSL, install Linux MATLAB or run an MCP server compatible
with the Windows MATLAB process from a Windows-native environment.

## Verification

```bash
RUN_MATLAB_MCP_TOOL_SMOKE=1 node project/runtime/matlab-mcp-tool-smoke.js
RUN_MATLAB_MCP_RUN_FILE_SMOKE=1 node project/runtime/matlab-mcp-tool-smoke.js
```

Expected current state on this machine:

- `RUN_MATLAB_MCP_TOOL_SMOKE=1` passes.
- `RUN_MATLAB_MCP_RUN_FILE_SMOKE=1` reaches MCP `run_matlab_file`, then is
  blocked until Linux MATLAB `bin/matlab` is visible.

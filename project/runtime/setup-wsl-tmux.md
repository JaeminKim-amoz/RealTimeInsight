# WSL + tmux Setup For OMX Team/Ultrawork

## Current Diagnosis

Date: 2026-04-22

Observed from the current Codex session:

- `omx` is installed: `oh-my-codex v0.12.4`
- Ubuntu WSL package exists under WindowsApps/Packages.
- `wsl --status` and `wsl --list --verbose` fail with `E_ACCESSDENIED`.
- `ubuntu.exe` fails with "system cannot access the file".
- `vmcompute` initially required elevated startup.
- Newer WSL service name on this machine is `WSLService`; `LxssManager` may not exist.
- Administrator PowerShell showed WSL default version 2 but no registered Linux distributions.
- Current Codex process runs as `desktop-d5k78ca\codexsandboxoffline`; WSL registration performed under the normal `USER` account may not be visible/accessible to this sandbox account.
- `tmux` and `psmux` are not available on Windows PATH.

Conclusion: WSL repair requires an elevated Windows PowerShell session.

## Run In Administrator PowerShell

Open PowerShell as Administrator and run:

```powershell
wsl --shutdown
Start-Service vmcompute
Start-Service WSLService
wsl --status
wsl --list --verbose
```

If `Start-Service LxssManager` fails with "service not found", that is expected on newer WSL installs. Use `WSLService`.

If optional features need enabling:

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
wsl --update
```

Reboot if DISM reports that a restart is required.

## Install/Register Ubuntu

If `wsl --list --verbose` says no installed distributions:

```powershell
wsl --list --online
wsl --install -d Ubuntu
```

If online installation is blocked, install Ubuntu from Microsoft Store/winget, then launch it once from Start Menu or run:

```powershell
ubuntu.exe
```

Complete the initial UNIX username/password setup. Then verify:

```powershell
wsl --list --verbose
```

## Install tmux Inside Ubuntu

After WSL starts successfully:

```powershell
wsl -d Ubuntu -- bash -lc "sudo apt-get update && sudo apt-get install -y tmux ripgrep git curl build-essential"
wsl -d Ubuntu -- bash -lc "tmux -V"
```

## Verify OMX Team Preconditions

From inside a WSL shell:

```bash
cd /mnt/c/jkim/RealTimeInsight-main
tmux new -s rti
omx --version
tmux display-message -p '#S #{pane_id}'
```

## Fix `omx: exec: node: not found` In WSL

If WSL prints:

```text
/mnt/c/Users/USER/AppData/Roaming/npm/omx: 15: exec: node: not found
```

then WSL is finding the Windows npm shim for `omx`, but Linux `node` is not installed or not on PATH.

Inside WSL, check:

```bash
which omx
which node
echo "$PATH"
```

Recommended fix is to install Linux Node.js 22+ in WSL and then install/use Codex/OMX from the WSL npm prefix. OMX doctor currently requires Node >=20, so Ubuntu's default Node 18 is not enough.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version
npm --version
```

Then install Codex and OMX inside WSL:

```bash
npm config set prefix "$HOME/.npm-global"
mkdir -p "$HOME/.npm-global/bin"
grep -qxF 'export PATH="$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:$PATH"' ~/.bashrc || \
  echo 'export PATH="$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
hash -r
npm install -g @openai/codex@latest --include=optional
npm install -g oh-my-codex
which codex
codex --version
which omx
omx --version
```

If `which omx` still points to `/mnt/c/Users/USER/AppData/Roaming/npm/omx`, put the Linux npm global bin before Windows PATH entries:

```bash
echo 'export PATH="$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
hash -r
which omx
```

Alternative quick fix if npm global uses `/usr/local/bin`:

```bash
hash -r
/usr/local/bin/omx --version
```

If `codex` errors with:

```text
Missing optional dependency @openai/codex-linux-x64
```

then you are still running the Windows npm-installed Codex package from `/mnt/c/...`, or Codex was installed with optional dependencies omitted. Fix with:

```bash
hash -r
npm uninstall -g @openai/codex
npm install -g @openai/codex@latest --include=optional
which codex
codex --version
```

If `npm install -g` fails with:

```text
EACCES: permission denied, mkdir '/usr/lib/node_modules/...'
```

your npm global prefix points to a root-owned system directory. Use a user-owned prefix:

```bash
npm config set prefix "$HOME/.npm-global"
mkdir -p "$HOME/.npm-global/bin"
grep -qxF 'export PATH="$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:$PATH"' ~/.bashrc || \
  echo 'export PATH="$HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
hash -r
npm install -g @openai/codex@latest --include=optional
npm install -g oh-my-codex
which codex
which omx
```

Expected good paths:

```text
/home/eta/.npm-global/bin/codex
/home/eta/.npm-global/bin/omx
```

If `which codex` still points into `/mnt/c/Users/USER/AppData/Roaming/npm`, ensure Linux npm global bin paths come first:

```bash
npm config get prefix
echo 'export PATH="/usr/local/bin:$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
hash -r
which codex
which omx
```

OMX doctor should then improve from:

```text
[XX] Node.js: v18.19.1 (need >= 20)
```

to Node 22+.

Inside that tmux session, verify:

```bash
echo "$TMUX"
tmux list-panes -F '#{pane_id} #{pane_start_command}'
```

Then `omx team ...` can create durable tmux worker panes.

## Troubleshoot `failed to create worker pane ... can't find pane`

If `omx team 6:executor ...` starts resolving workers and then fails like:

```text
Error: failed to create worker pane 4: can't find pane
```

then WSL, Node, OMX, and tmux are working far enough to start team mode. The failure is likely pane/window layout related or a stale partial startup.

Inside the same tmux session, inspect panes:

```bash
tmux display-message -p '#S:#I.#P #{window_width}x#{window_height}'
tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index} #{pane_id} #{pane_width}x#{pane_height} #{pane_current_command} #{pane_start_command}'
ls -R .omx/state/team 2>/dev/null || true
```

If a partial team exists, inspect or shut it down:

```bash
omx team status <team-name>
omx team shutdown <team-name> --force
```

If no team state exists, start from a fresh tmux window:

```bash
tmux new-window -n rti-team
cd /mnt/c/jkim/RealTimeInsight-main
```

For initial validation, use fewer workers first:

```bash
omx team 2:executor "TDD Phase 0 only: runtime discovery tests for .omx/plans/prd-realtimeinsight-full-implementation.md"
```

If 2 workers works, try 3:

```bash
omx team 3:executor "TDD Phase 0 and Phase 1: runtime discovery, Rust/Tauri scaffold checks, bridge schema tests"
```

Only retry 6 workers after 2-3 workers launch cleanly. A larger Windows Terminal/tmux window helps because splitting six panes can fail in small layouts:

```bash
tmux resize-window -x 240 -y 70
```

## Troubleshoot `team_name_conflict`

If relaunching prints:

```text
team_name_conflict: active team state already exists for "implement-omx-plans-prd-realti"
```

do not launch another team. Inspect the existing one:

```bash
tmux ls
tmux attach -t rti
omx team status implement-omx-plans-prd-realti
omx team resume implement-omx-plans-prd-realti
```

If workers show `codex_startup_no_evidence_after_fallback`, inspect panes:

```bash
tmux list-panes -a -F '#{session_name}:#{window_index}.#{pane_index} #{pane_id} #{pane_current_command} #{pane_start_command}'
tmux capture-pane -pt %5 -S -80
tmux capture-pane -pt %6 -S -80
```

If `tmux ls` says no server but `.omx/state/team/<team>` exists, the state is stale. Shut it down before relaunch:

```bash
omx team shutdown implement-omx-plans-prd-realti --force
tmux new -s rti
cd /mnt/c/jkim/RealTimeInsight-main
omx team 6:executor "Implement .omx/plans/prd-realtimeinsight-full-implementation.md with TDD. Start with Phase 0 and Phase 1 only: runtime discovery tests, Rust/Tauri scaffold checks, bridge schema tests, and preserve the prototype in project/app. Use the approved test spec at .omx/plans/test-spec-realtimeinsight-full-implementation.md. Do not skip RED-GREEN-REFACTOR evidence."
```

If `tmux new -s rti2` prints `[exited]`, you are no longer inside tmux afterwards. Start an interactive tmux shell first, then run `omx team` from inside it:

```bash
cd /mnt/c/jkim/RealTimeInsight-main
tmux new -s rti2
```

Now, inside the tmux screen:

```bash
echo "$TMUX"
cd /mnt/c/jkim/RealTimeInsight-main
omx team 2:executor "TDD Phase 0 smoke only: verify runtime discovery tests and report readiness"
```

Do not put `tmux new -s rti2` and `omx team ...` in the same pasted block unless you use `tmux new-session -d` plus `tmux send-keys`. The simple path is: enter tmux first, then run the team command interactively.

## Troubleshoot MCP Startup Timeout In Worker Panes

If Codex worker panes show:

```text
MCP client for `omx_memory` timed out after 5 seconds
MCP client for `omx_wiki` timed out after 5 seconds
MCP client for `omx_state` timed out after 5 seconds
MCP client for `omx_trace` timed out after 5 seconds
MCP startup incomplete
```

increase MCP startup timeouts in WSL Codex config:

```bash
cp ~/.codex/config.toml ~/.codex/config.toml.bak.$(date +%Y%m%d%H%M%S)
python3 - <<'PY'
from pathlib import Path

path = Path.home() / ".codex" / "config.toml"
text = path.read_text()
servers = ["omx_memory", "omx_wiki", "omx_state", "omx_trace"]

for server in servers:
    header = f"[mcp_servers.{server}]"
    if header not in text:
        text += f"\n{header}\nstartup_timeout_sec = 30\n"
        continue

    start = text.index(header)
    next_header = text.find("\n[mcp_servers.", start + len(header))
    end = len(text) if next_header == -1 else next_header
    block = text[start:end]
    if "startup_timeout_sec" in block:
        lines = [
            "startup_timeout_sec = 30" if line.strip().startswith("startup_timeout_sec") else line
            for line in block.splitlines()
        ]
        block = "\n".join(lines) + ("\n" if block.endswith("\n") else "")
    else:
        block = block.rstrip() + "\nstartup_timeout_sec = 30\n"
    text = text[:start] + block + text[end:]

path.write_text(text)
PY
grep -n "mcp_servers.omx_\\|startup_timeout_sec" ~/.codex/config.toml
```

Then verify:

```bash
omx doctor
codex --version
```

If workers still timeout, raise to 60:

```bash
perl -0pi -e 's/startup_timeout_sec = 30/startup_timeout_sec = 60/g' ~/.codex/config.toml
omx doctor
```

## Important: Codex Sandbox User Caveat

If WSL works in your Administrator or normal USER PowerShell but this Codex session still reports `E_ACCESSDENIED`, the likely cause is that Codex is running under a sandbox user:

```text
desktop-d5k78ca\codexsandboxoffline
```

WSL distributions are per-user registrations. A distro installed for `USER` may not be accessible to `codexsandboxoffline`.

Practical options:

1. Launch Codex/OMX from inside your normal USER WSL tmux session.
2. Run `omx team ...` manually inside that WSL tmux session rather than from this sandboxed Codex process.
3. If the environment supports it, install/register a WSL distro for the same account that runs Codex.

For OMX team mode, option 1 is preferred:

```bash
cd /mnt/c/jkim/RealTimeInsight-main
tmux new -s rti
omx team 6:executor "implement .omx/plans/prd-realtimeinsight-full-implementation.md with TDD"
```

## If psmux Is Considered

`psmux` is not currently installed and OMX team docs expect tmux. It may work only if it provides a tmux-compatible CLI surface or OMX explicitly supports it. Prefer WSL + tmux for canonical OMX team mode.

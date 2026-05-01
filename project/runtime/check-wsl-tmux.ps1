Write-Host "== Windows commands =="
Get-Command wsl,omx,tmux,psmux -ErrorAction SilentlyContinue | Select-Object Name,Source,Version

Write-Host "`n== WSL status =="
wsl --status
wsl --list --verbose

Write-Host "`n== WSL tmux =="
wsl -d Ubuntu -- bash -lc "echo USER=\$(whoami); command -v node || true; node --version || true; command -v npm || true; npm --version || true; command -v tmux || true; tmux -V || true; command -v omx || true; omx --version || true; echo TMUX=\$TMUX"

Write-Host "`n== OMX =="
omx --version

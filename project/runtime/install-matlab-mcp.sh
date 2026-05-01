#!/usr/bin/env bash
set -euo pipefail

mkdir -p "$HOME/.local/bin"
curl -L -o "$HOME/.local/bin/matlab-mcp-core-server" \
  "https://github.com/matlab/matlab-mcp-core-server/releases/download/v0.8.0/matlab-mcp-core-server-glnxa64"
chmod +x "$HOME/.local/bin/matlab-mcp-core-server"

case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.bashrc" ;;
esac

export PATH="$HOME/.local/bin:$PATH"
which matlab-mcp-core-server
matlab-mcp-core-server --help | head -40

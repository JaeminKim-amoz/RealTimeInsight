const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EXPECTED_TOOLS = [
  'check_matlab_code',
  'detect_matlab_toolboxes',
  'evaluate_matlab_code',
  'run_matlab_file',
  'run_matlab_test_file',
];

function send(child, message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

function waitForResponse(pending, id, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`timed out waiting for MCP response ${id}`));
    }, timeoutMs);
    pending.set(id, (message) => {
      clearTimeout(timer);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    });
  });
}

async function runMcpSequence({ callTool, runFile }) {
  const executable = process.env.MATLAB_MCP_SERVER || 'matlab-mcp-core-server';
  const args = [
    '--disable-telemetry', 'true',
    '--matlab-display-mode', 'nodesktop',
    '--initial-working-folder', process.cwd(),
  ];
  if (process.env.MATLAB_MCP_MATLAB_ROOT) {
    args.push('--matlab-root', process.env.MATLAB_MCP_MATLAB_ROOT);
  }
  const child = spawn(executable, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const pending = new Map();
  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    for (;;) {
      const index = buffer.indexOf('\n');
      if (index < 0) break;
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      if (Object.prototype.hasOwnProperty.call(message, 'id') && pending.has(message.id)) {
        pending.get(message.id)(message);
      }
    }
  });
  child.stderr.on('data', () => {});

  try {
    send(child, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'realtimeinsight-smoke', version: '0.1.0' },
      },
    });
    const initialized = await waitForResponse(pending, 1, 15_000);
    send(child, { jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
    send(child, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const listed = await waitForResponse(pending, 2, 15_000);
    const toolNames = listed.tools.map((tool) => tool.name).sort();
    for (const tool of EXPECTED_TOOLS) {
      if (!toolNames.includes(tool)) throw new Error(`missing MATLAB MCP tool ${tool}`);
    }

    let toolResult = null;
    if (callTool) {
      send(child, {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'detect_matlab_toolboxes',
          arguments: {},
        },
      });
      toolResult = await waitForResponse(pending, 3, 120_000);
      const text = JSON.stringify(toolResult);
      if (!/MATLAB|R20|Toolbox/i.test(text)) {
        throw new Error(`unexpected detect_matlab_toolboxes result: ${text.slice(0, 500)}`);
      }
    }

    let runFileResult = null;
    if (runFile) {
      const scriptPath = path.join(process.cwd(), 'project/runtime/matlab/mcp_run_file_smoke.m');
      fs.mkdirSync(path.dirname(scriptPath), { recursive: true });
      fs.writeFileSync(scriptPath, "disp('RTI_MATLAB_RUN_FILE_OK');\n", 'utf8');
      send(child, {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'run_matlab_file',
          arguments: { script_path: scriptPath },
        },
      });
      runFileResult = await waitForResponse(pending, 4, 120_000);
      const text = JSON.stringify(runFileResult);
      if (!text.includes('RTI_MATLAB_RUN_FILE_OK')) {
        throw new Error(`unexpected run_matlab_file result: ${text.slice(0, 500)}. Ensure Linux MATLAB bin/matlab is visible to MATLAB MCP; Windows matlab.exe under /mnt/c is not sufficient for the Linux MCP binary.`);
      }
    }

    console.log('MATLAB MCP tool smoke passed:', {
      server: initialized.serverInfo,
      tools: toolNames,
      toolCall: callTool ? 'detect_matlab_toolboxes' : 'skipped',
      runFile: runFile ? 'mcp_run_file_smoke.m' : 'skipped',
    });
  } finally {
    child.stdin.end();
    child.kill('SIGTERM');
  }
}

if (process.env.RUN_MATLAB_MCP_TOOL_SMOKE !== '1' && process.env.RUN_MATLAB_MCP_RUN_FILE_SMOKE !== '1') {
  console.log('MATLAB MCP tool smoke skipped; set RUN_MATLAB_MCP_TOOL_SMOKE=1 or RUN_MATLAB_MCP_RUN_FILE_SMOKE=1 to run. See project/runtime/setup-matlab-mcp.md.');
} else {
  runMcpSequence({
    callTool: true,
    runFile: process.env.RUN_MATLAB_MCP_RUN_FILE_SMOKE === '1',
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { EXPECTED_TOOLS };

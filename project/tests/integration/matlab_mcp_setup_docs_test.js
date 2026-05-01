const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..', '..');
const doc = fs.readFileSync(path.join(repo, 'project/runtime/setup-matlab-mcp.md'), 'utf8');

for (const expected of [
  'install-matlab-mcp.sh',
  'MATLAB_MCP_MATLAB_ROOT',
  '<MATLAB_ROOT>/bin/matlab',
  'Windows MATLAB executable',
  'matlab.exe',
  'RUN_MATLAB_MCP_TOOL_SMOKE=1',
  'RUN_MATLAB_MCP_RUN_FILE_SMOKE=1',
  'blocked until Linux MATLAB',
]) {
  assert.ok(doc.includes(expected), `MATLAB MCP setup documents ${expected}`);
}

console.log('MATLAB MCP setup docs test passed');

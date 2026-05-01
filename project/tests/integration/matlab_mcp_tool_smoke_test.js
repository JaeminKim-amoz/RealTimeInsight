const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repo = path.resolve(__dirname, '..', '..', '..');
const scriptPath = path.join(repo, 'project/runtime/matlab-mcp-tool-smoke.js');
const source = fs.readFileSync(scriptPath, 'utf8');

for (const expected of [
  'RUN_MATLAB_MCP_TOOL_SMOKE',
  'RUN_MATLAB_MCP_RUN_FILE_SMOKE',
  'MATLAB_MCP_MATLAB_ROOT',
  'tools/list',
  'detect_matlab_toolboxes',
  'run_matlab_file',
  'RTI_MATLAB_RUN_FILE_OK',
  'setup-matlab-mcp.md',
  'Linux MATLAB bin/matlab',
]) {
  assert.ok(source.includes(expected), `MATLAB MCP tool smoke includes ${expected}`);
}

const output = execFileSync(process.execPath, [scriptPath], {
  cwd: repo,
  encoding: 'utf8',
});
assert.ok(output.includes('MATLAB MCP tool smoke skipped'), 'MATLAB MCP tool smoke skips by default');

console.log('MATLAB MCP tool smoke script test passed');

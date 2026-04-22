const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repo = path.resolve(__dirname, '..', '..', '..');
const scriptPath = path.join(repo, 'project/runtime/matlab-mcp-smoke.js');
const source = fs.readFileSync(scriptPath, 'utf8');

assert.ok(source.includes('RUN_MATLAB_MCP_SMOKE'), 'MATLAB MCP smoke is opt-in');
assert.ok(source.includes('--version'), 'MATLAB MCP smoke checks version');
assert.ok(source.includes('--help'), 'MATLAB MCP smoke checks help surface');

const output = execFileSync(process.execPath, [scriptPath], {
  cwd: repo,
  encoding: 'utf8',
});
assert.ok(output.includes('MATLAB MCP smoke skipped'), 'MATLAB MCP smoke skips by default');

console.log('MATLAB MCP smoke script test passed');

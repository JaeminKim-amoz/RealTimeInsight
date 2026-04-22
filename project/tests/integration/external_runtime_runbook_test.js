const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..', '..');
const doc = fs.readFileSync(path.join(repo, 'project/runtime/setup-external-runtimes.md'), 'utf8');

for (const expected of [
  'node project/runtime/runtime-discovery.js --json',
  'RUN_MATLAB_MCP_TOOL_SMOKE=1',
  'RUN_MATLAB_MCP_RUN_FILE_SMOKE=1',
  'RUN_GSTREAMER_SMOKE=1',
  'RUN_OLLAMA_SMOKE=1',
  'Linux MATLAB executable',
  'Windows `matlab.exe`',
  'SIMDIS_PATH',
  'SIMDIS_SDK_PATH',
  'SIMDIS_PROFILE',
  'Current Known Blockers',
  'setup-gstreamer.md',
  'setup-simdis.md',
]) {
  assert.ok(doc.includes(expected), `external runtime runbook documents ${expected}`);
}

console.log('External runtime runbook test passed');

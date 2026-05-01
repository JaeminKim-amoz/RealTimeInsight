const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..', '..');
const script = fs.readFileSync(path.join(repo, 'project/runtime/verify-external-runtimes.js'), 'utf8');

for (const expected of [
  'runtime-readiness-report.js',
  '--strict',
  'RUN_MATLAB_MCP_TOOL_SMOKE',
  'RUN_MATLAB_MCP_RUN_FILE_SMOKE',
  'RUN_GSTREAMER_SMOKE',
  'RUN_OLLAMA_SMOKE',
  'generate-readiness-bundle.js',
  'external runtime verification step(s) failed',
]) {
  assert.ok(script.includes(expected), `external runtime verifier includes ${expected}`);
}

console.log('External runtime verifier script test passed');

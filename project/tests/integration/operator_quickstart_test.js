const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..', '..');
const doc = fs.readFileSync(path.join(repo, 'project/runtime/operator-quickstart.md'), 'utf8');

for (const expected of [
  'Windows Workstation',
  'Linux / WSL Workstation',
  'npm test',
  'npm run build',
  'cargo check',
  'cargo test',
  'RUN_PERF_SMOKE=1',
  'RUN_SOAK_SMOKE=1',
  'RUN_MULTI_RATE_SOAK=1',
  'RUN_MATLAB_MCP_TOOL_SMOKE=1',
  'RUN_GSTREAMER_SMOKE=1',
  'runtime-readiness-report.js --strict',
  'certification-soak-plan.md',
]) {
  assert.ok(doc.includes(expected), `operator quickstart documents ${expected}`);
}

console.log('Operator quickstart test passed');

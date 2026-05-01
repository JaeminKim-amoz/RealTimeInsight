const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..', '..');
const gate = fs.readFileSync(path.join(repo, 'project/runtime/ralph-completion-gate.md'), 'utf8');

for (const expected of [
  'node project/runtime/verify-local.js',
  'node project/runtime/generate-readiness-bundle.js',
  'linux-matlab-for-mcp',
  'gstreamer-runtime',
  'simdis-executable-profile',
  'certification-soak',
  'external-runtime-blockers.json',
  'local code work is complete',
  'Do not stop if any local verification command fails',
]) {
  assert.ok(gate.includes(expected), `Ralph completion gate documents ${expected}`);
}

console.log('Ralph completion gate test passed');

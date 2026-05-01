const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..', '..');
const doc = fs.readFileSync(path.join(repo, 'project/runtime/setup-simdis.md'), 'utf8');

for (const expected of [
  'Linux',
  'Windows',
  'SIMDIS_PATH',
  'SIMDIS_SDK_PATH',
  'SIMDIS_PROFILE',
  'simdis.exe',
  'simdis-sidecar.exe',
  '20 Hz',
  'Target UDP port must be non-zero',
  'Missing sidecar executable is degraded',
  'project/vendor/simdissdk',
]) {
  assert.ok(doc.includes(expected), `SimDIS setup documents ${expected}`);
}

console.log('SimDIS setup docs test passed');

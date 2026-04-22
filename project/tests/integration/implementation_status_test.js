const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..', '..');
const status = fs.readFileSync(path.join(repo, 'project/docs/implementation-status.md'), 'utf8');

for (const required of [
  'PCM frame decode',
  'UDP receiver configuration',
  'DataRef registry',
  'Tauri command stubs',
  'CSV export preview',
  'Evidence graph candidate ranking',
  'Background job queue',
  'Receiver diagnostics',
  'Replay store',
  'Runtime command allowlist',
  'Mission Edge operator approval',
  'Offline asset/runtime inventory',
  'DIS Entity State PDU',
  'Remaining Work',
]) {
  assert.ok(status.includes(required), `implementation status documents ${required}`);
}

console.log('Implementation status tests passed');

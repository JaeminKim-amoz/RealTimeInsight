const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..', '..');
const source = fs.readFileSync(path.join(repo, 'project/runtime/verify-local.js'), 'utf8');

for (const expected of [
  'npm test',
  'npm run build',
  'tsc --noEmit',
  'rti_core cargo test',
  'src-tauri cargo test',
  'src-tauri cargo check',
  'WSL rti_core cargo test',
  'All local verification steps passed',
]) {
  assert.ok(source.includes(expected), `local verifier includes ${expected}`);
}

console.log('Local verifier script test passed');

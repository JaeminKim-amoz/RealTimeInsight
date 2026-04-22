const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..', '..');
const manifestPath = path.join(repo, 'project/runtime/external-runtime-blockers.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert.strictEqual(manifest.schemaVersion, 1, 'blocker manifest schema version');
assert.ok(Array.isArray(manifest.blockers), 'blocker manifest has blockers');

for (const id of [
  'linux-matlab-for-mcp',
  'gstreamer-runtime',
  'simdis-executable-profile',
  'certification-soak',
]) {
  const blocker = manifest.blockers.find((entry) => entry.id === id);
  assert.ok(blocker, `blocker exists: ${id}`);
  assert.ok(blocker.reason, `${id} includes reason`);
  assert.ok(blocker.setup.startsWith('project/runtime/'), `${id} points to setup doc`);
  assert.ok(blocker.verify, `${id} includes verify command`);
  assert.ok(fs.existsSync(path.join(repo, blocker.setup)), `${id} setup doc exists`);
}

console.log('External runtime blockers manifest test passed');

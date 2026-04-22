const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..', '..');
const script = path.join(repo, 'project', 'runtime', 'ollama-evidence-smoke.js');

const skipped = spawnSync(process.execPath, [script], { encoding: 'utf8' });
assert.strictEqual(skipped.status, 0, skipped.stderr);
assert.ok(skipped.stdout.includes('skipped'));

console.log('Ollama evidence script test passed');

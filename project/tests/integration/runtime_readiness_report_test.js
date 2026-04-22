const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repo = path.resolve(__dirname, '..', '..', '..');
const scriptPath = path.join(repo, 'project/runtime/runtime-readiness-report.js');
const source = fs.readFileSync(scriptPath, 'utf8');

for (const expected of [
  'RealTimeInsight Runtime Readiness',
  'setup-gstreamer.md',
  'setup-simdis.md',
  'install-matlab-mcp.sh',
  'RUN_OLLAMA_SMOKE=1',
  'Known external blockers',
  'external-runtime-blockers.json',
  '--strict',
]) {
  assert.ok(source.includes(expected), `runtime readiness report includes ${expected}`);
}

const result = spawnSync(process.execPath, [scriptPath], {
  cwd: repo,
  encoding: 'utf8',
});
assert.strictEqual(result.status, 0, result.stderr);
assert.ok(result.stdout.includes('RealTimeInsight Runtime Readiness'), 'prints readiness heading');
assert.ok(result.stdout.includes('Production ready:'), 'prints production readiness');
assert.ok(result.stdout.includes('Full external runtime ready:'), 'prints full external readiness');
assert.ok(result.stdout.includes('Known external blockers:'), 'prints known external blockers');
assert.ok(result.stdout.includes('linux-matlab-for-mcp'), 'prints MATLAB blocker from manifest');
assert.ok(result.stdout.includes('gstreamer-runtime'), 'prints GStreamer blocker from manifest');

const { discoverRuntime } = require('../../runtime/runtime-discovery.js');
const report = discoverRuntime();
const nodeNpm = report.checks.find((check) => check.name === 'node-npm');
assert.strictEqual(nodeNpm.status, 'PASS', 'runtime discovery detects Node/npm on current platform');
assert.ok(Array.isArray(report.readiness.requiredForFullExternal), 'runtime discovery reports full external requirements');
assert.ok(report.readiness.requiredForFullExternal.includes('gstreamer'), 'full external requirements include GStreamer');
assert.strictEqual(typeof report.readiness.fullExternalReady, 'boolean', 'runtime discovery reports full external readiness');

const strict = spawnSync(process.execPath, [scriptPath, '--strict'], {
  cwd: repo,
  encoding: 'utf8',
});
assert.notStrictEqual(strict.status, 0, 'strict mode fails while production blockers remain');

console.log('Runtime readiness report test passed');

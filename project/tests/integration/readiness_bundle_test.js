const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repo = path.resolve(__dirname, '..', '..', '..');
const scriptPath = path.join(repo, 'project/runtime/generate-readiness-bundle.js');

const output = execFileSync(process.execPath, [scriptPath], {
  cwd: repo,
  encoding: 'utf8',
});

const jsonPath = path.join(repo, 'project/runtime/reports/readiness/latest-readiness.json');
const summaryPath = path.join(repo, 'project/runtime/reports/readiness/summary.md');
assert.ok(output.includes('Readiness bundle generated'), 'bundle generator reports output');
assert.ok(fs.existsSync(jsonPath), 'readiness JSON exists');
assert.ok(fs.existsSync(summaryPath), 'readiness summary exists');

const bundle = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const summary = fs.readFileSync(summaryPath, 'utf8');
assert.strictEqual(bundle.schemaVersion, 1);
assert.strictEqual(bundle.strictCommand, 'node project/runtime/runtime-readiness-report.js --strict');
assert.strictEqual(typeof bundle.strictExitCode, 'number');
assert.strictEqual(bundle.strictExitCode, bundle.runtime.readiness.fullExternalReady ? 0 : 1);
assert.ok(bundle.runtime.readiness, 'bundle includes runtime readiness');
assert.ok(Array.isArray(bundle.blockers.blockers), 'bundle includes blockers');
assert.ok(summary.includes('Known External Blockers'), 'summary includes blockers');
assert.ok(summary.includes('Strict exit code:'), 'summary includes strict exit code');
assert.ok(summary.includes('runtime-readiness-report.js --strict'), 'summary includes next strict command');

console.log('Readiness bundle test passed');

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..', '..');
const doc = fs.readFileSync(path.join(repo, 'project/runtime/certification-soak-plan.md'), 'utf8');

for (const expected of [
  'node project/runtime/runtime-readiness-report.js --strict',
  '10 Mbps live ingest',
  '20 Mbps live ingest',
  '30 Mbps live ingest',
  'Replay parity',
  'Export stress',
  'Evidence graph',
  'External runtime',
  'App-induced packet loss',
  'Export 1M samples completes under `10 s`',
  'Root-cause query p95 under `300 ms`',
  'RUN_MULTI_RATE_SOAK=1',
  'operator-audit.jsonl',
  'Stop Conditions',
]) {
  assert.ok(doc.includes(expected), `certification soak plan documents ${expected}`);
}

console.log('Certification soak plan test passed');

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const testsRoot = path.resolve(__dirname);

function collect(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (entry.isFile() && entry.name.endsWith('_test.js')) out.push(full);
  }
  return out;
}

const tests = collect(testsRoot).sort();
let failed = 0;

for (const test of tests) {
  const rel = path.relative(process.cwd(), test);
  const result = spawnSync(process.execPath, [test], { stdio: 'inherit' });
  if (result.status !== 0) {
    failed += 1;
    console.error(`FAILED ${rel}`);
  } else {
    console.log(`PASSED ${rel}`);
  }
}

if (failed) {
  console.error(`${failed} test file(s) failed`);
  process.exit(1);
}

console.log(`${tests.length} test file(s) passed`);

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..', '..', '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repo, relativePath), 'utf8'));
}

function exists(relativePath) {
  assert.ok(fs.existsSync(path.join(repo, relativePath)), `${relativePath} exists`);
}

const pkg = readJson('package.json');
assert.strictEqual(pkg.scripts.test, 'node project/tests/run_all_tests.js');
assert.ok(pkg.scripts.dev.includes('vite'));
assert.ok(pkg.scripts['tauri:dev'].includes('tauri'));

exists('index.html');
exists('vite.config.ts');
exists('tsconfig.json');
exists('project/src/app/App.tsx');
exists('project/src/bridge/schemas.js');
exists('project/src/bridge/schemas.d.ts');
exists('project/src-tauri/tauri.conf.json');
exists('project/src-tauri/Cargo.toml');
exists('project/crates/rti_core/Cargo.toml');
exists('project/crates/rti_core/src/lib.rs');

console.log('Scaffold contract tests passed');

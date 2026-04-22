const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repo = path.resolve(__dirname, '..', '..', '..');
const outDir = path.join(repo, 'project', 'runtime', 'exports');

fs.mkdirSync(outDir, { recursive: true });

function toWslPath(windowsPath) {
  return windowsPath.replace(/^([A-Za-z]):\\/, (_, drive) => `/mnt/${drive.toLowerCase()}/`).replace(/\\/g, '/');
}

function runCargoExportTest() {
  const cwd = path.join(repo, 'project', 'crates', 'rti_core');
  const direct = spawnSync('cargo', ['test', '--test', 'export_csv', 'writes_csv_and_manifest_files'], {
    cwd,
    encoding: 'utf8',
  });
  if (direct.status === 0 || direct.error?.code !== 'ENOENT') return direct;
  const command = `cd ${JSON.stringify(toWslPath(cwd))} && cargo test --test export_csv writes_csv_and_manifest_files`;
  const defaultWsl = spawnSync('wsl', ['--', 'bash', '-lc', command], {
    cwd: repo,
    encoding: 'utf8',
  });
  if (defaultWsl.status === 0) return defaultWsl;
  return spawnSync('wsl', ['-d', 'Ubuntu', '--', 'bash', '-lc', command], {
    cwd: repo,
    encoding: 'utf8',
  });
}

const result = runCargoExportTest();

assert.strictEqual(result.status, 0, result.stderr || result.stdout);
assert.ok(fs.existsSync(outDir), 'runtime export directory exists');

console.log('Export artifact smoke passed:', {
  outDir,
  cargoTest: 'export_csv::writes_csv_and_manifest_files',
});

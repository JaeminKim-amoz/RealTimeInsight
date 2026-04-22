#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

function run(label, command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    shell: false,
    stdio: options.stdio || 'pipe',
  });
  const ok = result.status === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) {
    const detail = result.stderr || result.stdout || (result.error && result.error.message) || '';
    if (detail) console.log(detail.trim().split(/\r?\n/).slice(0, 20).join('\n'));
  }
  return ok;
}

function has(command, args = ['--version']) {
  return spawnSync(command, args, { encoding: 'utf8', shell: process.platform === 'win32' }).status === 0;
}

function wslPath(windowsPath) {
  return windowsPath.replace(/^([A-Za-z]):\\/, (_, drive) => `/mnt/${drive.toLowerCase()}/`).replace(/\\/g, '/');
}

const repo = path.resolve(__dirname, '..', '..');
const checks = [
  ['npm test', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test'], repo],
  ['npm run build', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], repo],
  ['tsc --noEmit', process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--pretty', 'false'], repo],
];

let failed = 0;
for (const [label, command, args, cwd] of checks) {
  if (!run(label, command, args, { cwd, stdio: 'inherit' })) failed += 1;
}

const coreDir = path.join(repo, 'project', 'crates', 'rti_core');
const tauriDir = path.join(repo, 'project', 'src-tauri');
if (has('cargo')) {
  if (!run('rti_core cargo test', 'cargo', ['test'], { cwd: coreDir, stdio: 'inherit' })) failed += 1;
  if (!run('src-tauri cargo test', 'cargo', ['test'], { cwd: tauriDir, stdio: 'inherit' })) failed += 1;
  if (!run('src-tauri cargo check', 'cargo', ['check'], { cwd: tauriDir, stdio: 'inherit' })) failed += 1;
} else if (process.platform === 'win32' && has('wsl', ['--status'])) {
  const core = `cd ${JSON.stringify(wslPath(coreDir))} && cargo test`;
  const tauriTest = `cd ${JSON.stringify(wslPath(tauriDir))} && cargo test`;
  const tauriCheck = `cd ${JSON.stringify(wslPath(tauriDir))} && cargo check`;
  if (!run('WSL rti_core cargo test', 'wsl', ['--', 'bash', '-lc', core], { cwd: repo, stdio: 'inherit' })) failed += 1;
  if (!run('WSL src-tauri cargo test', 'wsl', ['--', 'bash', '-lc', tauriTest], { cwd: repo, stdio: 'inherit' })) failed += 1;
  if (!run('WSL src-tauri cargo check', 'wsl', ['--', 'bash', '-lc', tauriCheck], { cwd: repo, stdio: 'inherit' })) failed += 1;
} else {
  console.log('SKIP Rust checks: cargo unavailable and WSL fallback unavailable.');
}

if (failed) {
  console.error(`${failed} local verification step(s) failed.`);
  process.exit(1);
}

console.log('All local verification steps passed.');

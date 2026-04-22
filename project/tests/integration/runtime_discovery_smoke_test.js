const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const discoveryPath = path.join(repoRoot, 'runtime', 'runtime-discovery.md');
const markdown = fs.readFileSync(discoveryPath, 'utf8');

function section(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = markdown.match(new RegExp(`## ${escaped}\\n([\\s\\S]*?)(?=\\n## |$)`));
  assert.ok(match, `runtime discovery includes ${name} section`);
  return match[1];
}

function assertContains(haystack, pattern, message) {
  assert.ok(pattern.test(haystack), message);
}

function run(command, args = [], options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', ...options });
}

const detected = section('Detected');
const notFound = section('Not Found On PATH');
const smoke = section('Smoke Test Findings');
const nextSteps = section('Required Next Runtime Steps');

const readiness = [];
function record(id, status, detail) {
  readiness.push({ id, status, detail });
}

assertContains(detected, /- Node\.js: `[^`]+`, version `[^`]+`/, 'documents detected Node.js executable and version');
assertContains(detected, /- npm: `[^`]+`/, 'documents detected npm executable');
assertContains(detected, /- MATLAB executable: `[^`]+matlab\.exe`/i, 'documents detected MATLAB executable');
assertContains(detected, /- NVIDIA GPU: `[^`]+`/, 'documents detected NVIDIA GPU');
assertContains(detected, /- NVIDIA driver: `[^`]+`/, 'documents detected NVIDIA driver');
assertContains(detected, /- GPU memory: `\d+ MiB`/, 'documents GPU memory');
assertContains(detected, /- CUDA runtime reported by `nvidia-smi`: `[^`]+`/, 'documents CUDA runtime from nvidia-smi');
assertContains(detected, /- WSL Rust: `rustc [^`]+`, `cargo [^`]+`/, 'documents WSL Rust/Cargo readiness');
assertContains(detected, /- Tauri CLI: `tauri-cli [^`]+`/, 'documents Tauri CLI readiness');
assertContains(detected, /- MATLAB MCP Core Server: `[^`]+`/, 'documents MATLAB MCP Core Server readiness');
assertContains(detected, /- Ollama: `[^`]+`/, 'documents Ollama readiness');
assertContains(detected, /- Ollama model: `gemma4:31b`/, 'documents Gemma4 model readiness');
assertContains(detected, /SIMDIS SDK source baseline: `project\/vendor\/simdissdk`/, 'documents local SIMDIS SDK source baseline');
record('documented-detected-runtimes', 'PASS', 'Node/npm/MATLAB/GPU/CUDA/Rust/Tauri/MATLAB MCP/Ollama entries present');

assertContains(notFound, /full SimDIS executable\/sidecar profile/, 'documents missing full SimDIS sidecar profile');
assertContains(notFound, /GStreamer video runtime/, 'documents missing GStreamer video runtime');
record('documented-red-prerequisites', 'PASS', 'Full SimDIS sidecar missing state present');

assertContains(smoke, /matlab -batch "disp\(version\); exit"/, 'documents MATLAB startup smoke command');
assertContains(smoke, /Fatal Startup Error:/, 'captures MATLAB fatal startup error');
assertContains(smoke, /File system inconsistency/, 'captures MATLAB filesystem inconsistency RED condition');
assertContains(smoke, /Historical note:/, 'keeps MATLAB startup RED as historical note');
record('matlab-startup-red', 'PASS', 'MATLAB historical RED baseline is documented');

for (const expectedStep of [/DIS packet validation/, /full SimDIS executable\/profile/]) {
  assertContains(nextSteps, expectedStep, `documents next step ${expectedStep}`);
}
record('readiness-next-steps', 'PASS', 'Required runtime remediation steps are explicit');

assert.ok(process.version, 'current Node runtime exposes process.version');
record('current-node-smoke', 'PASS', process.version);

const npmVersion = run('npm', ['--version'], { shell: process.platform === 'win32' });
if (npmVersion.status === 0) {
  record('current-npm-smoke', 'PASS', npmVersion.stdout.trim());
} else {
  record('current-npm-smoke', 'BLOCKED', npmVersion.error ? String(npmVersion.error) : npmVersion.stderr);
}

const blockingReadiness = [
  'Optional full SimDIS sidecar executable/profile not configured',
];

const { discoverRuntime } = require('../../runtime/runtime-discovery.js');
const report = discoverRuntime();
assert.ok(report.readiness.requiredForFullExternal.includes('gstreamer'), 'full external readiness includes GStreamer');
assert.strictEqual(typeof report.readiness.fullExternalReady, 'boolean', 'reports full external readiness');

console.log('Runtime discovery smoke readiness:', {
  checks: readiness,
  readyForPhase1ProductionScaffold: false,
  blockingReadiness,
});

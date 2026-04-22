#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { discoverRuntime } = require('./runtime-discovery.js');

const ACTIONS = {
  'gstreamer': 'Install GStreamer tools/plugins, then run RUN_GSTREAMER_SMOKE=1 node project/runtime/gstreamer-smoke.js. See project/runtime/setup-gstreamer.md.',
  'simdis': 'Set SIMDIS_PATH and optionally SIMDIS_PROFILE/SIMDIS_SDK_PATH. See project/runtime/setup-simdis.md.',
  'matlab-mcp-core-server': 'Install MATLAB MCP Core Server with project/runtime/install-matlab-mcp.sh.',
  'matlab': 'Install MATLAB or expose matlab/matlab.exe on PATH. For WSL MCP run-file execution, Linux bin/matlab is required.',
  'ollama-gemma4-31b': 'Install Ollama, pull gemma4:31b, then run RUN_OLLAMA_SMOKE=1 node project/runtime/ollama-evidence-smoke.js.',
  'rust-cargo': 'Install Rust/Cargo in the active runtime environment.',
  'tauri-cli': 'Install project dependencies and Tauri CLI, then run npm install.',
};

function statusIcon(status) {
  if (status === 'PASS') return 'PASS';
  if (status === 'SKIP') return 'SKIP';
  return 'FAIL';
}

function actionFor(check) {
  return ACTIONS[check.name] || check.reason || 'Inspect runtime-discovery JSON for details.';
}

function printReport(report) {
  const strictReady = isStrictReady(report);
  const blockers = loadBlockers();
  console.log('RealTimeInsight Runtime Readiness');
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Host: ${report.host.platform} ${report.host.arch}`);
  console.log(`Hardware profile: ${report.hardwareProfile}`);
  console.log(`Phase 0 smoke ready: ${report.readiness.phase0SmokeReady ? 'YES' : 'NO'}`);
  console.log(`Production ready: ${report.readiness.productionReady ? 'YES' : 'NO'}`);
  console.log(`Full external runtime ready: ${strictReady ? 'YES' : 'NO'}`);
  console.log('');
  for (const check of report.checks) {
    const detail = check.reason || check.version || check.executable || '';
    console.log(`${statusIcon(check.status)} ${check.name}${detail ? ` - ${detail}` : ''}`);
    if (check.status === 'FAIL') {
      console.log(`  next: ${actionFor(check)}`);
    }
  }
  if (blockers.length) {
    console.log('');
    console.log('Known external blockers:');
    for (const blocker of blockers) {
      console.log(`- ${blocker.id} [${blocker.status}]: ${blocker.reason}`);
      console.log(`  setup: ${blocker.setup}`);
      console.log(`  verify: ${blocker.verify}`);
    }
  }
}

function isStrictReady(report) {
  return Boolean(report.readiness.fullExternalReady);
}

function loadBlockers() {
  const manifestPath = path.join(__dirname, 'external-runtime-blockers.json');
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return Array.isArray(manifest.blockers) ? manifest.blockers : [];
  } catch {
    return [];
  }
}

function main(argv) {
  const strict = argv.includes('--strict');
  const json = argv.includes('--json');
  const report = discoverRuntime();
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }
  if (strict && !isStrictReady(report)) {
    process.exitCode = 1;
  }
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { ACTIONS, actionFor, isStrictReady, loadBlockers };

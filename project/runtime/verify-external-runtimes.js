#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, ...(options.env || {}) },
  });
  return {
    command: [command, ...args].join(' '),
    status: result.status,
    ok: result.status === 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? result.error.message : null,
  };
}

function printResult(label, result) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'} ${label}: ${result.command}`);
  if (!result.ok) {
    const detail = (result.stderr || result.stdout || result.error || '').trim();
    if (detail) console.log(detail.split(/\r?\n/).slice(0, 8).join('\n'));
  }
}

const repo = path.resolve(__dirname, '..', '..');
const checks = [
  ['readiness report', process.execPath, ['project/runtime/runtime-readiness-report.js']],
  ['readiness strict', process.execPath, ['project/runtime/runtime-readiness-report.js', '--strict']],
  ['MATLAB MCP tools', process.execPath, ['project/runtime/matlab-mcp-tool-smoke.js'], { RUN_MATLAB_MCP_TOOL_SMOKE: '1' }],
  ['MATLAB MCP run file', process.execPath, ['project/runtime/matlab-mcp-tool-smoke.js'], { RUN_MATLAB_MCP_RUN_FILE_SMOKE: '1' }],
  ['GStreamer smoke', process.execPath, ['project/runtime/gstreamer-smoke.js'], { RUN_GSTREAMER_SMOKE: '1' }],
  ['Ollama evidence', process.execPath, ['project/runtime/ollama-evidence-smoke.js'], { RUN_OLLAMA_SMOKE: '1' }],
  ['readiness bundle', process.execPath, ['project/runtime/generate-readiness-bundle.js']],
];

let failed = 0;
for (const [label, command, args, env] of checks) {
  const result = run(command, args, { cwd: repo, env });
  printResult(label, result);
  if (!result.ok) failed += 1;
}

if (failed) {
  console.error(`${failed} external runtime verification step(s) failed.`);
  process.exit(1);
}

console.log('All external runtime verification steps passed.');

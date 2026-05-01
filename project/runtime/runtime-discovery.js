#!/usr/bin/env node
// RealTimeInsight Phase 0 runtime discovery smoke.
//
// This script is intentionally dependency-free so it can run before the
// production Tauri/Rust/frontend scaffold exists.  It reports every Phase 0
// prerequisite as PASS/FAIL/SKIP data instead of hiding missing external
// runtimes behind mocks.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const DEFAULT_TIMEOUT_MS = 30_000;
const KNOWN_WINDOWS_MATLAB = [
  '/mnt/c/Program Files/MATLAB/R2026a/bin/matlab.exe',
  '/mnt/c/Program Files/MATLAB/R2025b/bin/matlab.exe',
  '/mnt/c/Program Files/MATLAB/R2025a/bin/matlab.exe',
  '/mnt/c/Program Files/MATLAB/R2024b/bin/matlab.exe',
  '/mnt/c/Program Files/MATLAB/R2024a/bin/matlab.exe',
];

function run(command, args = [], options = {}) {
  const startedAt = Date.now();
  const needsShell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
  const actualCommand = needsShell ? 'cmd.exe' : command;
  const actualArgs = needsShell ? ['/d', '/c', quoteWindowsCommand(command, args)] : args;
  const result = spawnSync(actualCommand, actualArgs, {
    encoding: 'utf8',
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    windowsHide: true,
    shell: options.shell ?? false,
    env: { ...process.env, ...(options.env ?? {}) },
  });
  return {
    command: [command, ...args].join(' '),
    ok: !result.error && result.status === 0,
    status: result.status,
    signal: result.signal,
    error: result.error ? result.error.message : null,
    timedOut: result.error && result.error.code === 'ETIMEDOUT',
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    durationMs: Date.now() - startedAt,
  };
}

function quoteWindowsCommand(command, args) {
  const quote = (value) => {
    const text = String(value).replace(/"/g, '\\"');
    return /\s/.test(text) ? `"${text}"` : text;
  };
  return [quote(command), ...args.map(quote)].join(' ');
}

function firstLine(text) {
  return (text || '').split(/\r?\n/).find(Boolean) || '';
}

function which(command) {
  if (process.platform === 'win32') {
    const probe = run('where.exe', [command], { timeoutMs: 5_000 });
    if (!probe.ok) return null;
    const candidates = probe.stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    const candidate = candidates.find((candidate) => /\.(cmd|exe|bat)$/i.test(candidate)) || candidates[0] || null;
    if (candidate && /\.(cmd|bat)$/i.test(candidate) && /\s/.test(candidate)) {
      return path.basename(candidate);
    }
    return candidate;
  }
  const probe = run('bash', ['-lc', `command -v ${JSON.stringify(command)}`], { timeoutMs: 5_000 });
  return probe.ok ? firstLine(probe.stdout) : null;
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function candidatePath(commands, extraPaths = []) {
  for (const command of commands) {
    const found = which(command);
    if (found) return found;
  }
  for (const candidate of extraPaths) {
    if (fileExists(candidate)) return candidate;
  }
  return null;
}

function pass(name, detail) {
  return { ...detail, name, status: 'PASS', ready: true };
}

function fail(name, reason, detail = {}) {
  return { ...detail, name, status: 'FAIL', ready: false, reason };
}

function skip(name, reason, detail = {}) {
  return { ...detail, name, status: 'SKIP', ready: false, reason };
}

function detectCommandVersion(name, commands, versionArgs = ['--version'], extraPaths = []) {
  const executable = candidatePath(commands, extraPaths);
  if (!executable) return fail(name, `${commands.join('/')} not found on PATH`, { commands });
  const version = run(executable, versionArgs, { timeoutMs: 10_000 });
  if (!version.ok) {
    return fail(name, `${name} executable found but version command failed`, {
      executable,
      command: version.command,
      exitStatus: version.status,
      stderr: version.stderr,
      stdout: version.stdout,
      error: version.error,
    });
  }
  return pass(name, {
    executable,
    version: firstLine(version.stdout || version.stderr),
    command: version.command,
  });
}

function detectNode() {
  const node = detectCommandVersion('node', ['node'], ['--version']);
  const npm = detectCommandVersion('npm', ['npm'], ['--version']);
  const ready = node.ready && npm.ready;
  return {
    name: 'node-npm',
    status: ready ? 'PASS' : 'FAIL',
    ready,
    node,
    npm,
    reason: ready ? undefined : 'Node.js and npm are both required for frontend/runtime smoke tests',
  };
}

function detectRust() {
  const rustc = detectCommandVersion('rustc', ['rustc'], ['--version']);
  const cargo = detectCommandVersion('cargo', ['cargo'], ['--version']);
  const ready = rustc.ready && cargo.ready;
  return {
    name: 'rust-cargo',
    status: ready ? 'PASS' : 'FAIL',
    ready,
    rustc,
    cargo,
    reason: ready ? undefined : 'rustc and cargo are required before Tauri/Rust core work',
  };
}

function detectTauri() {
  const localTauri = path.join(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'tauri.cmd' : 'tauri');
  const direct = candidatePath(['tauri'], [localTauri]);
  if (direct) {
    const version = run(direct, ['--version'], { timeoutMs: 10_000 });
    return version.ok
      ? pass('tauri-cli', { executable: direct, version: firstLine(version.stdout || version.stderr), command: version.command })
      : fail('tauri-cli', 'tauri executable exists but version command failed', { executable: direct, command: version.command, stderr: version.stderr, stdout: version.stdout });
  }

  const cargo = which('cargo');
  if (!cargo) return fail('tauri-cli', 'tauri CLI not found and cargo is unavailable for cargo-tauri probing');

  const cargoTauri = run(cargo, ['tauri', '--version'], { timeoutMs: 10_000 });
  if (!cargoTauri.ok) {
    return fail('tauri-cli', 'tauri CLI not installed for direct or cargo invocation', {
      command: cargoTauri.command,
      exitStatus: cargoTauri.status,
      stderr: cargoTauri.stderr,
      stdout: cargoTauri.stdout,
    });
  }
  return pass('tauri-cli', { executable: cargo, version: firstLine(cargoTauri.stdout || cargoTauri.stderr), command: cargoTauri.command });
}

function parseNvidiaSmi(text) {
  const name = /Product Name\s*:\s*(.+)/i.exec(text)?.[1]?.trim()
    || /\|\s+\d+\s+([^|]+?)\s+(?:On|Off)\s+\|/.exec(text)?.[1]?.trim();
  const driver = /Driver Version\s*:\s*([^\r\n]+)/i.exec(text)?.[1]?.trim()
    || /Driver Version:\s*([^\s|]+)/.exec(text)?.[1]?.trim();
  const cuda = /CUDA Version:\s*([^\s|]+)/.exec(text)?.[1]?.trim()
    || /CUDA Version\s*:\s*([^\r\n]+)/i.exec(text)?.[1]?.trim();
  const memoryMatch = /FB Memory Usage[\s\S]*?Total\s*:\s*([0-9]+)\s*MiB/i.exec(text)
    || /([0-9]+)MiB\s*\/\s*([0-9]+)MiB/.exec(text);
  const memoryMiB = memoryMatch ? Number(memoryMatch[1] || memoryMatch[2]) : null;
  return { name, driver, cuda, memoryMiB };
}

function parseMatlabVersion(text) {
  const line = (text || '')
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => /\d+\.\d+/.test(value) || /\(R20\d{2}[ab]\)/.test(value));
  return line || firstLine(text);
}

function detectNvidia() {
  const executable = candidatePath(['nvidia-smi', 'nvidia-smi.exe'], [
    '/usr/lib/wsl/lib/nvidia-smi',
    '/mnt/c/Windows/System32/nvidia-smi.exe',
  ]);
  if (!executable) return fail('nvidia-gpu', 'nvidia-smi not found on PATH or known WSL/Windows locations');
  const smi = run(executable, ['-q'], { timeoutMs: 15_000 });
  if (!smi.ok) {
    return fail('nvidia-gpu', 'nvidia-smi query failed', {
      executable,
      command: smi.command,
      exitStatus: smi.status,
      stderr: smi.stderr,
      stdout: firstLine(smi.stdout),
      error: smi.error,
    });
  }
  return pass('nvidia-gpu', { executable, command: smi.command, ...parseNvidiaSmi(smi.stdout) });
}

function detectCudaToolkit() {
  const detected = detectCommandVersion('cuda-toolkit-nvcc', ['nvcc'], ['--version']);
  if (detected.ready) return detected;
  return skip('cuda-toolkit-nvcc', 'nvcc not found; CUDA kernels are optional until a CUDA-specific acceleration lane is selected. Use wgpu/WebGPU first.', {
    commands: ['nvcc'],
  });
}

function detectMatlab() {
  const executable = candidatePath(['matlab', 'matlab.exe'], KNOWN_WINDOWS_MATLAB);
  if (!executable) return fail('matlab', 'MATLAB executable not found on PATH or known Windows install locations');
  const smoke = run(executable, ['-batch', 'disp(version); exit'], { timeoutMs: DEFAULT_TIMEOUT_MS });
  if (!smoke.ok) {
    return fail('matlab', 'MATLAB startup smoke failed', {
      executable,
      command: smoke.command,
      exitStatus: smoke.status,
      signal: smoke.signal,
      timedOut: smoke.timedOut,
      stdout: smoke.stdout,
      stderr: smoke.stderr,
      error: smoke.error,
      durationMs: smoke.durationMs,
    });
  }
  return pass('matlab', {
    executable,
    command: smoke.command,
    version: parseMatlabVersion(smoke.stdout),
    durationMs: smoke.durationMs,
  });
}

function detectMatlabMcp() {
  return detectCommandVersion('matlab-mcp-core-server', ['matlab-mcp-core-server'], ['--help']);
}

function detectOllama() {
  const executable = candidatePath(['ollama']);
  if (!executable) return fail('ollama', 'ollama not found on PATH');
  const version = run(executable, ['--version'], { timeoutMs: 10_000 });
  const list = run(executable, ['list'], { timeoutMs: 10_000 });
  const hasGemma = /\bgemma4:31b\b/.test(list.stdout);
  return {
    name: 'ollama-gemma4-31b',
    status: version.ok && list.ok && hasGemma ? 'PASS' : 'FAIL',
    ready: version.ok && list.ok && hasGemma,
    executable,
    version: firstLine(version.stdout || version.stderr),
    versionCommand: version.command,
    listCommand: list.command,
    models: list.stdout,
    reason: hasGemma ? undefined : 'ollama is required with model gemma4:31b pulled for the full local LLM profile',
    versionError: version.ok ? undefined : { exitStatus: version.status, stderr: version.stderr, stdout: version.stdout, error: version.error },
    listError: list.ok ? undefined : { exitStatus: list.status, stderr: list.stderr, stdout: list.stdout, error: list.error },
  };
}

function detectGstreamer() {
  const launch = detectCommandVersion('gstreamer-gst-launch', ['gst-launch-1.0'], ['--version']);
  const inspect = detectCommandVersion('gstreamer-gst-inspect', ['gst-inspect-1.0'], ['--version']);
  const ready = launch.ready && inspect.ready;
  if (!ready) {
    return fail('gstreamer', 'gst-launch-1.0 and gst-inspect-1.0 are required for MPEG-TS/H.264 video runtime', {
      launch,
      inspect,
    });
  }
  const tsdemux = run(inspect.executable, ['tsdemux'], { timeoutMs: 10_000 });
  const appsink = run(inspect.executable, ['appsink'], { timeoutMs: 10_000 });
  const pluginsReady = tsdemux.ok && appsink.ok;
  return {
    name: 'gstreamer',
    status: pluginsReady ? 'PASS' : 'FAIL',
    ready: pluginsReady,
    launch,
    inspect,
    requiredPlugins: {
      tsdemux: tsdemux.ok,
      appsink: appsink.ok,
    },
    reason: pluginsReady ? undefined : 'GStreamer is installed but required tsdemux/appsink plugins are missing',
  };
}

function detectSimdis() {
  const defaultSdk = path.join(process.cwd(), 'project', 'vendor', 'simdissdk');
  const configured = [process.env.SIMDIS_PATH, process.env.SIMDIS_SDK_PATH, process.env.SIMDIS_PROFILE, defaultSdk]
    .filter(Boolean)
    .map((value) => path.resolve(value));
  const existingConfigured = configured.filter(fileExists);
  const executable = candidatePath(['simdis', 'simdis.exe', 'Simdis', 'Simdis.exe']);
  if (executable || existingConfigured.length) {
    return pass('simdis', {
      executable,
      configuredPaths: configured,
      existingConfiguredPaths: existingConfigured,
    });
  }
  return fail('simdis', 'No SimDIS executable, SDK path, or profile found; set SIMDIS_PATH, SIMDIS_SDK_PATH, or SIMDIS_PROFILE', {
    configuredPaths: configured,
  });
}

function classifyHardware(results) {
  const gpu = results.find((r) => r.name === 'nvidia-gpu');
  const memoryMiB = gpu && gpu.ready ? gpu.memoryMiB : 0;
  const ollama = results.find((r) => r.name === 'ollama-gemma4-31b');
  if (!gpu || !gpu.ready) return 'CPU/degraded';
  if (memoryMiB >= 80 * 1024 && ollama?.ready) return 'DGX/full';
  if (memoryMiB >= 16 * 1024) return 'minimum workstation';
  return 'developer laptop';
}

function discoverRuntime() {
  const checks = [
    detectNode(),
    detectRust(),
    detectTauri(),
    detectNvidia(),
    detectCudaToolkit(),
    detectMatlab(),
    detectMatlabMcp(),
    detectOllama(),
    detectGstreamer(),
    detectSimdis(),
  ];
  const requiredForPhase0 = ['node-npm'];
  const requiredBeforeProduction = [
    'rust-cargo',
    'tauri-cli',
    'matlab',
    'matlab-mcp-core-server',
    'ollama-gemma4-31b',
    'simdis',
  ];
  const requiredForFullExternal = [
    ...requiredBeforeProduction,
    'gstreamer',
  ];
  const failed = checks.filter((check) => check.status === 'FAIL').map((check) => check.name);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    host: {
      platform: process.platform,
      release: os.release(),
      arch: os.arch(),
      cwd: process.cwd(),
    },
    hardwareProfile: classifyHardware(checks),
    readiness: {
      phase0SmokeReady: requiredForPhase0.every((name) => checks.find((check) => check.name === name)?.ready),
      productionReady: requiredBeforeProduction.every((name) => checks.find((check) => check.name === name)?.ready),
      fullExternalReady: requiredForFullExternal.every((name) => checks.find((check) => check.name === name)?.ready),
      failed,
      requiredForPhase0,
      requiredBeforeProduction,
      requiredForFullExternal,
    },
    checks,
  };
}

function printMarkdown(report) {
  console.log(`# Runtime Discovery Smoke Report`);
  console.log();
  console.log(`Generated: ${report.generatedAt}`);
  console.log(`Hardware profile: ${report.hardwareProfile}`);
  console.log(`Phase 0 smoke ready: ${report.readiness.phase0SmokeReady ? 'YES' : 'NO'}`);
  console.log(`Production ready: ${report.readiness.productionReady ? 'YES' : 'NO'}`);
  console.log();
  console.log('| Check | Status | Detail |');
  console.log('| --- | --- | --- |');
  for (const check of report.checks) {
    const detail = check.reason || check.version || check.executable || check.command || '';
    console.log(`| ${check.name} | ${check.status} | ${String(detail).replace(/\|/g, '\\|')} |`);
  }
}

function main(argv) {
  const json = argv.includes('--json');
  const strict = argv.includes('--strict');
  const report = discoverRuntime();
  if (json) console.log(JSON.stringify(report, null, 2));
  else printMarkdown(report);
  if (strict && !report.readiness.productionReady) process.exitCode = 1;
}

if (require.main === module) main(process.argv.slice(2));

module.exports = {
  discoverRuntime,
  run,
};

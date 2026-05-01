#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { discoverRuntime } = require('./runtime-discovery.js');

function loadBlockers() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'external-runtime-blockers.json'), 'utf8'));
}

function renderSummary(report, blockers) {
  const strictExitCode = report.readiness.fullExternalReady ? 0 : 1;
  const lines = [
    '# RealTimeInsight Readiness Bundle',
    '',
    `Generated: ${report.generatedAt}`,
    `Host: ${report.host.platform} ${report.host.arch}`,
    `Hardware profile: ${report.hardwareProfile}`,
    `Production ready: ${report.readiness.productionReady ? 'YES' : 'NO'}`,
    `Full external runtime ready: ${report.readiness.fullExternalReady ? 'YES' : 'NO'}`,
    `Strict exit code: ${strictExitCode}`,
    '',
    '## Runtime Checks',
    '',
    '| Check | Status | Detail |',
    '| --- | --- | --- |',
  ];
  for (const check of report.checks) {
    const detail = check.reason || check.version || check.executable || '';
    lines.push(`| ${check.name} | ${check.status} | ${String(detail).replace(/\|/g, '\\|')} |`);
  }
  lines.push('', '## Known External Blockers', '');
  for (const blocker of blockers.blockers) {
    lines.push(`- ${blocker.id} [${blocker.status}]`);
    lines.push(`  - reason: ${blocker.reason}`);
    lines.push(`  - setup: ${blocker.setup}`);
    lines.push(`  - verify: \`${blocker.verify}\``);
  }
  lines.push('', '## Next Command', '', '```bash', 'node project/runtime/runtime-readiness-report.js --strict', '```', '');
  return `${lines.join('\n')}\n`;
}

function main() {
  const outDir = path.resolve(process.cwd(), 'project/runtime/reports/readiness');
  fs.mkdirSync(outDir, { recursive: true });
  const report = discoverRuntime();
  const blockers = loadBlockers();
  const bundle = {
    schemaVersion: 1,
    generatedAt: report.generatedAt,
    strictCommand: 'node project/runtime/runtime-readiness-report.js --strict',
    strictExitCode: report.readiness.fullExternalReady ? 0 : 1,
    runtime: report,
    blockers,
  };
  const jsonPath = path.join(outDir, 'latest-readiness.json');
  const summaryPath = path.join(outDir, 'summary.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  fs.writeFileSync(summaryPath, renderSummary(report, blockers), 'utf8');
  console.log('Readiness bundle generated:', { jsonPath, summaryPath });
}

if (require.main === module) main();

module.exports = { renderSummary };

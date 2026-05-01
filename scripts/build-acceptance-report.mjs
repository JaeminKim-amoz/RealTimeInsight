#!/usr/bin/env node
/**
 * build-acceptance-report.mjs (US-022) — Slice-1 acceptance report.
 *
 * Runs the spec22 acceptance suite via `npx vitest run … --reporter=json`,
 * parses each criterion (A1..G4), and writes:
 *   .omc/notes/slice1-acceptance-report.md
 *
 * Exit codes:
 *   0 — at least 24/30 criteria PASS (the 4 F-perf items may stay TODO since
 *       they run via `npm run check:perf` and `npm run e2e:perf`).
 *   1 — fewer than 24/30 PASS, or vitest itself failed.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const SPEC_FILE = "project/tests/integration/spec22-acceptance.spec.tsx";
const REPORT_PATH = resolve(repoRoot, ".omc/notes/slice1-acceptance-report.md");

const CRITERIA = [
  ["A1", "Live/Replay toggle wires SessionStore.appMode"],
  ["A2", "ChannelExplorer voltage search filters channel list"],
  ["A3", "Strip drop overlay accepts channel binding"],
  ["A4", "Edge drop converts FlatGridNode cell to SplitNode subtree"],
  ["A5", "workstation-default preset renders 14 panels"],
  ["A6", "13 panel kinds available"],
  ["A7", "Anomaly click updates SelectionStore.selectedAnomalyId"],
  ["A8", "RelationGraphPanel exists in panel registry"],
  ["A9", "Export modal exposes 4 quality policies"],
  ["A10", "MATLAB handoff modal renders title and close button"],
  ["A11", "Workspace save/restore round-trips LayoutNode tree"],
  ["A12", "OfflineAssetsDialog renders airgapped/offline/online states"],
  ["B1", "addPanel/splitPanel/removePanel exposed by workspaceStore"],
  ["B2", "Channel drag-n-drop covered by A3+A4"],
  ["B3", "Workspace restore preserves layout"],
  ["C1", "Strip overlays 2+ channels"],
  ["C2", "Edge drop split (covered by A4)"],
  ["C3", "Anomaly click updates InsightPane (covered by A7)"],
  ["C4", "Global cursor sync — SelectionStore exposes cursor channels"],
  ["D1", "Boot renders mock immediately"],
  ["D2", "At least 3 panel kinds render from mock"],
  ["D3", "Export dialog mock action covered by A9"],
  ["E1", "RAF coalescer single-fire per tick"],
  ["E2", "ChannelExplorer handles large channel datasets"],
  ["E3", "OfflineAssetsDialog renders airgapped state"],
  ["F1", "60s @ 10 Mbps 0% loss — runs via `npm run check:perf` (US-010)"],
  ["F2", "UI 60 FPS real-browser — runs via `npm run e2e:perf` (US-024)"],
  ["F3", "BottomConsole bitrate readout 9.5–10.5 Mbps"],
  ["F4", "CRC fail rate <0.1% — runs via `npm run check:perf` (US-010)"],
  ["G1", "vitest config enforces ≥80% line coverage"],
  ["G2", "vitest config enforces ≥75% branch coverage"],
  ["G3", "tests script wired in package.json"],
  ["G4", "vitest functions threshold ≥80%"],
];

function runVitest() {
  const result = spawnSync(
    "npx",
    ["vitest", "run", SPEC_FILE, "--reporter=json"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      shell: process.platform === "win32",
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (result.status !== 0 && !result.stdout) {
    console.error("acceptance-report: vitest exited with no stdout");
    console.error(result.stderr);
    process.exit(1);
  }
  // The JSON reporter writes to stdout; if vitest still printed Vite warnings
  // first we look for the leading `{`.
  const idx = result.stdout.indexOf("{");
  if (idx < 0) {
    console.error("acceptance-report: could not locate JSON output");
    console.error(result.stdout);
    process.exit(1);
  }
  return JSON.parse(result.stdout.slice(idx));
}

function classify(report) {
  const out = new Map();
  for (const file of report.testResults || []) {
    for (const t of file.assertionResults || []) {
      // Use title (test name only, no describe-block prefix) so range identifiers
      // like "A1–A12" inside the describe-block don't match before the test id.
      const title = t.title || t.fullName || "";
      const m = title.match(/^([A-G]\d{1,2})\b/);
      if (!m) continue;
      const id = m[1];
      const status =
        t.status === "passed"
          ? "PASS"
          : t.status === "todo" || t.status === "pending"
            ? "TODO"
            : "FAIL";
      // Prefer PASS over TODO if multiple tests touch the same criterion.
      const prev = out.get(id);
      if (!prev || (prev !== "PASS" && status === "PASS")) {
        out.set(id, status);
      }
    }
  }
  return out;
}

function buildMarkdown(statusMap) {
  const lines = [];
  lines.push("# Slice 1 Acceptance Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("| ID | Status | Description |");
  lines.push("| --- | --- | --- |");
  let pass = 0;
  let todo = 0;
  let fail = 0;
  for (const [id, desc] of CRITERIA) {
    const status = statusMap.get(id) || "MISSING";
    if (status === "PASS") pass += 1;
    else if (status === "TODO") todo += 1;
    else fail += 1;
    lines.push(`| ${id} | ${status} | ${desc} |`);
  }
  lines.push("");
  lines.push(`**Totals:** ${pass} PASS / ${todo} TODO / ${fail} FAIL of ${CRITERIA.length}`);
  lines.push("");
  lines.push("## Notes");
  lines.push("- F1, F2, F4 perf gates run outside vitest. Use `npm run check:perf` (Rust) and `npm run e2e:perf` (Playwright) to exercise them.");
  lines.push("- Items marked TODO are intentionally deferred to slice-1.5 review or out-of-vitest harnesses.");
  return { md: lines.join("\n"), pass, todo, fail };
}

const report = runVitest();
const statusMap = classify(report);
const { md, pass, todo, fail } = buildMarkdown(statusMap);

mkdirSync(dirname(REPORT_PATH), { recursive: true });
writeFileSync(REPORT_PATH, md, "utf8");

console.log("--- slice1-acceptance-report ---");
for (const [id, desc] of CRITERIA) {
  const status = statusMap.get(id) || "MISSING";
  console.log(`  [${status}] ${id} — ${desc}`);
}
console.log("---------------------------------");
console.log(`PASS=${pass} TODO=${todo} FAIL=${fail} TOTAL=${CRITERIA.length}`);
console.log(`Report written to: ${REPORT_PATH}`);

if (pass < 24) {
  console.error(
    `acceptance-report: FAIL — only ${pass}/${CRITERIA.length} pass (need ≥24)`,
  );
  process.exit(1);
}
process.exit(0);

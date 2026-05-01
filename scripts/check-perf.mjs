#!/usr/bin/env node
/**
 * check-perf.mjs — Slice-1 strict performance gate runner.
 *
 * Spawns `cargo test` with RUN_PERF_SMOKE=1 for both slice1_strict_* tests,
 * parses stdout for pass/fail results, prints a 1-line summary per test,
 * and exits 0 if both pass or 1 if either fails.
 *
 * Usage:
 *   node scripts/check-perf.mjs
 *   npm run check:perf
 *
 * Without RUN_PERF_SMOKE=1 the individual tests early-return (skipped),
 * which cargo reports as "ok" — but this script requires the env var to be
 * set so the tests actually execute rather than skip.  If it is absent the
 * script exits 1 with a clear message.
 */

import { spawn } from "node:child_process";

const MANIFEST = "project/crates/rti_core/Cargo.toml";
const EXPECTED_TESTS = [
  "slice1_strict_10mbps_60s_zero_loss",
  "slice1_strict_crc_fail_rate_under_one_per_thousand",
];

if (!process.env.RUN_PERF_SMOKE) {
  console.error(
    "check-perf: RUN_PERF_SMOKE is not set.\n" +
    "  Set RUN_PERF_SMOKE=1 to run the 60-second performance gate.\n" +
    "  Example: RUN_PERF_SMOKE=1 npm run check:perf"
  );
  process.exit(1);
}

const args = [
  "test",
  "--manifest-path", MANIFEST,
  "--test", "datagram_throughput_smoke",
  "--test", "pcm_throughput_smoke",
  "--release",
  "--",
  "--ignored",
  "--nocapture",
];

console.log(`check-perf: running cargo ${args.join(" ")}`);
console.log(`check-perf: RUN_PERF_SMOKE=${process.env.RUN_PERF_SMOKE}`);
if (process.env.PERF_DURATION_SECS) {
  console.log(`check-perf: PERF_DURATION_SECS=${process.env.PERF_DURATION_SECS}`);
}

const results = new Map(EXPECTED_TESTS.map((name) => [name, null]));

const child = spawn("cargo", args, {
  env: { ...process.env, RUN_PERF_SMOKE: "1" },
  stdio: ["ignore", "pipe", "pipe"],
  shell: false,
});

// Parse both stdout and stderr — cargo writes test output to stdout but
// compilation diagnostics to stderr.  We scan both for test result lines.
function parseLine(line) {
  // Cargo test result line format: "test <name> ... ok" or "test <name> ... FAILED"
  for (const name of EXPECTED_TESTS) {
    if (line.includes(name)) {
      if (/\.\.\. ok/.test(line)) {
        results.set(name, "PASS");
      } else if (/\.\.\. FAILED/.test(line) || /\.\.\. ignored/.test(line)) {
        results.set(name, line.includes("FAILED") ? "FAIL" : "SKIP");
      }
    }
  }
  process.stdout.write(line + "\n");
}

let stdoutBuf = "";
child.stdout.on("data", (chunk) => {
  stdoutBuf += chunk.toString();
  const lines = stdoutBuf.split("\n");
  stdoutBuf = lines.pop(); // keep incomplete last line
  for (const line of lines) parseLine(line);
});

let stderrBuf = "";
child.stderr.on("data", (chunk) => {
  stderrBuf += chunk.toString();
  const lines = stderrBuf.split("\n");
  stderrBuf = lines.pop();
  for (const line of lines) process.stderr.write(line + "\n");
});

child.on("close", (code) => {
  // Flush remaining partial lines
  if (stdoutBuf) parseLine(stdoutBuf);
  if (stderrBuf) process.stderr.write(stderrBuf + "\n");

  console.log("\n--- check-perf summary ---");
  let allPassed = true;
  for (const name of EXPECTED_TESTS) {
    const status = results.get(name) ?? "NOT_RUN";
    const icon = status === "PASS" ? "PASS" : "FAIL";
    console.log(`  [${icon}] ${name}: ${status}`);
    if (status !== "PASS") allPassed = false;
  }
  console.log("--------------------------");

  if (allPassed) {
    console.log("check-perf: all slice-1 gates PASSED");
    process.exit(0);
  } else {
    console.error("check-perf: one or more slice-1 gates FAILED");
    process.exit(1);
  }
});

child.on("error", (err) => {
  console.error(`check-perf: failed to spawn cargo: ${err.message}`);
  process.exit(1);
});

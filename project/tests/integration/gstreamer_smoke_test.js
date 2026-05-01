const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const repo = path.resolve(__dirname, '..', '..', '..');
const scriptPath = path.join(repo, 'project/runtime/gstreamer-smoke.js');
const source = fs.readFileSync(scriptPath, 'utf8');

assert.ok(source.includes('RUN_GSTREAMER_SMOKE'), 'GStreamer smoke is opt-in');
assert.ok(source.includes('gst-launch-1.0'), 'GStreamer smoke checks gst-launch');
assert.ok(source.includes('gst-inspect-1.0'), 'GStreamer smoke checks gst-inspect');
assert.ok(source.includes('tsdemux'), 'GStreamer smoke checks tsdemux plugin');
assert.ok(source.includes('appsink'), 'GStreamer smoke checks appsink plugin');

const output = execFileSync(process.execPath, [scriptPath], {
  cwd: repo,
  encoding: 'utf8',
});
assert.ok(output.includes('GStreamer smoke skipped'), 'GStreamer smoke skips by default');

console.log('GStreamer smoke script test passed');

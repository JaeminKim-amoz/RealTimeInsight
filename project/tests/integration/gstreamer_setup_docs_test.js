const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repo = path.resolve(__dirname, '..', '..', '..');
const doc = fs.readFileSync(path.join(repo, 'project/runtime/setup-gstreamer.md'), 'utf8');

for (const expected of [
  'Linux / WSL Ubuntu',
  'Windows',
  'gstreamer1.0-tools',
  'gstreamer1.0-plugins-good',
  'gstreamer1.0-plugins-bad',
  'gstreamer1.0-libav',
  'gst-launch-1.0 --version',
  'gst-inspect-1.0 tsdemux',
  'gst-inspect-1.0 appsink',
  'RUN_GSTREAMER_SMOKE=1 node project/runtime/gstreamer-smoke.js',
  'msvc_x86_64',
  'remote URLs and shell launchers are rejected',
]) {
  assert.ok(doc.includes(expected), `GStreamer setup documents ${expected}`);
}

console.log('GStreamer setup docs test passed');

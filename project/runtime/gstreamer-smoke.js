const { spawnSync } = require('child_process');

function run(command, args) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 15000,
    shell: false,
  });
}

function assertOk(result, label) {
  if (result.status !== 0) {
    throw new Error(`${label} failed: ${(result.stderr || result.stdout || result.error || '').toString()}`);
  }
  return (result.stdout || result.stderr || '').trim();
}

if (process.env.RUN_GSTREAMER_SMOKE !== '1') {
  console.log('GStreamer smoke skipped; set RUN_GSTREAMER_SMOKE=1 to run.');
  process.exit(0);
}

const launchVersion = assertOk(run('gst-launch-1.0', ['--version']), 'gst-launch-1.0 --version');
const inspectVersion = assertOk(run('gst-inspect-1.0', ['--version']), 'gst-inspect-1.0 --version');
assertOk(run('gst-inspect-1.0', ['tsdemux']), 'gst-inspect-1.0 tsdemux');
assertOk(run('gst-inspect-1.0', ['appsink']), 'gst-inspect-1.0 appsink');

console.log('GStreamer smoke passed:', {
  launchVersion: launchVersion.split(/\r?\n/)[0],
  inspectVersion: inspectVersion.split(/\r?\n/)[0],
});

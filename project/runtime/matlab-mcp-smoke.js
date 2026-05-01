const { execFileSync } = require('child_process');

function run() {
  if (process.env.RUN_MATLAB_MCP_SMOKE !== '1') {
    console.log('MATLAB MCP smoke skipped; set RUN_MATLAB_MCP_SMOKE=1 to run.');
    return;
  }

  const executable = process.env.MATLAB_MCP_SERVER || 'matlab-mcp-core-server';
  const version = execFileSync(executable, ['--version'], {
    encoding: 'utf8',
    timeout: 15000,
  }).trim();
  const help = execFileSync(executable, ['--help'], {
    encoding: 'utf8',
    timeout: 15000,
  });

  if (!/matlab-mcp-core-server|v?\d+\.\d+\.\d+/i.test(version)) {
    throw new Error(`unexpected MATLAB MCP version output: ${version}`);
  }
  for (const required of [
    '--initial-working-folder',
    '--matlab-display-mode',
    '--initialize-matlab-on-startup',
  ]) {
    if (!help.includes(required)) {
      throw new Error(`MATLAB MCP help missing ${required}`);
    }
  }

  console.log('MATLAB MCP smoke passed:', { executable, version });
}

run();

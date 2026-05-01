# Ralph Completion Gate

Date: 2026-04-22

Ralph may continue looping while OMX sees `active: true`. This gate defines when
the local implementation is complete enough to stop local code work and wait for
external runtime installation or target-hardware certification.

## Local Completion Criteria

All must pass:

```bash
node project/runtime/verify-local.js
npm test
npm run build
node node_modules/typescript/bin/tsc --noEmit --pretty false
```

The readiness bundle must exist:

```bash
node project/runtime/generate-readiness-bundle.js
test -f project/runtime/reports/readiness/latest-readiness.json
test -f project/runtime/reports/readiness/summary.md
```

## Expected External Blockers

These are allowed to remain after local completion:

- `linux-matlab-for-mcp`
- `gstreamer-runtime`
- `simdis-executable-profile`
- `certification-soak`

They are tracked in:

```text
project/runtime/external-runtime-blockers.json
```

## Stop Condition

If local completion criteria pass and only the expected external blockers remain,
then local code work is complete for this iteration. Continue only after one of
these changes:

- Linux MATLAB is installed or MCP is run in a Windows-compatible mode.
- GStreamer runtime/plugins are installed.
- SimDIS executable/profile is configured.
- Target Linux/Windows hardware is ready for certification soak.

## Non-Stop Condition

Do not stop if any local verification command fails, if the readiness bundle is
missing, or if a blocker appears that is not listed in
`external-runtime-blockers.json`.

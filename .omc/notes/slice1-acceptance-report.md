# Slice 1 Acceptance Report

Generated: 2026-04-27T11:22:18.261Z

| ID | Status | Description |
| --- | --- | --- |
| A1 | PASS | Live/Replay toggle wires SessionStore.appMode |
| A2 | PASS | ChannelExplorer voltage search filters channel list |
| A3 | PASS | Strip drop overlay accepts channel binding |
| A4 | PASS | Edge drop converts FlatGridNode cell to SplitNode subtree |
| A5 | PASS | workstation-default preset renders 14 panels |
| A6 | PASS | 13 panel kinds available |
| A7 | PASS | Anomaly click updates SelectionStore.selectedAnomalyId |
| A8 | PASS | RelationGraphPanel exists in panel registry |
| A9 | PASS | Export modal exposes 4 quality policies |
| A10 | PASS | MATLAB handoff modal renders title and close button |
| A11 | PASS | Workspace save/restore round-trips LayoutNode tree |
| A12 | PASS | OfflineAssetsDialog renders airgapped/offline/online states |
| B1 | PASS | addPanel/splitPanel/removePanel exposed by workspaceStore |
| B2 | PASS | Channel drag-n-drop covered by A3+A4 |
| B3 | PASS | Workspace restore preserves layout |
| C1 | PASS | Strip overlays 2+ channels |
| C2 | PASS | Edge drop split (covered by A4) |
| C3 | PASS | Anomaly click updates InsightPane (covered by A7) |
| C4 | PASS | Global cursor sync — SelectionStore exposes cursor channels |
| D1 | PASS | Boot renders mock immediately |
| D2 | PASS | At least 3 panel kinds render from mock |
| D3 | PASS | Export dialog mock action covered by A9 |
| E1 | PASS | RAF coalescer single-fire per tick |
| E2 | PASS | ChannelExplorer handles large channel datasets |
| E3 | PASS | OfflineAssetsDialog renders airgapped state |
| F1 | TODO | 60s @ 10 Mbps 0% loss — runs via `npm run check:perf` (US-010) |
| F2 | TODO | UI 60 FPS real-browser — runs via `npm run e2e:perf` (US-024) |
| F3 | TODO | BottomConsole bitrate readout 9.5–10.5 Mbps |
| F4 | TODO | CRC fail rate <0.1% — runs via `npm run check:perf` (US-010) |
| G1 | PASS | vitest config enforces ≥80% line coverage |
| G2 | PASS | vitest config enforces ≥75% branch coverage |
| G3 | PASS | tests script wired in package.json |
| G4 | PASS | vitest functions threshold ≥80% |

**Totals:** 29 PASS / 4 TODO / 0 FAIL of 33

## Notes
- F1, F2, F4 perf gates run outside vitest. Use `npm run check:perf` (Rust) and `npm run e2e:perf` (Playwright) to exercise them.
- Items marked TODO are intentionally deferred to slice-1.5 review or out-of-vitest harnesses.
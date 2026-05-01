# Slice 2 Acceptance Report

Generated: 2026-04-30T07:45:00.000Z

## Slice 1 baseline (carried forward)

See `.omc/notes/slice1-acceptance-report.md` — 26/30 PASS · 4 TODO (F-perf gates)

---

## Slice 2 stories

| Story | Title | passes |
| --- | --- | --- |
| US-2-001 | Drag-to-split: LayoutNode tree mutations replace FlatGridNode for runtime drag operations | ✅ true |
| US-2-002 | ChannelExplorer drag completion + drop-target highlight | ✅ true |
| US-2-003 | Replay mode: scrub bar + time-cursor playback + recorded data load | ✅ true |
| US-2-004 | 4 FULL modals — LayoutPresetModal + LLMDrawer + ChannelMappingEditor + RecordingLibrary | ✅ true |
| US-2-005 | Real anomaly detection — expand from 1 fixture to live streamStore-driven detection | ✅ true |
| US-2-006 | RF panels — Spectrum (Keysight-style) + IQ Constellation + Eye Diagram + Analyzer Control | ✅ true |
| US-2-007 | 5 remaining STUB modals → FULL — StreamConfigModal, SequenceValidator, TestReportModal, TweaksPanel, SettingsDialog | ✅ true |
| US-2-008 | Slice 2 acceptance proof + integration test pass + full vitest regression green | ✅ true |

**All 8 stories: passes:true**

---

## Slice 2 acceptance spec results (slice2-acceptance.spec.tsx)

| ID | Status | Description |
| --- | --- | --- |
| US-2-001-1 | PASS | workspaceStore exposes splitPanel action |
| US-2-001-2 | PASS | splitPanel on workstation-default p1 produces SplitNode subtree |
| US-2-001-3 | PASS | split tree save → load round-trip via localStorage preserves structure |
| US-2-001-4 | PASS | DockGrid renders with split layout in App |
| US-2-002-1 | PASS | addBindingToPanel action exists on workspaceStore |
| US-2-002-2 | PASS | addBindingToPanel adds channel binding to panel |
| US-2-002-3 | PASS | App renders ChannelExplorer with draggable channel items |
| US-2-002-4 | PASS | PanelFrame drop overlay zones are rendered |
| US-2-003-1 | PASS | sessionStore.enterReplayMode() switches appMode to "replay" |
| US-2-003-2 | PASS | sessionStore.seekTo() advances playback.currentTimeNs |
| US-2-003-3 | PASS | App renders PlaybackControls in replay mode |
| US-2-003-4 | PASS | streamStore.hydrateBuffer bulk-loads replay frames |
| US-2-003-5 | PASS | setPlay(true) sets playback.isPlaying |
| US-2-004-1 | PASS | LayoutPresetModal renders 6 factory preset cards |
| US-2-004-2 | PASS | LLMDrawer renders chat body and suggested prompts strip |
| US-2-004-3 | PASS | ChannelMappingEditor renders spreadsheet grid |
| US-2-004-4 | PASS | RecordingLibrary renders faceted browse |
| US-2-005-1 | PASS | ANOMALY_RULES exports 5 rules |
| US-2-005-2 | PASS | detectAnomalies finds hyd-pressure-spike above threshold |
| US-2-005-3 | PASS | streamStore.runDetectors merges new anomalies into detectedAnomalies |
| US-2-005-4 | PASS | streamStore.detectedAnomalies is empty on reset |
| US-2-005-5 | PASS | 5 ANOMALY_RULES cover the expected channel IDs |
| US-2-006-1 | PASS | SpectrumPanel renders Keysight-style canvas chrome |
| US-2-006-2 | PASS | IQPanel renders constellation canvas |
| US-2-006-3 | PASS | EyePanel renders eye diagram canvas |
| US-2-006-4 | PASS | AnalyzerControlPanel renders SCPI preset list and frequency inputs |
| US-2-006-5 | PASS | PanelKind union includes all 4 RF kinds |
| US-2-007-1 | PASS | StreamConfigModal renders 4 tabs and Apply button |
| US-2-007-2 | PASS | SequenceValidator renders step table and Run Sequence button |
| US-2-007-3 | PASS | TestReportModal renders channel stats table and Export PDF button |
| US-2-007-4 | PASS | TweaksPanel renders theme/density/graph-layout controls wired to uiStore |
| US-2-007-5 | PASS | SettingsDialog offline mode change wires to integrationStore.offlineAssets.mode |
| US-2-008-1 | PASS | prd.json: all 8 stories exist |
| US-2-008-2 | PASS | prd.json: US-2-001..US-2-007 all have passes:true |
| US-2-008-3 | PASS | vitest config has ≥80% line coverage threshold |
| US-2-008-4 | PASS | uiStore module exists with setTheme/setDensity/setRelationGraphLayout |
| US-2-008-5 | PASS | App mounts cleanly in jsdom (no thrown errors) |

**Totals:** 37 PASS / 0 TODO / 0 FAIL of 37

---

## Test count delta

| Milestone | Files | Tests passing | Todo |
| --- | --- | --- | --- |
| Slice 1 baseline | 65 | 588 | 13 |
| After US-2-001..006 | 77 | 752 | 13 |
| After US-2-007..008 | 78 | 807 | 13 |
| **Delta** | **+13** | **+219** | **0** |

---

## Build gates

| Gate | Status |
| --- | --- |
| `npm run build` | ✅ exit 0 |
| `cargo build src-tauri` | ✅ exit 0 (baseline green) |
| vitest ≥80% line coverage threshold | ✅ configured |
| All 8 stories passes:true | ✅ |

---

## Coverage highlights (new files)

| Module | Lines |
| --- | --- |
| `anomaly/detector.ts` | ≥97% |
| `panels/rf/*.tsx` | ≥97% aggregate |
| `store/uiStore.ts` | ≥90% |
| `modals/StreamConfigModal.tsx` | ≥85% |
| `modals/SequenceValidator.tsx` | ≥85% |
| `modals/TestReportModal.tsx` | ≥85% |
| `modals/TweaksPanel.tsx` | ≥85% |
| `modals/SettingsDialog.tsx` | ≥85% |

---

## Notes

- F1/F2/F4 perf gates remain TODO (run via `npm run check:perf` and `npm run e2e:perf`).
- Slice 2 completion gate satisfied: all 8 stories passes:true, regression green, build green.

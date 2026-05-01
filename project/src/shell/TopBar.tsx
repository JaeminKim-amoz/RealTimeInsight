/**
 * TopBar (US-012) — application command bar.
 *
 * Visual port of public/app/shell.jsx TopBar with the prototype `topbar` className
 * preserved. Wired to useSessionStore.appMode + setAppMode for the LIVE/REPLAY
 * mode toggle. Sheet tabs are controlled via props (parent owns activeSheet) so
 * the bar can sit above any workspace pane.
 */

import { useSessionStore } from '../store/sessionStore';
import { PlaybackControls } from './PlaybackControls';

export type SheetId = 'workstation' | 'space' | 'ew' | 'gps';

export interface TopBarProps {
  activeSheet: SheetId;
  onSheetChange: (sheet: SheetId) => void;
  /** Tool-strip callbacks — wired by App.tsx (US-021); optional for unit tests. */
  onOpenLibrary?: () => void;
  onOpenLayout?: () => void;
  onOpenExport?: () => void;
  onOpenMatlab?: () => void;
  onOpenLLM?: () => void;
  onOpenTweaks?: () => void;
  onOpenSettings?: () => void;
}

const SHEET_TABS: ReadonlyArray<{ id: SheetId; label: string; sub: string }> = [
  { id: 'workstation', label: '▤ Workstation', sub: '14 panels' },
  { id: 'space', label: '◎ Space', sub: 'Globe · Sat · Threats' },
  { id: 'ew', label: '△ EW Theater', sub: '1247 UAV · Live' },
  { id: 'gps', label: '○ GPS LOS', sub: 'PDOP 1.42 · RTK FIX' },
];

type ToolKey = 'Library' | 'Channels' | 'Layout' | 'Export' | 'MATLAB' | 'LLM' | 'Tweaks';
const TOOL_BUTTONS: readonly ToolKey[] = [
  'Library',
  'Channels',
  'Layout',
  'Export',
  'MATLAB',
  'LLM',
  'Tweaks',
] as const;

const RX_LEDS: ReadonlyArray<{ kind: string; title: string }> = [
  { kind: 'ok', title: 'Stream 1 · Link' },
  { kind: 'ok', title: 'Stream 2 · Sync' },
  { kind: 'warn', title: 'Stream 3 · CRC errors' },
  { kind: 'alarm', title: 'Stream 4 · Drop' },
];

export function TopBar({
  activeSheet,
  onSheetChange,
  onOpenLibrary,
  onOpenLayout,
  onOpenExport,
  onOpenMatlab,
  onOpenLLM,
  onOpenTweaks,
  onOpenSettings,
}: TopBarProps) {
  const appMode = useSessionStore((s) => s.appMode);
  const setAppMode = useSessionStore((s) => s.setAppMode);
  const enterReplayMode = useSessionStore((s) => s.enterReplayMode);
  const exitReplayMode = useSessionStore((s) => s.exitReplayMode);

  const toolHandlers: Record<ToolKey, (() => void) | undefined> = {
    Library: onOpenLibrary,
    Channels: onOpenSettings, // Channels button maps to channel mapping editor (slice 1: settings).
    Layout: onOpenLayout,
    Export: onOpenExport,
    MATLAB: onOpenMatlab,
    LLM: onOpenLLM,
    Tweaks: onOpenTweaks,
  };

  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark" />
        <span>REALTIMEINSIGHT</span>
        <span className="brand-dot" />
      </div>

      <div className="tb-group">
        <span className="tb-label">Project</span>
        <button className="tb-btn" type="button">
          RTI Flight Test Demo ▾
        </button>
      </div>

      <div className="tb-group">
        <span className="tb-label">Mode</span>
        <div className="mode-switch">
          <button
            type="button"
            className={`live ${appMode === 'live' ? 'on' : ''}`.trim()}
            onClick={() => (appMode === 'replay' ? exitReplayMode() : setAppMode('live'))}
          >
            <span className="led" /> LIVE
          </button>
          <button
            type="button"
            className={appMode === 'replay' ? 'on' : ''}
            onClick={() => (appMode === 'live' ? enterReplayMode() : setAppMode('replay'))}
          >
            <span className="led" /> REPLAY
          </button>
        </div>
      </div>

      {appMode === 'live' ? (
        <div className="tb-group">
          <span className="tb-label">RX</span>
          <span className="status-chip rx-status">
            {RX_LEDS.map((led, i) => (
              <span key={i} className={`rx-led rx-led-${led.kind}`} title={led.title} />
            ))}
            <span className="mono rx-bw">3 / 4 streams · 61.2 Mbps</span>
          </span>
        </div>
      ) : (
        <div className="tb-group">
          <PlaybackControls />
        </div>
      )}

      <div className="tb-group sheet-tabs">
        {SHEET_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`sheet-tab ${activeSheet === tab.id ? 'on' : ''}`.trim()}
            onClick={() => onSheetChange(tab.id)}
          >
            <span className="sheet-tab-l">{tab.label}</span>
            <span className="sheet-tab-s mono">{tab.sub}</span>
          </button>
        ))}
      </div>

      <div className="tb-group tool-strip">
        {TOOL_BUTTONS.map((label) => (
          <button
            key={label}
            type="button"
            className="tb-btn"
            onClick={toolHandlers[label]}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

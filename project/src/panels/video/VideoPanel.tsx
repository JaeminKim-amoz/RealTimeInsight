/**
 * VideoPanel (US-017c) — video element placeholder + telemetry overlay.
 *
 * Visual fidelity 1:1 with public/app/panels2.jsx VideoPanel: SVG placeholder
 * inside a `panel-body video` container, telemetry overlay strip showing
 * cursorNs / frameRef / segmentId.
 *
 * Cursor sync per Critic C4: useSelectionStore.globalCursorNs change visibly
 * updates the displayed time-code text.
 */

import { useSelectionStore } from '../../store/selectionStore';
import { useIntegrationStore } from '../../store/integrationStore';
import type { PanelInstance } from '../../types/domain';

interface VideoPanelProps {
  panel: PanelInstance;
  mode: 'live' | 'replay';
}

function formatTimecode(ns: string | null): string {
  if (ns == null) return '—';
  const n = Number(ns);
  if (!Number.isFinite(n)) return '—';
  return (n / 1e9).toFixed(3);
}

export function VideoPanel({ panel, mode }: VideoPanelProps) {
  const globalCursorNs = useSelectionStore((s) => s.globalCursorNs);
  const simdis = useIntegrationStore((s) => s.simdis);
  const frameRef = simdis.scenarioId ?? '0x2A';
  const segmentId = simdis.selectedEntityId ?? 'seg-001';

  void panel;
  void mode;

  const timecode = formatTimecode(globalCursorNs);

  return (
    <div className="panel-body video">
      <div data-testid="video-placeholder" className="video-placeholder">
        <video muted className="video-element" />
        <svg
          width="60%"
          height="60%"
          viewBox="0 0 200 120"
          style={{ opacity: 0.25 }}
        >
          <rect x="20" y="30" width="160" height="70" fill="none" stroke="#2a2a2a" strokeWidth="0.5" />
          <path d="M 50 80 L 80 60 L 110 70 L 140 50 L 170 55" stroke="#3a3a3a" strokeWidth="1" fill="none" />
          <circle cx="140" cy="50" r="2" fill="#4a4a4a" />
        </svg>
      </div>
      <div data-testid="video-overlay" className="video-overlay">
        <span className="ov-label">T+</span>
        <span className="ov-time">{timecode}</span>
        <span className="ov-sep">·</span>
        <span className="ov-label">FRAME</span>
        <span className="ov-frame">{frameRef}</span>
        <span className="ov-sep">·</span>
        <span className="ov-label">SEG</span>
        <span className="ov-seg">{segmentId}</span>
      </div>
    </div>
  );
}

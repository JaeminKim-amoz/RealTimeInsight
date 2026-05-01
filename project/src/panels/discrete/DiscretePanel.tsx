/**
 * DiscretePanel (US-016c) — discrete state timeline rows.
 *
 * Visual fidelity 1:1 with public/app/panels.jsx DiscretePanel: per-row
 * label + state-bar timeline with color-coded segments + current state name.
 *
 * Slice-1 uses deterministic synthesized state segments (the prototype itself
 * uses a fixed sample track). Real discrete-v1 stream wiring lands in slice 2.
 */

import { useMemo } from 'react';
import { CH } from '../../mock/channels';
import type { PanelInstance } from '../../types/domain';

interface DiscretePanelProps {
  panel: PanelInstance;
}

interface DiscreteSegment {
  startPct: number;
  endPct: number;
  state: 'on' | 'off' | 'alarm' | 'a' | 'b';
}

interface DiscreteRowSpec {
  channelId: number;
  name: string;
  segments: DiscreteSegment[];
  currentState: string;
}

const STATE_COLORS: Record<DiscreteSegment['state'], string> = {
  on: 'var(--ok)',
  off: 'var(--fg-3)',
  alarm: 'var(--alarm)',
  a: 'var(--s2)',
  b: 'var(--s5)',
};

/** Deterministic mock track per channelId — mirrors prototype's fixed states. */
function trackForChannel(channelId: number): DiscreteRowSpec | null {
  const ch = CH[channelId];
  if (!ch || ch.channelType !== 'discrete') return null;
  switch (channelId) {
    case 1007: // PDU BIT
      return {
        channelId,
        name: ch.displayName,
        segments: [
          { startPct: 0, endPct: 45, state: 'on' },
          { startPct: 45, endPct: 55, state: 'on' },
          { startPct: 55, endPct: 62, state: 'alarm' },
          { startPct: 62, endPct: 100, state: 'on' },
        ],
        currentState: 'ON',
      };
    case 5004: // Crypto State
      return {
        channelId,
        name: ch.displayName,
        segments: [{ startPct: 0, endPct: 100, state: 'on' }],
        currentState: 'ON',
      };
    case 1210: // Hyd Bypass
      return {
        channelId,
        name: ch.displayName,
        segments: [
          { startPct: 0, endPct: 68, state: 'off' },
          { startPct: 68, endPct: 72, state: 'on' },
          { startPct: 72, endPct: 100, state: 'off' },
        ],
        currentState: 'CLOSED',
      };
    case 5005: // Antenna Select
      return {
        channelId,
        name: ch.displayName,
        segments: [
          { startPct: 0, endPct: 50, state: 'a' },
          { startPct: 50, endPct: 100, state: 'b' },
        ],
        currentState: 'B',
      };
    case 1006: // Inverter Status
      return {
        channelId,
        name: ch.displayName,
        segments: [{ startPct: 0, endPct: 100, state: 'on' }],
        currentState: 'NOM',
      };
    case 1008: // Avionics Power
      return {
        channelId,
        name: ch.displayName,
        segments: [{ startPct: 0, endPct: 100, state: 'on' }],
        currentState: 'ON',
      };
    default:
      return {
        channelId,
        name: ch.displayName,
        segments: [{ startPct: 0, endPct: 100, state: 'on' }],
        currentState: 'NOM',
      };
  }
}

export function DiscretePanel({ panel }: DiscretePanelProps) {
  const rows: DiscreteRowSpec[] = useMemo(() => {
    return panel.bindings
      .filter((b) => b.type === 'channel')
      .map((b) => (b.type === 'channel' ? trackForChannel(b.channelId) : null))
      .filter((r): r is DiscreteRowSpec => r !== null);
  }, [panel.bindings]);

  if (rows.length === 0) {
    return (
      <div className="panel-body discrete-rows empty">
        <div className="discrete-empty">No discrete bindings</div>
      </div>
    );
  }

  return (
    <div className="panel-body discrete-rows">
      {rows.map((row) => {
        const stateLower = row.currentState.toLowerCase();
        const stateCls = stateLower === 'on' || stateLower === 'off' ? stateLower : '';
        return (
          <div key={row.channelId} className="discrete-row">
            <div className="d-name">{row.name}</div>
            <div className="state-bar disc-track">
              {row.segments.map((seg, j) => (
                <div
                  key={j}
                  className="state-seg disc-seg"
                  style={{
                    left: `${seg.startPct}%`,
                    width: `${seg.endPct - seg.startPct}%`,
                    background: STATE_COLORS[seg.state],
                  }}
                />
              ))}
            </div>
            <div className={`cur-state d-state ${stateCls}`.trim()}>
              {row.currentState}
            </div>
          </div>
        );
      })}
    </div>
  );
}

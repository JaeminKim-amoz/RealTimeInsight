/**
 * EventLogPanel (US-016d) — chronological event log with severity filter.
 *
 * Visual fidelity 1:1 with public/app/panels.jsx EventLogPanel: severity badge,
 * code, channel-id badge, message, timestamp. Click HYD.SPIKE row triggers
 * useSelectionStore.selectAnomaly('anom-001') (per prototype intent).
 */

import { useMemo, useState } from 'react';
import { EVENTS } from '../../mock/events';
import { useSelectionStore } from '../../store/selectionStore';
import type { EventDescriptor, EventSeverity } from '../../types/domain';

const SEVERITY_FILTERS: EventSeverity[] = ['high', 'medium', 'low', 'info'];

const SEV_BADGE_CLASS: Record<EventSeverity, string> = {
  high: 'high',
  medium: 'med',
  low: 'low',
  info: 'info',
};

export function EventLogPanel() {
  const selectAnomaly = useSelectionStore((s) => s.selectAnomaly);
  const [activeFilters, setActiveFilters] = useState<Set<EventSeverity>>(
    new Set()
  );

  const visibleEvents = useMemo<EventDescriptor[]>(() => {
    const sorted = [...EVENTS].sort((a, b) => b.timestampSec - a.timestampSec);
    if (activeFilters.size === 0) return sorted;
    return sorted.filter((e) => activeFilters.has(e.severity));
  }, [activeFilters]);

  const toggleFilter = (sev: EventSeverity) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  };

  const onRowClick = (e: EventDescriptor) => {
    if (e.code === 'HYD.SPIKE') {
      selectAnomaly('anom-001');
    }
  };

  return (
    <div className="panel-body event-log">
      <div className="sev-filter">
        {SEVERITY_FILTERS.map((sev) => {
          const active = activeFilters.has(sev);
          return (
            <button
              key={sev}
              type="button"
              data-sev={sev}
              className={`sev-chip ${active ? 'active' : ''}`.trim()}
              onClick={() => toggleFilter(sev)}
            >
              {sev}
            </button>
          );
        })}
      </div>
      <div className="event-list">
        {visibleEvents.map((e) => (
          <div
            key={`${e.timestampSec}-${e.code}`}
            className="event-row"
            role="button"
            tabIndex={0}
            onClick={() => onRowClick(e)}
          >
            <span className="ev-time">{e.timestampSec.toFixed(3)}</span>
            <span className={`ev-sev ${SEV_BADGE_CLASS[e.severity]}`}>
              {SEV_BADGE_CLASS[e.severity]}
            </span>
            <span className="ev-msg">
              <span className="ev-code">{e.code}</span> {e.message}
            </span>
            <span className="ev-ch">
              {e.channelId != null ? `CH${e.channelId}` : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

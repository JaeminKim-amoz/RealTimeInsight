/**
 * RecordingLibrary (US-2-004d) — FULL.
 *
 * Faceted browse: left sidebar with Date / Mission / Aircraft facets, main
 * pane with recording rows. Search box filters by mission name. Click-to-load
 * calls useSessionStore.enterReplayMode() and sets activeRunId.
 */

import { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { useSessionStore } from '../store/sessionStore';
import {
  RECORDING_INDEX,
  RECORDING_MISSIONS,
  RECORDING_AIRCRAFT,
  RECORDING_DATE_RANGES,
} from '../mock/recordingIndex';

interface RecordingLibraryProps {
  isOpen: boolean;
  onClose: () => void;
}

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

export function RecordingLibrary({ isOpen, onClose }: RecordingLibraryProps) {
  const [search, setSearch] = useState('');
  const [missionFilter, setMissionFilter] = useState<string | null>(null);
  const [aircraftFilter, setAircraftFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('all');

  const enterReplay = useSessionStore((s) => s.enterReplayMode);
  const setActiveRun = useSessionStore((s) => s.setActiveRun);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return RECORDING_INDEX.filter((r) => {
      if (missionFilter && r.mission !== missionFilter) return false;
      if (aircraftFilter && r.aircraft !== aircraftFilter) return false;
      if (q && !r.mission.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [search, missionFilter, aircraftFilter]);

  const handleLoad = (id: string) => {
    enterReplay();
    setActiveRun(id);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="recording-library" ariaLabel="Recording Library">
      <div className="modal-hd">
        <span>Recording Library</span>
        <input
          type="text"
          className="mf-input rec-search"
          placeholder="search mission…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          data-testid="rec-search"
        />
        <button type="button" onClick={onClose} className="modal-close" aria-label="Close">
          ×
        </button>
      </div>

      <div className="modal-body rec-body">
        <aside className="rec-sidebar" data-testid="rec-sidebar">
          <div className="rec-facet-group">
            <h3>Date</h3>
            {RECORDING_DATE_RANGES.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`rec-facet ${dateFilter === d.id ? 'on' : ''}`}
                onClick={() => setDateFilter(d.id)}
                data-testid={`rec-facet-date-${d.id}`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="rec-facet-group">
            <h3>Mission</h3>
            <button
              type="button"
              className={`rec-facet ${missionFilter === null ? 'on' : ''}`}
              onClick={() => setMissionFilter(null)}
              data-testid="rec-facet-mission-all"
            >
              All Missions
            </button>
            {RECORDING_MISSIONS.map((m) => (
              <button
                key={m}
                type="button"
                className={`rec-facet ${missionFilter === m ? 'on' : ''}`}
                onClick={() => setMissionFilter(m)}
                data-testid={`rec-facet-mission-${m}`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="rec-facet-group">
            <h3>Aircraft</h3>
            <button
              type="button"
              className={`rec-facet ${aircraftFilter === null ? 'on' : ''}`}
              onClick={() => setAircraftFilter(null)}
              data-testid="rec-facet-aircraft-all"
            >
              All Aircraft
            </button>
            {RECORDING_AIRCRAFT.map((a) => (
              <button
                key={a}
                type="button"
                className={`rec-facet ${aircraftFilter === a ? 'on' : ''}`}
                onClick={() => setAircraftFilter(a)}
                data-testid={`rec-facet-aircraft-${a}`}
              >
                {a}
              </button>
            ))}
          </div>
        </aside>

        <main className="rec-list" data-testid="rec-list">
          {filtered.length === 0 && <div className="rec-empty">No recordings match.</div>}
          {filtered.map((r) => (
            <div key={r.id} className="rec-row" data-testid={`rec-row-${r.id}`}>
              <div className="rec-thumb" data-testid={`rec-thumb-${r.id}`} />
              <div className="rec-meta">
                <div className="rec-row-title">
                  <span className="mono rec-id">{r.id}</span>
                  <span className="rec-mission">{r.mission}</span>
                  <span className="rec-aircraft">{r.aircraft}</span>
                </div>
                <div className="rec-row-stats mono">
                  <span>{r.date}</span>
                  <span>·</span>
                  <span>{fmtDuration(r.durationMin)}</span>
                  <span>·</span>
                  <span>{r.sizeGB.toFixed(1)} GB</span>
                  <span>·</span>
                  <span>{r.channels} ch</span>
                  {r.anomalyCount > 0 && (
                    <>
                      <span>·</span>
                      <span className="rec-anomaly">{r.anomalyCount} anom</span>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="tb-btn primary"
                onClick={() => handleLoad(r.id)}
                data-testid={`rec-load-${r.id}`}
              >
                Load
              </button>
            </div>
          ))}
        </main>
      </div>

      <div className="modal-footer">
        <span className="mono rec-count">{filtered.length} of {RECORDING_INDEX.length} recordings</span>
        <button type="button" className="tb-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

/**
 * CommandPalette (US-020d) — FULL Cmd+K palette.
 *
 * Searchable list of channels (ALL_CHANNELS), commands (~10 hardcoded),
 * recent anomalies. Keyboard navigation: ↑↓ moves, Enter executes, ESC closes.
 * Bound to Cmd+K / Ctrl+K via global useEffect listener.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from './Modal';
import { ALL_CHANNELS } from '../mock/channels';
import { ALL_ANOMALIES } from '../mock/anomalies';

type ResultKind = 'channel' | 'command' | 'anomaly';

interface PaletteResult {
  id: string;
  kind: ResultKind;
  label: string;
  hint?: string;
  channelId?: number;
  anomalyId?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onExecute?: (r: PaletteResult) => void;
}

const COMMANDS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'cmd-export-csv', label: 'Export CSV' },
  { id: 'cmd-open-matlab', label: 'Open MATLAB' },
  { id: 'cmd-toggle-cursor', label: 'Toggle Linked Cursor' },
  { id: 'cmd-save-workspace', label: 'Save Workspace' },
  { id: 'cmd-load-preset', label: 'Load Preset' },
  { id: 'cmd-toggle-insight', label: 'Toggle Insight Pane' },
  { id: 'cmd-jump-anomaly', label: 'Jump to Anomaly' },
  { id: 'cmd-connect-simdis', label: 'Connect SimDIS Bridge' },
  { id: 'cmd-reload-tiles', label: 'Reload Map Tiles' },
  { id: 'cmd-summarize-alarms', label: 'Summarize Last 30s Alarms' },
];

export function CommandPalette({ isOpen, onClose, onExecute }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  const results = useMemo<PaletteResult[]>(() => {
    const q = query.trim().toLowerCase();
    const channelHits: PaletteResult[] = ALL_CHANNELS.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.displayName.toLowerCase().includes(q) ||
        String(c.channelId).includes(q)
    )
      .slice(0, 6)
      .map((c) => ({
        id: `ch-${c.channelId}`,
        kind: 'channel' as const,
        label: c.displayName,
        hint: `CH${c.channelId}`,
        channelId: c.channelId,
      }));
    const cmdHits: PaletteResult[] = COMMANDS.filter(
      (c) => !q || c.label.toLowerCase().includes(q)
    ).map((c) => ({
      id: c.id,
      kind: 'command' as const,
      label: c.label,
    }));
    const anomalyHits: PaletteResult[] = ALL_ANOMALIES.filter(
      (a) => !q || a.label.toLowerCase().includes(q)
    )
      .slice(0, 3)
      .map((a) => ({
        id: a.anomalyId,
        kind: 'anomaly' as const,
        label: a.label,
        hint: a.severity,
        anomalyId: a.anomalyId,
      }));
    return [...channelHits, ...cmdHits, ...anomalyHits];
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSel((s) => Math.min(results.length - 1, s + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSel((s) => Math.max(0, s - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const r = results[sel];
        if (r) {
          onExecute?.(r);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, results, sel, onExecute, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="command-palette" ariaLabel="Command Palette">
      <div className="palette-hd">
        <span className="mono">⌘K</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSel(0);
          }}
          placeholder="Search channels, commands, anomalies…"
          data-testid="palette-input"
        />
      </div>
      <div className="palette-body" data-testid="palette-body">
        {results.map((r, i) => (
          <div
            key={r.id}
            className={`palette-row ${sel === i ? 'on' : ''}`}
            data-testid={`palette-row-${r.id}`}
            data-selected={sel === i ? 'true' : undefined}
            onMouseEnter={() => setSel(i)}
            onClick={() => {
              onExecute?.(r);
              onClose();
            }}
          >
            <span className="palette-icon">
              {r.kind === 'channel' ? '◇' : r.kind === 'anomaly' ? '▲' : '▸'}
            </span>
            <span className="palette-label">{r.label}</span>
            {r.hint ? <span className="palette-kbd mono">{r.hint}</span> : null}
          </div>
        ))}
        {results.length === 0 ? (
          <div className="palette-empty">No results for “{query}”</div>
        ) : null}
      </div>
    </Modal>
  );
}

/**
 * Hook that opens the palette on Cmd+K / Ctrl+K. Caller must wire the
 * returned `isOpen`/setter into <CommandPalette>.
 */
export function useCommandPaletteHotkey(open: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);
}

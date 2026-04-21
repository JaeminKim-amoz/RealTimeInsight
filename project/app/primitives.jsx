// Shared primitives — stores, hooks, drag/drop glue

const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;

// ============ Workspace store ============
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

// ============ Hook: RAF animation frame time ============
function useTicker(running = true) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!running) return;
    let raf;
    const start = performance.now();
    const loop = () => {
      setT((performance.now() - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  return t;
}

// ============ Drag payload singleton ============
const DragState = {
  payload: null,
  listeners: new Set(),
  set(p) { this.payload = p; this.listeners.forEach(f => f(p)); },
  subscribe(f) { this.listeners.add(f); return () => this.listeners.delete(f); },
};

function useDragPayload() {
  const [p, setP] = useState(DragState.payload);
  useEffect(() => DragState.subscribe(setP), []);
  return p;
}

// ============ Format helpers ============
const fmtTime = (s) => {
  const mm = Math.floor(s / 60).toString().padStart(2, '0');
  const ss = (s % 60).toFixed(3).padStart(6, '0');
  return `${mm}:${ss}`;
};
const fmtNum = (v, d=2) => (v === null || v === undefined || isNaN(v)) ? '—' : v.toFixed(d);

// ============ Panel header sub-component ============
function PanelHeader({ panel, onAction, focused }) {
  const bindings = panel.bindings || [];
  return (
    <div className="panel-header">
      <span className="panel-kind">{panel.kind}</span>
      <span className="panel-title">{panel.title}</span>
      <div className="panel-bindings">
        {bindings.slice(0, 4).map((b, i) => {
          if (b.type !== 'channel') return null;
          const ch = CH[b.channelId];
          if (!ch) return null;
          return (
            <span key={i} className="pb" title={ch.display}>
              <span className="swatch" style={{ background: colorFor(ch.id, i) }}/>
              {ch.name}
            </span>
          );
        })}
        {bindings.length > 4 && <span className="pb">+{bindings.length-4}</span>}
      </div>
      <div className="panel-actions">
        <button title="Convert type">⇄</button>
        <button title="Split">⊞</button>
        <button title="Link cursor" className={panel.linked ? 'on':''}>⌖</button>
        <button title="Close" onClick={() => onAction('close')}>×</button>
      </div>
    </div>
  );
}

// ============ Drop overlay (edge/center zones) ============
function DropOverlay({ panel, onDrop, acceptKinds }) {
  const dragging = useDragPayload();
  const [hover, setHover] = useState(null);
  const active = !!dragging;

  if (!active) return null;

  const zones = ['center', 'top', 'bottom', 'left', 'right'];

  return (
    <div className="drop-overlay active">
      {zones.map(z => (
        <div
          key={z}
          className={`drop-zone z-${z} ${hover === z ? 'hover' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setHover(z); }}
          onDragLeave={() => setHover(h => h === z ? null : h)}
          onDrop={(e) => {
            e.preventDefault();
            setHover(null);
            onDrop(z, DragState.payload);
            DragState.set(null);
          }}
        >
          {z === 'center' ? 'overlay' : z === 'top' || z === 'bottom' ? 'split ' + z : 'split ' + z}
        </div>
      ))}
    </div>
  );
}

Object.assign(window, {
  useState, useEffect, useRef, useMemo, useCallback, createContext, useContext,
  AppCtx, useApp, useTicker, DragState, useDragPayload,
  fmtTime, fmtNum, PanelHeader, DropOverlay,
});

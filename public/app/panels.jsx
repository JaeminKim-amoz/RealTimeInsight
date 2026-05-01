// Chart panels — Strip, MultiStrip, Numeric tiles, Waterfall, XY, Discrete

// =========== Strip Chart (overlay time series) ===========
function StripChart({ panel, cursor, mode, onPointClick }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  useBus();                                   // subscribe to live bus ticks
  const [hoverT, setHoverT] = useState(null);
  const N = 600;

  const series = useMemo(() =>
    panel.bindings
      .filter(b => b.type === 'channel')
      .map((b, i) => {
        const ch = CH[b.channelId];
        if (!ch) return null;
        return { ch, color: colorFor(ch.id, i) };
      }).filter(Boolean),
    [panel.bindings]);

  // Snapshot from bus — truly scrolling window (oldest→newest)
  const data = series.map(s => {
    const snap = BUS.snapshot(s.ch.id, N);
    // fallback: if bus has no buffer for this channel, synthesize from gen()
    if (snap.len === 0) {
      const vals = gen(s.ch.id, N, Math.floor(BUS.currentTime * BUS_HZ));
      return { ...s, vals, ts: null, len: N };
    }
    return { ...s, vals: snap.vals, ts: snap.ts, len: snap.len };
  });

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;

    ctx.clearRect(0, 0, W, H);

    // Background grid
    ctx.strokeStyle = 'rgba(120,120,120,0.08)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo((W * i) / 10, 0);
      ctx.lineTo((W * i) / 10, H);
      ctx.stroke();
    }
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (H * i) / 4);
      ctx.lineTo(W, (H * i) / 4);
      ctx.stroke();
    }

    // Each series, normalized to its own y-range
    data.forEach((s, idx) => {
      const vals = s.vals;
      let min = Infinity, max = -Infinity;
      for (const v of vals) { if (v < min) min = v; if (v > max) max = v; }
      const pad = (max - min) * 0.12 || 1;
      min -= pad; max += pad;

      // Resolve color from CSS variable
      const cssVar = s.color.match(/--s\d/);
      const col = cssVar
        ? getComputedStyle(document.documentElement).getPropertyValue(cssVar[0]).trim() || '#e5a24a'
        : s.color;

      ctx.strokeStyle = col;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < N; i++) {
        const x = (i / (N-1)) * W;
        const y = H - ((vals[i] - min) / (max - min)) * H * 0.9 - H * 0.05;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Highlight anomaly marker for channel 1205 — position by timestamp if available
      if (s.ch.id === 1205 && s.ts) {
        const spikeT = 182.340;
        // find index closest to spikeT
        let xi = -1;
        for (let i = 0; i < s.len; i++) {
          if (s.ts[i] >= spikeT) { xi = i; break; }
        }
        if (xi > 0 && xi < s.len) {
          ctx.fillStyle = '#d8634a';
          const x = (xi / (N-1)) * W;
          const y = H - ((vals[xi] - min) / (max - min)) * H * 0.9 - H * 0.05;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI*2);
          ctx.fill();
          ctx.strokeStyle = '#d8634a';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
          ctx.setLineDash([]);
        }
      } else if (s.ch.id === 1205) {
        // legacy fixed-position marker when running from gen()
        ctx.fillStyle = '#d8634a';
        const xi = Math.floor(N * 0.72);
        const x = (xi / (N-1)) * W;
        const y = H - ((vals[xi] - min) / (max - min)) * H * 0.9 - H * 0.05;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#d8634a';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // Linked cursor
    if (cursor != null) {
      const x = cursor * W;
      ctx.strokeStyle = 'rgba(240, 180, 74, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    // Hover crosshair
    if (hoverT != null) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.moveTo(hoverT * W, 0); ctx.lineTo(hoverT * W, H); ctx.stroke();
    }
  });

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    // Detect click near anomaly marker
    const hasHydCh = series.some(s => s.ch.id === 1205);
    if (hasHydCh && Math.abs(x - 0.72) < 0.03) {
      onPointClick?.({ panelId: panel.id, channelId: 1205, t: 0.72, anomalyId: 'anom-001' });
    } else {
      onPointClick?.({ panelId: panel.id, channelId: series[0]?.ch.id, t: x });
    }
  };

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoverT((e.clientX - rect.left) / rect.width);
  };

  // Readouts for legend
  const readouts = data.map(s => {
    const idx = hoverT != null ? Math.floor(hoverT * (N-1)) : N-1;
    return { ch: s.ch, color: s.color, val: s.vals[idx] };
  });

  return (
    <div ref={wrapRef} style={{ position:'relative', width:'100%', height:'100%' }}>
      <div className="legend">
        {readouts.map((r,i) => {
          const cssVar = r.color.match(/--s\d/);
          const col = cssVar ? `var(${cssVar[0]})` : r.color;
          return (
            <div key={i} className="legend-item">
              <span className="swatch" style={{ background: col }}/>
              <span>{r.ch.name}</span>
              <span className="val">{fmtNum(r.val, 2)} {r.ch.unit}</span>
            </div>
          );
        })}
      </div>
      <canvas
        ref={canvasRef}
        className="strip-chart"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverT(null)}
      />
    </div>
  );
}

// =========== Numeric tile panel ===========
function NumericPanel({ panel, mode }) {
  useBus();
  const bindings = panel.bindings.filter(b => b.type === 'channel');

  return (
    <div className="tile-grid">
      {bindings.map((b, i) => {
        const ch = CH[b.channelId];
        if (!ch) return null;
        const snap = BUS.snapshot(ch.id, 30);
        const vals = snap.len > 0
          ? Array.from(snap.vals)
          : gen(ch.id, 30, Math.floor(BUS.currentTime * BUS_HZ));
        const v = vals[vals.length - 1];
        const min = Math.min(...vals), max = Math.max(...vals);
        const avg = vals.reduce((a,c)=>a+c,0) / vals.length;
        const alarm = ch.alarm && Math.abs(v - avg) > (max - min) * 0.35;
        return (
          <div key={b.channelId} className={`tile ${alarm ? 'alarm':''}`}>
            <div className="tile-hd">
              <span className="swatch" style={{ background: `var(${(colorFor(ch.id,i).match(/--s\d/))[0]})` }}/>
              <span>{ch.display}</span>
            </div>
            <div className="tile-val">
              {fmtNum(v, 2)}<span className="unit">{ch.unit}</span>
            </div>
            <div className="tile-meta">
              <span>min {fmtNum(min,1)}</span>
              <span>avg {fmtNum(avg,1)}</span>
              <span>max {fmtNum(max,1)}</span>
            </div>
            <svg className="spark" width="50" height="14">
              <polyline
                points={vals.slice(-20).map((v,i) => {
                  const x = (i / 19) * 50;
                  const y = 12 - ((v - min) / (max - min || 1)) * 10;
                  return `${x},${y}`;
                }).join(' ')}
                fill="none"
                stroke={`var(${(colorFor(ch.id,i).match(/--s\d/))[0]})`}
                strokeWidth="1"
              />
            </svg>
          </div>
        );
      })}
    </div>
  );
}

// =========== Waterfall panel ===========
function WaterfallPanel({ panel, mode }) {
  const canvasRef = useRef(null);
  const t = useTicker(mode === 'live');
  const tOffset = Math.floor(t * 8);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;

    const rows = 80, cols = 120;
    const cw = W / cols, ch = H / rows;

    for (let r = 0; r < rows; r++) {
      for (let c2 = 0; c2 < cols; c2++) {
        const freq = c2 / cols;
        const time = r + tOffset * 0.3;
        // synthesize peaks at certain frequencies
        const v =
          Math.exp(-Math.pow((freq - 0.2), 2) / 0.005) * (0.7 + Math.sin(time*0.1)*0.2) +
          Math.exp(-Math.pow((freq - 0.55), 2) / 0.002) * 0.9 +
          Math.exp(-Math.pow((freq - 0.78), 2) / 0.01) * (0.5 + Math.cos(time*0.07)*0.3) +
          Math.random() * 0.12;

        // amber colormap: dark→amber→white
        const k = Math.min(1, v);
        const R = Math.floor(k < 0.5 ? k*2*230 : 230 + (k-0.5)*2*25);
        const G = Math.floor(k < 0.5 ? k*2*162 : 162 + (k-0.5)*2*90);
        const B = Math.floor(k < 0.5 ? k*2*50  : 50 + (k-0.5)*2*180);
        ctx.fillStyle = `rgb(${R},${G},${B})`;
        ctx.fillRect(c2*cw, r*ch, cw+1, ch+1);
      }
    }

    // Frequency labels
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px "JetBrains Mono"';
    ['1.2 GHz', '1.4 GHz', '1.6 GHz', '1.8 GHz'].forEach((lbl, i) => {
      ctx.fillText(lbl, (i+1)/5 * W, H - 4);
    });
  });

  return <canvas ref={canvasRef} className="waterfall-body" />;
}

// =========== Discrete / State panel ===========
function DiscretePanel({ panel }) {
  const bindings = panel.bindings.filter(b => b.type === 'channel');
  const states = [
    { name: 'PDU BIT',         track: [[0, 'on'], [45, 'on'], [55, 'alarm'], [62, 'on']], cur: 'on' },
    { name: 'Crypto State',    track: [[0, 'on']], cur: 'ON' },
    { name: 'Hyd Bypass',      track: [[0, 'off'], [68, 'on'], [72, 'off']], cur: 'CLOSED' },
    { name: 'Antenna Select',  track: [[0, 'a'], [50, 'b']], cur: 'B' },
    { name: 'Inverter Status', track: [[0, 'on']], cur: 'NOM' },
    { name: 'Avionics Power',  track: [[0, 'on']], cur: 'ON' },
  ];
  const colors = { on: 'var(--ok)', off: 'var(--fg-3)', alarm: 'var(--alarm)', a: 'var(--s2)', b: 'var(--s5)' };
  return (
    <div className="discrete-body">
      {states.map((s, i) => (
        <div key={i} className="disc-row">
          <div className="d-name">{s.name}</div>
          <div className="disc-track">
            {s.track.map(([pct, v], j) => {
              const nextPct = s.track[j+1]?.[0] ?? 100;
              return (
                <div key={j} className="disc-seg"
                  style={{ left: `${pct}%`, width: `${nextPct - pct}%`, background: colors[v] }}/>
              );
            })}
          </div>
          <div className={`d-state ${s.cur.toLowerCase() === 'on' ? 'on' : s.cur.toLowerCase()==='off' ? 'off':''}`}>
            {s.cur}
          </div>
        </div>
      ))}
    </div>
  );
}

// =========== Event log panel ===========
function EventLogPanel({ panel, onSelectEvent, selectedAnomalyId }) {
  return (
    <div className="event-list">
      {EVENTS.map((e, i) => {
        const selected = e.code === 'HYD.SPIKE' && selectedAnomalyId;
        return (
          <div key={i}
               className={`event-row ${selected ? 'selected':''}`}
               onClick={() => onSelectEvent?.(e)}>
            <span className="ev-time">{e.t.toFixed(3)}</span>
            <span className={`ev-sev ${e.sev}`}>{e.sev}</span>
            <span>
              <span style={{ color:'var(--amber-0)', marginRight:6, fontWeight:500 }}>{e.code}</span>
              {e.msg}
            </span>
            <span className="ev-ch">{e.ch ? `CH${e.ch}` : '—'}</span>
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { StripChart, NumericPanel, WaterfallPanel, DiscretePanel, EventLogPanel });

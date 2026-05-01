// Hex → symbolic label dictionary.
//
// A lot of avionics/COTS buses encode "mode words" as raw hex that operators
// memorize from a crib sheet: 0x00 INIT, 0x01 BIT, 0x02 RUN, etc.  Rather than
// show the raw bytes everywhere, we let users attach a hex dictionary to any
// channel — { "0x00": "INIT", "0x01": "BIT", "0x02": "RUN", ... } — and all
// numeric/discrete/event displays resolve it into the human label, with the
// raw hex shown as a subline.
//
// Supports:
//   - exact codes (0x01)
//   - range codes (0x10..0x1F → "RESERVED")
//   - masked codes (0x80 / 0x80 → "FLT_SET", mask-first)
//   - per-entry color tag (ok / warn / alarm / info)
//
// In the mapping table we store:
//
//   hexMap: {
//     enabled: true,
//     width: 8,                 // bits wide — drives formatting
//     entries: [
//       { code:0x00, label:'INIT',  kind:'info'  },
//       { code:0x01, label:'BIT',   kind:'info'  },
//       { code:0x02, label:'RUN',   kind:'ok'    },
//       { code:0x03, label:'STD',   kind:'ok'    },
//       { code:0xE0, label:'FAIL',  kind:'alarm' },
//       { from:0x10, to:0x1F, label:'RESERVED', kind:'warn' },
//       { mask:0x80, match:0x80, label:'FLT_SET', kind:'alarm' },
//     ],
//     fallbackLabel: 'UNKNOWN',
//     fallbackKind:  'warn',
//   }

// ==== core resolver ============================================================
function resolveHex(hexMap, raw) {
  if (!hexMap || !hexMap.enabled || raw == null || isNaN(raw)) return null;
  const rawInt = Math.round(raw) >>> 0;
  const entries = hexMap.entries || [];

  // 1) exact match first
  for (const e of entries) {
    if (e.code != null && e.code === rawInt) return { ...e, raw: rawInt, matched: 'exact' };
  }
  // 2) range match
  for (const e of entries) {
    if (e.from != null && e.to != null && rawInt >= e.from && rawInt <= e.to) {
      return { ...e, raw: rawInt, matched: 'range' };
    }
  }
  // 3) masked match
  for (const e of entries) {
    if (e.mask != null && e.match != null && (rawInt & e.mask) === e.match) {
      return { ...e, raw: rawInt, matched: 'mask' };
    }
  }
  return {
    code: rawInt, raw: rawInt,
    label: hexMap.fallbackLabel || 'UNKNOWN',
    kind: hexMap.fallbackKind || 'warn',
    matched: 'fallback',
  };
}

const HEX_KIND_COLORS = {
  ok:    'var(--ok)',
  info:  'var(--pinned)',
  warn:  'var(--warn)',
  alarm: 'var(--alarm)',
  muted: 'var(--fg-3)',
};

function fmtHexCode(raw, widthBits) {
  const chars = Math.max(2, Math.ceil((widthBits || 8) / 4));
  return '0x' + (raw >>> 0).toString(16).toUpperCase().padStart(chars, '0');
}

// ==== small inline chip used by Numeric/Discrete/EventLog =====================
// Renders  <pill label>  0xNN   with a colored dot.
function HexValueChip({ hexMap, raw, width = 8, compact = false }) {
  const res = resolveHex(hexMap, raw);
  const hex = fmtHexCode(raw, hexMap?.width || width);
  if (!res) {
    return <span className="mono" style={{ color:'var(--fg-1)' }}>{hex}</span>;
  }
  const color = HEX_KIND_COLORS[res.kind] || 'var(--fg-1)';
  const fallback = res.matched === 'fallback';
  if (compact) {
    return (
      <span className="mono" style={{ display:'inline-flex', alignItems:'baseline', gap:6 }}>
        <span style={{
          color, fontWeight:600, letterSpacing:0.5,
          textDecoration: fallback ? 'underline dotted' : 'none',
        }}>{res.label}</span>
        <span style={{ color:'var(--fg-3)', fontSize:'0.85em' }}>{hex}</span>
      </span>
    );
  }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
      <span style={{
        display:'inline-block', width:7, height:7, borderRadius:'50%',
        background:color, flexShrink:0,
      }}/>
      <span style={{
        fontFamily:'JetBrains Mono', fontWeight:600, color,
        letterSpacing:0.5,
        textDecoration: fallback ? 'underline dotted' : 'none',
      }}>
        {res.label}
      </span>
      <span className="mono" style={{ color:'var(--fg-3)', fontSize:'0.85em' }}>{hex}</span>
    </span>
  );
}

// ==== full-width inspector editor =============================================
// Lives inside the Channel Mapping Editor's inspector, as a new "Hex Map" tab.
function HexDictionaryEditor({ channel, onChange }) {
  const hm = channel.hexMap || {
    enabled: false,
    width: channel.bits || 8,
    entries: [],
    fallbackLabel: 'UNKNOWN',
    fallbackKind: 'warn',
  };

  const patch = (p) => onChange({ ...hm, ...p });
  const patchEntry = (idx, p) =>
    patch({ entries: hm.entries.map((e,i) => i===idx ? { ...e, ...p } : e) });
  const addEntry = (seed = { code: 0, label: 'NEW', kind:'info' }) =>
    patch({ entries: [...hm.entries, seed] });
  const delEntry = (idx) =>
    patch({ entries: hm.entries.filter((_,i) => i !== idx) });
  const moveEntry = (idx, dir) => {
    const arr = [...hm.entries];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    patch({ entries: arr });
  };

  // quick parser — accept "0x1F", "31", or "0b00011111"
  const parseCode = (s) => {
    if (typeof s !== 'string') return 0;
    s = s.trim().toLowerCase();
    if (s.startsWith('0x')) return parseInt(s, 16);
    if (s.startsWith('0b')) return parseInt(s.slice(2), 2);
    return parseInt(s, 10);
  };
  const asHex = (v, w = hm.width) => fmtHexCode(v || 0, w);

  // test harness: live probe input
  const [probe, setProbe] = useState(0x02);
  const probeRes = resolveHex({ ...hm, enabled: true }, probe);

  return (
    <div>
      {/* enable + header */}
      <div style={{ display:'flex', alignItems:'center', marginBottom:10 }}>
        <div style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1 }}>
          Hex → symbol dictionary
        </div>
        <div style={{ flex:1 }}/>
        <button className="tb-btn" onClick={() => patch({ enabled: !hm.enabled })}>
          {hm.enabled ? '● Enabled' : 'Enable'}
        </button>
      </div>

      {/* intro card */}
      <div style={{
        background:'var(--bg-0)', border:'1px solid var(--line-1)',
        padding:10, marginBottom:12, fontSize:10.5, color:'var(--fg-2)', lineHeight:1.6,
      }}>
        Bind raw hex codes carried in this channel to symbolic labels. Displays
        across the app — <span style={{ color:'var(--fg-1)' }}>Numeric tiles</span>,{' '}
        <span style={{ color:'var(--fg-1)' }}>Discrete panel</span>, and{' '}
        <span style={{ color:'var(--fg-1)' }}>Event log</span> — resolve the raw
        value through this table and show <span className="mono" style={{ color:'var(--ok)' }}>RUN</span>{' '}
        instead of <span className="mono" style={{ color:'var(--fg-3)' }}>0x02</span>.
        Exact codes match first, then ranges, then masks. Anything unmatched
        falls through to the fallback entry.
      </div>

      {/* width + fallback */}
      <div style={{
        background:'var(--bg-0)', border:'1px solid var(--line-1)', padding:10, marginBottom:12,
        display:'grid', gridTemplateColumns:'110px 1fr 110px 1fr', gap:'6px 10px', fontSize:10.5,
        alignItems:'center',
      }}>
        <span style={{ color:'var(--fg-3)' }}>Code width</span>
        <select value={hm.width} className="cme-cell mono"
          onChange={e => patch({ width: +e.target.value })}>
          {[4, 8, 12, 16, 24, 32].map(w =>
            <option key={w} value={w}>{w} bits · 0x{'F'.repeat(Math.ceil(w/4))}</option>
          )}
        </select>
        <span style={{ color:'var(--fg-3)' }}>Entries</span>
        <span className="mono" style={{ color:'var(--fg-1)' }}>
          {hm.entries.length} defined
        </span>

        <span style={{ color:'var(--fg-3)' }}>Fallback label</span>
        <input value={hm.fallbackLabel} className="cme-cell"
          placeholder="UNKNOWN"
          onChange={e => patch({ fallbackLabel: e.target.value })}/>
        <span style={{ color:'var(--fg-3)' }}>Fallback kind</span>
        <select value={hm.fallbackKind} className="cme-cell"
          onChange={e => patch({ fallbackKind: e.target.value })}>
          {['muted','info','ok','warn','alarm'].map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      {/* table */}
      <div style={{ background:'var(--bg-0)', border:'1px solid var(--line-1)', marginBottom:12 }}>
        <div style={{
          display:'grid',
          gridTemplateColumns:'22px 72px 56px 72px 1fr 88px 44px 48px',
          gap:6, padding:'5px 8px',
          background:'var(--bg-2)', borderBottom:'1px solid var(--line-1)',
          fontSize:9, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:0.8,
        }}>
          <span>#</span>
          <span>Match</span>
          <span>Code</span>
          <span>Extra</span>
          <span>Label</span>
          <span>Kind</span>
          <span/>
          <span/>
        </div>
        {hm.entries.length === 0 ? (
          <div style={{ padding:20, textAlign:'center', fontSize:10, color:'var(--fg-3)' }}>
            no entries — <button className="tb-btn" style={{ padding:'2px 8px' }}
              onClick={() => addEntry()}>+ add one</button>
          </div>
        ) : hm.entries.map((e, i) => {
          const matchKind = e.from != null ? 'range' : e.mask != null ? 'mask' : 'exact';
          const setMatchKind = (k) => {
            if (k === 'exact') patchEntry(i, { code: e.code ?? e.from ?? 0, from: undefined, to: undefined, mask: undefined, match: undefined });
            if (k === 'range') patchEntry(i, { from: e.from ?? e.code ?? 0, to: e.to ?? (e.code ?? 0xFF), code: undefined, mask: undefined, match: undefined });
            if (k === 'mask')  patchEntry(i, { mask: e.mask ?? 0xFF, match: e.match ?? 0x00, code: undefined, from: undefined, to: undefined });
          };
          return (
            <div key={i} style={{
              display:'grid',
              gridTemplateColumns:'22px 72px 56px 72px 1fr 88px 44px 48px',
              gap:6, padding:'5px 8px', alignItems:'center',
              borderBottom:'1px solid var(--line-0)',
              fontSize:10.5,
            }}>
              <span className="mono" style={{ color:'var(--fg-3)', fontSize:9, textAlign:'center' }}>{i+1}</span>

              <select value={matchKind} className="cme-cell mono" style={{ fontSize:9.5 }}
                onChange={ev => setMatchKind(ev.target.value)}>
                <option value="exact">exact</option>
                <option value="range">range</option>
                <option value="mask">mask</option>
              </select>

              {matchKind === 'exact' && (
                <>
                  <input value={asHex(e.code)}
                    onChange={ev => patchEntry(i, { code: parseCode(ev.target.value) })}
                    className="cme-cell mono" style={{ textAlign:'right' }}/>
                  <span style={{ fontSize:9, color:'var(--fg-3)', textAlign:'center' }}>—</span>
                </>
              )}
              {matchKind === 'range' && (
                <>
                  <input value={asHex(e.from)}
                    onChange={ev => patchEntry(i, { from: parseCode(ev.target.value) })}
                    className="cme-cell mono" style={{ textAlign:'right' }}
                    title="from (inclusive)"/>
                  <input value={asHex(e.to)}
                    onChange={ev => patchEntry(i, { to: parseCode(ev.target.value) })}
                    className="cme-cell mono" style={{ textAlign:'right' }}
                    title="to (inclusive)"/>
                </>
              )}
              {matchKind === 'mask' && (
                <>
                  <input value={asHex(e.mask)}
                    onChange={ev => patchEntry(i, { mask: parseCode(ev.target.value) })}
                    className="cme-cell mono" style={{ textAlign:'right' }}
                    title="bitmask applied to raw"/>
                  <input value={asHex(e.match)}
                    onChange={ev => patchEntry(i, { match: parseCode(ev.target.value) })}
                    className="cme-cell mono" style={{ textAlign:'right' }}
                    title="expected value after mask"/>
                </>
              )}

              <input value={e.label}
                onChange={ev => patchEntry(i, { label: ev.target.value })}
                className="cme-cell" style={{ color: HEX_KIND_COLORS[e.kind] || 'var(--fg-1)', fontWeight:500 }}/>

              <select value={e.kind} className="cme-cell"
                onChange={ev => patchEntry(i, { kind: ev.target.value })}
                style={{ color: HEX_KIND_COLORS[e.kind] }}>
                {['muted','info','ok','warn','alarm'].map(k => <option key={k} value={k}>{k}</option>)}
              </select>

              <div style={{ display:'flex', gap:2 }}>
                <button onClick={() => moveEntry(i, -1)} title="move up"
                  style={{ background:'transparent', border:'1px solid var(--line-1)',
                    color:'var(--fg-2)', padding:'1px 4px', cursor:'pointer', fontSize:9 }}>▲</button>
                <button onClick={() => moveEntry(i, +1)} title="move down"
                  style={{ background:'transparent', border:'1px solid var(--line-1)',
                    color:'var(--fg-2)', padding:'1px 4px', cursor:'pointer', fontSize:9 }}>▼</button>
              </div>
              <button onClick={() => delEntry(i)}
                style={{ background:'transparent', border:'1px solid var(--line-1)',
                  color:'var(--fg-3)', padding:'1px 6px', cursor:'pointer', fontSize:10 }}>×</button>
            </div>
          );
        })}
        <div style={{ padding:'6px 8px', borderTop:'1px solid var(--line-0)',
          display:'flex', gap:6, background:'var(--bg-2)' }}>
          <button className="tb-btn" onClick={() => addEntry({ code: 0, label:'NEW', kind:'info' })}>+ exact</button>
          <button className="tb-btn" onClick={() => addEntry({ from:0x10, to:0x1F, label:'RESERVED', kind:'warn' })}>+ range</button>
          <button className="tb-btn" onClick={() => addEntry({ mask:0x80, match:0x80, label:'FLAG_SET', kind:'alarm' })}>+ mask</button>
          <div style={{ flex:1 }}/>
          <button className="tb-btn">Import .csv</button>
          <button className="tb-btn">Export .csv</button>
        </div>
      </div>

      {/* quick-fill templates */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:9.5, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>
          Templates
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <button className="tb-btn"
            onClick={() => patch({ width: 8, entries: [
              { code:0x00, label:'INIT', kind:'info' },
              { code:0x01, label:'BIT',  kind:'info' },
              { code:0x02, label:'RUN',  kind:'ok' },
              { code:0x03, label:'STD',  kind:'ok' },
              { code:0x04, label:'XFER', kind:'info' },
              { code:0x05, label:'RAMP', kind:'info' },
              { code:0x06, label:'HOLD', kind:'warn' },
              { code:0x07, label:'END',  kind:'info' },
              { from:0x10, to:0x7F, label:'RESERVED', kind:'muted' },
              { mask:0x80, match:0x80, label:'FAULT', kind:'alarm' },
            ]})}>Mode word (8-state)</button>
          <button className="tb-btn"
            onClick={() => patch({ width: 8, entries: [
              { code:0x00, label:'OFF',     kind:'muted' },
              { code:0x01, label:'STBY',    kind:'info' },
              { code:0x02, label:'ARMED',   kind:'warn' },
              { code:0x03, label:'ACTIVE',  kind:'ok' },
              { code:0xFE, label:'SHUTDOWN', kind:'warn' },
              { code:0xFF, label:'FAIL',    kind:'alarm' },
            ]})}>Power state</button>
          <button className="tb-btn"
            onClick={() => patch({ width: 16, entries: [
              { code:0x0000, label:'IDLE', kind:'muted' },
              { code:0xA5A5, label:'SYNC', kind:'ok' },
              { code:0xDEAD, label:'FAULT', kind:'alarm' },
              { mask:0xF000, match:0xE000, label:'ERR_*', kind:'alarm' },
              { from:0x1000, to:0x1FFF, label:'HDR_A', kind:'info' },
              { from:0x2000, to:0x2FFF, label:'HDR_B', kind:'info' },
            ]})}>Frame header (16b)</button>
          <button className="tb-btn"
            onClick={() => patch({ width: 8, entries: [
              { code:0x00, label:'ACK',  kind:'ok' },
              { code:0x01, label:'NAK',  kind:'warn' },
              { code:0x02, label:'BUSY', kind:'warn' },
              { code:0x03, label:'RETRY', kind:'warn' },
              { code:0xFF, label:'TIMEOUT', kind:'alarm' },
            ]})}>ACK / NAK</button>
        </div>
      </div>

      {/* probe */}
      <div style={{
        background:'var(--bg-0)', border:'1px solid var(--line-1)', padding:10,
      }}>
        <div style={{ fontSize:9.5, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>
          Probe · resolve a raw value
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <span style={{ color:'var(--fg-3)', fontSize:10 }}>raw</span>
          <input value={asHex(probe)}
            onChange={e => setProbe(parseCode(e.target.value))}
            className="cme-cell mono"
            style={{ width:100, textAlign:'right' }}/>
          <span style={{ color:'var(--fg-3)' }}>→</span>
          {hm.enabled ? (
            <span style={{ padding:'2px 8px', background:'var(--bg-2)', border:'1px solid var(--line-1)' }}>
              <HexValueChip hexMap={hm} raw={probe} width={hm.width}/>
            </span>
          ) : (
            <span className="mono" style={{ color:'var(--fg-3)', fontSize:10.5 }}>(dictionary disabled)</span>
          )}
          <span style={{ flex:1 }}/>
          {probeRes && hm.enabled && (
            <span style={{ fontSize:9.5, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1 }}>
              matched via <span style={{ color:'var(--fg-1)' }}>{probeRes.matched}</span>
            </span>
          )}
        </div>

        {/* grid preview — every code in range for widths ≤8 bits */}
        {hm.enabled && hm.width <= 8 && (
          <div style={{ marginTop:10 }}>
            <div style={{ fontSize:9, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>
              Coverage map · {Math.pow(2, hm.width)} codes
            </div>
            <div style={{
              display:'grid',
              gridTemplateColumns:`repeat(${Math.min(16, Math.pow(2, hm.width))}, 1fr)`,
              gap:1, fontFamily:'JetBrains Mono', fontSize:8.5,
            }}>
              {Array.from({ length: Math.min(256, Math.pow(2, hm.width)) }).map((_, v) => {
                const r = resolveHex({ ...hm, enabled: true }, v);
                const color = HEX_KIND_COLORS[r.kind] || 'var(--fg-3)';
                return (
                  <div key={v} title={`${fmtHexCode(v, hm.width)} → ${r.label}`}
                    onClick={() => setProbe(v)}
                    style={{
                      padding:'3px 2px', textAlign:'center', cursor:'pointer',
                      background: r.matched === 'fallback' ? 'transparent'
                        : 'color-mix(in oklab, ' + color + ' 20%, transparent)',
                      color: r.matched === 'fallback' ? 'var(--fg-3)' : color,
                      border: v === probe ? '1px solid var(--amber-0)' : '1px solid transparent',
                    }}>
                    {v.toString(16).toUpperCase().padStart(Math.ceil(hm.width/4), '0')}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, { resolveHex, fmtHexCode, HexValueChip, HexDictionaryEditor, HEX_KIND_COLORS });

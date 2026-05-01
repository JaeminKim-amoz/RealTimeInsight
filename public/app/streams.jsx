// UDP Stream Configuration — multi-stream receiver setup.
// Each stream binds to an IP/port, declares its sync pattern, frame geometry,
// AES-256 key (optional), and the regions where video/digital channels live.
// RX data rate + sync-lock are computed live and surfaced as LEDs.

const STREAM_DEFS = [
  {
    id: 's-primary',
    name: 'Primary Telemetry',
    enabled: true,
    transport: 'udp-multicast',     // udp-multicast | udp-unicast | tcp
    iface: 'eth1 (MGT-01)',
    ip: '239.192.1.10',
    port: 5001,
    bindPort: 5001,
    ttl: 8,
    syncPattern: 'FE6B2840',        // hex
    syncMaskBits: 32,
    byteOrder: 'little',            // little | big
    frameSize: 1024,                // bytes per major frame
    periodMs: 5,                    // frame period → 200Hz
    crc: 'CRC-32/Ch10',             // CRC-16/CCITT, CRC-32/Ch10, none
    crcOffset: 1020,
    aes: {
      enabled: true,
      mode: 'AES-256-CTR',          // AES-256-CTR | AES-256-GCM | AES-256-CBC | none
      keyLabel: 'KEK-T247-2026Q2',
      keyFp: 'sha256:a3f8…e21c',
      iv: 'per-frame · header IV',
    },
    regions: [
      { id:'r1', name:'header',       kind:'header',   offset:0,    length:24,   color:'#6a9bb5' },
      { id:'r2', name:'PCM words',    kind:'digital',  offset:24,   length:512,  color:'#e5a24a' },
      { id:'r3', name:'MIL-STD-1553', kind:'digital',  offset:536,  length:240,  color:'#7aa874' },
      { id:'r4', name:'video MPEG-TS',kind:'video',    offset:776,  length:240,  color:'#c97d6a' },
      { id:'r5', name:'CRC-32',       kind:'crc',      offset:1020, length:4,    color:'#a78bc0' },
    ],
    // Live-ish status
    stat: { locked: true, rxMbps: 42.8, pktPerSec: 200.1, crcErrPerMin: 0, syncLossPerMin: 0, dropPerMin: 0, lastSyncMs: 12 },
  },
  {
    id: 's-video',
    name: 'Front EO Video',
    enabled: true,
    transport: 'udp-unicast',
    iface: 'eth1 (MGT-01)',
    ip: '10.10.20.14',
    port: 5101,
    bindPort: 5101,
    ttl: 4,
    syncPattern: '47000010',          // MPEG-TS sync 0x47
    syncMaskBits: 8,
    byteOrder: 'big',
    frameSize: 188,
    periodMs: 33,                     // ~30fps envelope
    crc: 'none',
    crcOffset: 0,
    aes: { enabled: false, mode: 'none', keyLabel: '', keyFp: '', iv: '' },
    regions: [
      { id:'r1', name:'TS header',   kind:'header',  offset:0,   length:4,   color:'#6a9bb5' },
      { id:'r2', name:'H.264 NAL',   kind:'video',   offset:4,   length:184, color:'#c97d6a' },
    ],
    stat: { locked: true, rxMbps: 18.4, pktPerSec: 1247, crcErrPerMin: 0, syncLossPerMin: 0, dropPerMin: 2, lastSyncMs: 8 },
  },
  {
    id: 's-rf',
    name: 'RF IQ · L-band',
    enabled: true,
    transport: 'udp-multicast',
    iface: 'eth2 (RF-01)',
    ip: '239.192.2.20',
    port: 5201,
    bindPort: 5201,
    ttl: 4,
    syncPattern: '1ACFFC1D',          // CCSDS ASM
    syncMaskBits: 32,
    byteOrder: 'little',
    frameSize: 4104,
    periodMs: 50,
    crc: 'CRC-16/CCITT',
    crcOffset: 4102,
    aes: {
      enabled: true,
      mode: 'AES-256-GCM',
      keyLabel: 'IQ-SESSION-4A9E',
      keyFp: 'sha256:7c21…b049',
      iv: 'explicit · 96-bit',
    },
    regions: [
      { id:'r1', name:'header',    kind:'header',  offset:0,    length:8,    color:'#6a9bb5' },
      { id:'r2', name:'IQ samples',kind:'digital', offset:8,    length:4094, color:'#e5a24a' },
      { id:'r3', name:'CRC-16',    kind:'crc',     offset:4102, length:2,    color:'#a78bc0' },
    ],
    stat: { locked: false, rxMbps: 0, pktPerSec: 0, crcErrPerMin: 0, syncLossPerMin: 14, dropPerMin: 0, lastSyncMs: 2340 },
  },
  {
    id: 's-chase',
    name: 'Chase Plane Bus',
    enabled: false,
    transport: 'udp-unicast',
    iface: 'eth3 (MGT-02)',
    ip: '192.168.14.201',
    port: 5401,
    bindPort: 5401,
    ttl: 1,
    syncPattern: 'FAF320',
    syncMaskBits: 24,
    byteOrder: 'little',
    frameSize: 512,
    periodMs: 20,
    crc: 'CRC-16/CCITT',
    crcOffset: 510,
    aes: { enabled: false, mode: 'none', keyLabel: '', keyFp: '', iv: '' },
    regions: [
      { id:'r1', name:'header',   kind:'header',  offset:0,   length:12,  color:'#6a9bb5' },
      { id:'r2', name:'digital',  kind:'digital', offset:12,  length:498, color:'#e5a24a' },
      { id:'r3', name:'CRC',      kind:'crc',     offset:510, length:2,   color:'#a78bc0' },
    ],
    stat: { locked: false, rxMbps: 0, pktPerSec: 0, crcErrPerMin: 0, syncLossPerMin: 0, dropPerMin: 0, lastSyncMs: null },
  },
];

const REGION_KINDS = [
  { k:'header',  label:'HEADER',  color:'#6a9bb5' },
  { k:'digital', label:'DIGITAL', color:'#e5a24a' },
  { k:'video',   label:'VIDEO',   color:'#c97d6a' },
  { k:'audio',   label:'AUDIO',   color:'#7aa874' },
  { k:'crc',     label:'CRC',     color:'#a78bc0' },
  { k:'pad',     label:'PAD',     color:'#5a564d' },
];

const CRC_OPTS       = ['none','CRC-16/CCITT','CRC-16/MODBUS','CRC-32/Ch10','CRC-32/MPEG-2','Fletcher-16'];
const AES_MODE_OPTS  = ['none','AES-256-CTR','AES-256-GCM','AES-256-CBC','AES-128-CTR','ChaCha20-Poly1305'];
const TRANSPORT_OPTS = ['udp-multicast','udp-unicast','tcp','serial-tty','file-replay'];
const IFACE_OPTS     = ['eth1 (MGT-01)','eth2 (RF-01)','eth3 (MGT-02)','eth4 (OOB)','lo'];

// =========================================================================
// Byte-region layout visualizer — renders the frame geometry as a stacked
// bar with offset axis, showing header/digital/video/crc regions in color.
// =========================================================================
function FrameLayoutStrip({ frameSize, regions, selectedId, onSelect }) {
  const W = 720;
  const H = 44;
  const scale = (off) => (off / Math.max(frameSize, 1)) * W;
  // Mark 10 equally-spaced byte ticks
  const ticks = Array.from({ length: 11 }).map((_, i) => Math.round((frameSize * i) / 10));

  // Detect gaps/overlaps
  const sorted = [...regions].sort((a, b) => a.offset - b.offset);
  const gaps = [];
  let cursor = 0;
  for (const r of sorted) {
    if (r.offset > cursor) gaps.push({ offset: cursor, length: r.offset - cursor });
    cursor = Math.max(cursor, r.offset + r.length);
  }
  if (cursor < frameSize) gaps.push({ offset: cursor, length: frameSize - cursor });

  return (
    <svg viewBox={`0 0 ${W} ${H + 36}`} style={{ width: '100%', height: H + 36 }}>
      {/* Baseline */}
      <rect x={0} y={10} width={W} height={H} fill="var(--bg-3)" stroke="var(--line-1)"/>
      {/* Gaps (pad) */}
      {gaps.map((g, i) => (
        <rect key={'g'+i} x={scale(g.offset)} y={10}
          width={Math.max(1, scale(g.offset + g.length) - scale(g.offset))}
          height={H}
          fill="url(#diag)" opacity="0.4"/>
      ))}
      <defs>
        <pattern id="diag" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="var(--bg-3)"/>
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--line-2)" strokeWidth="2"/>
        </pattern>
      </defs>
      {/* Regions */}
      {regions.map(r => {
        const x = scale(r.offset);
        const w = Math.max(2, scale(r.offset + r.length) - x);
        const hi = selectedId === r.id;
        return (
          <g key={r.id} onClick={() => onSelect?.(r.id)} style={{ cursor: 'pointer' }}>
            <rect x={x} y={10} width={w} height={H}
              fill={r.color} opacity={hi ? 0.85 : 0.6}
              stroke={hi ? 'var(--amber-0)' : r.color} strokeWidth={hi ? 2 : 1}/>
            {w > 40 && (
              <text x={x + w / 2} y={10 + H / 2 - 2} textAnchor="middle"
                fontSize="10" fill="#1a1614" fontFamily="JetBrains Mono" fontWeight="600">
                {r.name}
              </text>
            )}
            {w > 40 && (
              <text x={x + w / 2} y={10 + H / 2 + 10} textAnchor="middle"
                fontSize="9" fill="#1a1614" fontFamily="JetBrains Mono">
                @{r.offset} · {r.length}B
              </text>
            )}
          </g>
        );
      })}
      {/* Byte ticks */}
      {ticks.map((t, i) => (
        <g key={'t' + i}>
          <line x1={scale(t)} y1={H + 10} x2={scale(t)} y2={H + 14} stroke="var(--fg-3)"/>
          <text x={scale(t)} y={H + 26} textAnchor="middle"
            fontSize="9" fill="var(--fg-3)" fontFamily="JetBrains Mono">{t}</text>
        </g>
      ))}
      <text x={0} y={8} fontSize="8" fill="var(--fg-3)" fontFamily="JetBrains Mono">offset 0</text>
      <text x={W} y={8} fontSize="8" fill="var(--fg-3)" fontFamily="JetBrains Mono" textAnchor="end">{frameSize}B</text>
    </svg>
  );
}

// =========================================================================
// Sync pattern visualizer — shows the bit pattern + mask as a 32-bit strip
// =========================================================================
function SyncPatternStrip({ pattern, maskBits }) {
  const total = Math.max(8, Math.min(64, maskBits));
  const patHex = (pattern || '').replace(/[^0-9a-fA-F]/g, '').padStart(Math.ceil(total / 4), '0').slice(-Math.ceil(total / 4));
  const bits = [];
  for (const c of patHex) {
    const n = parseInt(c, 16);
    for (let b = 3; b >= 0; b--) bits.push((n >> b) & 1);
  }
  const shown = bits.slice(-total);
  const W = 14;
  return (
    <svg viewBox={`0 0 ${total * W} 34`} style={{ width: '100%', height: 34 }}>
      {shown.map((b, i) => (
        <g key={i}>
          <rect x={i * W} y={4} width={W - 1} height={22}
            fill={b ? 'var(--amber-1)' : 'var(--bg-3)'}
            stroke="var(--line-1)"/>
          <text x={i * W + W / 2} y={19} textAnchor="middle"
            fontSize="10" fill={b ? '#1a1614' : 'var(--fg-2)'}
            fontFamily="JetBrains Mono" fontWeight="600">{b}</text>
        </g>
      ))}
      <text x={0} y={33} fontSize="8" fill="var(--fg-3)" fontFamily="JetBrains Mono">MSB</text>
      <text x={total * W} y={33} fontSize="8" fill="var(--fg-3)" fontFamily="JetBrains Mono" textAnchor="end">LSB · {total}-bit sync</text>
    </svg>
  );
}

// =========================================================================
// StatusLED — reusable LED with glow. kind: ok/warn/alarm/idle
// =========================================================================
function StatusLED({ kind, size = 8, blink = false, title }) {
  const colors = {
    ok:    { fill:'var(--ok)',    glow:'rgba(122,168,116,0.55)' },
    warn:  { fill:'var(--warn)',  glow:'rgba(229,162,74,0.6)' },
    alarm: { fill:'var(--alarm)', glow:'rgba(216,99,74,0.65)' },
    idle:  { fill:'var(--fg-3)',  glow:'rgba(90,86,77,0)' },
  };
  const c = colors[kind] || colors.idle;
  return (
    <span title={title}
      style={{
        display:'inline-block',
        width: size, height: size, borderRadius:'50%',
        background: c.fill,
        boxShadow: `0 0 ${size}px ${c.glow}, inset 0 0 ${Math.round(size/2)}px rgba(0,0,0,0.35)`,
        border: '1px solid rgba(0,0,0,0.45)',
        animation: blink ? 'led-blink 0.9s infinite' : 'none',
        verticalAlign: 'middle',
      }}/>
  );
}

// =========================================================================
// Derived stream status
// =========================================================================
function streamHealth(s) {
  if (!s.enabled) return { kind:'idle', label:'DISABLED' };
  if (!s.stat.locked) return { kind:'alarm', label:'NO SYNC' };
  if (s.stat.crcErrPerMin > 10 || s.stat.dropPerMin > 50) return { kind:'alarm', label:'ERRORS' };
  if (s.stat.crcErrPerMin > 0 || s.stat.dropPerMin > 0 || s.stat.syncLossPerMin > 0) return { kind:'warn', label:'DEGRADED' };
  return { kind:'ok', label:'LOCKED' };
}

function expectedRxMbps(s) {
  if (!s.enabled || s.periodMs <= 0) return 0;
  return (s.frameSize * 8 * (1000 / s.periodMs)) / 1e6;
}

// =========================================================================
// Per-stream card (left list)
// =========================================================================
function StreamListCard({ s, selected, onClick }) {
  const h = streamHealth(s);
  return (
    <div onClick={onClick}
      style={{
        padding:'8px 10px',
        cursor:'pointer',
        background: selected ? 'var(--bg-0)' : 'transparent',
        borderLeft: selected ? '2px solid var(--amber-0)' : '2px solid transparent',
        borderBottom:'1px solid var(--line-0)',
      }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <StatusLED kind={h.kind} blink={h.kind==='alarm' && s.enabled}/>
        <span style={{ fontSize:11, color:'var(--fg-0)', fontWeight:500, flex:1 }}>{s.name}</span>
        <span className="mono" style={{ fontSize:9, color:'var(--fg-3)', letterSpacing:0.5 }}>{h.label}</span>
      </div>
      <div className="mono" style={{ fontSize:10, color:'var(--fg-2)', marginTop:3, marginLeft:16 }}>
        {s.transport.split('-')[0].toUpperCase()} · {s.ip}:{s.port}
      </div>
      <div style={{ marginLeft:16, marginTop:3, display:'flex', gap:10, fontSize:9.5, color:'var(--fg-3)', fontFamily:'JetBrains Mono' }}>
        <span>{s.stat.rxMbps.toFixed(1)} Mbps</span>
        <span>{s.stat.pktPerSec.toFixed(0)} pkt/s</span>
        {s.aes.enabled && <span style={{ color:'var(--pinned)' }}>AES</span>}
      </div>
    </div>
  );
}

// =========================================================================
// Main modal
// =========================================================================
function StreamConfigModal({ open, onClose }) {
  const [streams, setStreams] = useState(STREAM_DEFS);
  const [sel, setSel] = useState('s-primary');
  const [tab, setTab] = useState('transport'); // transport | framing | security | layout | diagnostics
  const [selRegionId, setSelRegionId] = useState(null);
  const [dirty, setDirty] = useState(false);

  if (!open) return null;

  const s = streams.find(x => x.id === sel);
  const patchStream = (id, patch) => {
    setStreams(ss => ss.map(x => x.id === id ? { ...x, ...patch } : x));
    setDirty(true);
  };
  const patchRegion = (sid, rid, patch) => {
    setStreams(ss => ss.map(x => x.id !== sid ? x : {
      ...x,
      regions: x.regions.map(r => r.id === rid ? { ...r, ...patch } : r),
    }));
    setDirty(true);
  };
  const addRegion = (sid) => {
    setStreams(ss => ss.map(x => {
      if (x.id !== sid) return x;
      const end = x.regions.reduce((m, r) => Math.max(m, r.offset + r.length), 0);
      return {
        ...x,
        regions: [...x.regions, {
          id: 'r' + Date.now(),
          name: 'new region',
          kind: 'digital',
          offset: Math.min(end, x.frameSize - 1),
          length: Math.max(1, x.frameSize - end),
          color: '#e5a24a',
        }],
      };
    }));
    setDirty(true);
  };
  const delRegion = (sid, rid) => {
    setStreams(ss => ss.map(x => x.id !== sid ? x : { ...x, regions: x.regions.filter(r => r.id !== rid) }));
    setDirty(true);
  };
  const addStream = () => {
    const id = 's-' + Date.now();
    const n = {
      id, name: 'New Stream', enabled: true,
      transport: 'udp-multicast', iface: 'eth1 (MGT-01)',
      ip: '239.192.9.99', port: 5999, bindPort: 5999, ttl: 8,
      syncPattern: 'DEADBEEF', syncMaskBits: 32, byteOrder: 'little',
      frameSize: 512, periodMs: 10, crc:'none', crcOffset: 0,
      aes: { enabled:false, mode:'none', keyLabel:'', keyFp:'', iv:'' },
      regions: [
        { id:'r1', name:'header', kind:'header', offset:0, length:8, color:'#6a9bb5' },
        { id:'r2', name:'payload', kind:'digital', offset:8, length:504, color:'#e5a24a' },
      ],
      stat: { locked: false, rxMbps: 0, pktPerSec: 0, crcErrPerMin: 0, syncLossPerMin: 0, dropPerMin: 0, lastSyncMs: null },
    };
    setStreams(ss => [...ss, n]);
    setSel(id);
    setDirty(true);
  };

  // Totals for header summary
  const totals = streams.reduce((acc, x) => {
    if (!x.enabled) return acc;
    acc.streams += 1;
    acc.rxMbps += x.stat.rxMbps;
    acc.pps += x.stat.pktPerSec;
    if (!x.stat.locked) acc.unlocked += 1;
    if (x.aes.enabled) acc.aes += 1;
    return acc;
  }, { streams:0, rxMbps:0, pps:0, unlocked:0, aes:0 });

  const h = s ? streamHealth(s) : { kind:'idle', label:'—' };
  const expMbps = s ? expectedRxMbps(s) : 0;
  const rxDelta = s && s.enabled ? s.stat.rxMbps - expMbps : 0;
  const rxDeltaPct = expMbps > 0 ? (rxDelta / expMbps) * 100 : 0;

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'var(--bg-0)', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ height:40, borderBottom:'1px solid var(--line-2)', background:'var(--bg-2)',
        display:'flex', alignItems:'center', padding:'0 16px', gap:14 }}>
        <span style={{ fontSize:11, fontWeight:600, letterSpacing:1.2, textTransform:'uppercase', color:'var(--amber-0)' }}>
          UDP Stream Configuration
        </span>
        <span style={{ fontSize:10, color:'var(--fg-3)', letterSpacing:1, textTransform:'uppercase' }}>
          Receiver · T-247 Ground Segment
        </span>
        {dirty && <span style={{ fontSize:10, color:'var(--warn)', letterSpacing:1, textTransform:'uppercase' }}>● unsaved</span>}
        <div style={{ flex:1 }}/>
        <button className="tb-btn">Import preset…</button>
        <button className="tb-btn">Export config</button>
        <button className="tb-btn primary">Apply & restart RX</button>
        <button className="tb-btn" onClick={onClose}>Close</button>
      </div>

      {/* Summary */}
      <div style={{ height:32, borderBottom:'1px solid var(--line-1)', background:'var(--bg-1)',
        display:'flex', alignItems:'center', padding:'0 16px', gap:22,
        fontSize:10, color:'var(--fg-2)', textTransform:'uppercase', letterSpacing:0.8 }}>
        <span><span style={{ color:'var(--fg-0)' }}>{totals.streams}</span> / {streams.length} active</span>
        <span>aggregate <span style={{ color:'var(--amber-0)' }}>{totals.rxMbps.toFixed(2)} Mbps</span></span>
        <span><span style={{ color:'var(--fg-0)' }}>{totals.pps.toFixed(0)}</span> pkt/s</span>
        <span><span style={{ color: totals.unlocked ? 'var(--alarm)' : 'var(--fg-0)' }}>{totals.unlocked}</span> unsynced</span>
        <span><span style={{ color:'var(--pinned)' }}>{totals.aes}</span> encrypted</span>
        <div style={{ flex:1 }}/>
        <span>ingest node <span style={{ color:'var(--fg-1)' }}>rti-rx-01</span> · kernel <span className="mono" style={{ color:'var(--fg-1)' }}>5.15.0-107</span></span>
      </div>

      <div style={{ flex:1, display:'grid', gridTemplateColumns:'260px 1fr', minHeight:0 }}>
        {/* Left stream list */}
        <div style={{ borderRight:'1px solid var(--line-1)', background:'var(--bg-1)', display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--line-1)', display:'flex', alignItems:'center' }}>
            <span style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, flex:1 }}>
              Streams · {streams.length}
            </span>
            <button className="tb-btn" onClick={addStream} style={{ padding:'2px 8px' }}>+</button>
          </div>
          <div style={{ flex:1, overflow:'auto' }}>
            {streams.map(x => (
              <StreamListCard key={x.id} s={x} selected={sel === x.id} onClick={() => { setSel(x.id); setSelRegionId(null); }}/>
            ))}
          </div>
          {/* Aggregate LED board */}
          <div style={{ padding:'10px 12px', borderTop:'1px solid var(--line-1)', background:'var(--bg-2)' }}>
            <div style={{ fontSize:9, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>
              Receiver health
            </div>
            {[
              { label:'Link',    kind: totals.unlocked === 0 && totals.streams > 0 ? 'ok' : (totals.streams === 0 ? 'idle' : 'alarm') },
              { label:'Sync',    kind: totals.unlocked === 0 && totals.streams > 0 ? 'ok' : 'alarm', blink: totals.unlocked > 0 },
              { label:'CRC',     kind: streams.some(x => x.enabled && x.stat.crcErrPerMin > 0) ? 'warn' : 'ok' },
              { label:'Drop',    kind: streams.some(x => x.enabled && x.stat.dropPerMin > 10) ? 'warn' : 'ok' },
              { label:'AES',     kind: totals.aes > 0 ? 'ok' : 'idle' },
              { label:'Buffer',  kind: 'ok' },
            ].map(row => (
              <div key={row.label} style={{ display:'flex', alignItems:'center', gap:8, padding:'3px 0',
                fontSize:10, color:'var(--fg-1)' }}>
                <StatusLED kind={row.kind} blink={row.blink}/>
                <span style={{ flex:1 }}>{row.label}</span>
                <span style={{ fontSize:9, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:0.8 }}>
                  {row.kind === 'ok' ? 'nominal' : row.kind === 'alarm' ? 'fault' : row.kind === 'warn' ? 'degraded' : 'idle'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right detail */}
        <div style={{ overflow:'auto', display:'flex', flexDirection:'column' }}>
          {/* Stream header */}
          <div style={{ padding:'12px 16px 8px', borderBottom:'1px solid var(--line-1)' }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:10 }}>
              <input value={s.name} onChange={e => patchStream(s.id, { name: e.target.value })}
                style={{
                  background:'transparent', border:'none', color:'var(--fg-0)',
                  fontSize:16, fontWeight:500, fontFamily:'inherit', outline:'none', padding:0,
                }}/>
              <span className="mono" style={{ fontSize:11, color:'var(--amber-0)' }}>#{s.id}</span>
              <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, color:'var(--fg-2)',
                textTransform:'uppercase', letterSpacing:1, marginLeft:10 }}>
                <input type="checkbox" checked={s.enabled}
                  onChange={e => patchStream(s.id, { enabled: e.target.checked })}
                  style={{ accentColor:'var(--amber-1)' }}/>
                Enabled
              </label>
              <div style={{ flex:1 }}/>
              <span style={{ display:'inline-flex', alignItems:'center', gap:6,
                fontSize:10, color:'var(--fg-1)', textTransform:'uppercase', letterSpacing:1 }}>
                <StatusLED kind={h.kind} blink={h.kind === 'alarm' && s.enabled}/>
                {h.label}
              </span>
            </div>
            <div style={{ display:'flex', gap:2, marginTop:10 }}>
              {[
                ['transport','Transport'],
                ['framing','Framing · Sync'],
                ['security','Security · AES'],
                ['layout',`Layout · ${s.regions.length}`],
                ['diagnostics','Diagnostics'],
              ].map(([k,label]) => (
                <button key={k} onClick={() => setTab(k)}
                  style={{
                    padding:'4px 12px', fontSize:10, textTransform:'uppercase', letterSpacing:0.8,
                    background: tab === k ? 'var(--bg-0)' : 'transparent',
                    color: tab === k ? 'var(--amber-0)' : 'var(--fg-2)',
                    border:'1px solid var(--line-1)',
                    borderBottom: tab === k ? '1px solid var(--bg-0)' : '1px solid var(--line-1)',
                    fontFamily:'inherit', cursor:'pointer',
                  }}>{label}</button>
              ))}
            </div>
          </div>

          <div style={{ padding:16, flex:1, overflow:'auto' }}>
            {tab === 'transport' && (
              <>
                <div className="sc-grid">
                  <div className="sc-field">
                    <label>Transport</label>
                    <select value={s.transport} onChange={e => patchStream(s.id, { transport: e.target.value })} className="cme-cell">
                      {TRANSPORT_OPTS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="sc-field">
                    <label>NIC / Interface</label>
                    <select value={s.iface} onChange={e => patchStream(s.id, { iface: e.target.value })} className="cme-cell">
                      {IFACE_OPTS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="sc-field">
                    <label>{s.transport === 'udp-multicast' ? 'Multicast Group' : 'Source IP'}</label>
                    <input className="cme-cell mono" value={s.ip}
                      onChange={e => patchStream(s.id, { ip: e.target.value })}/>
                  </div>
                  <div className="sc-field">
                    <label>Source Port</label>
                    <input type="number" className="cme-cell mono" value={s.port}
                      onChange={e => patchStream(s.id, { port: +e.target.value })}/>
                  </div>
                  <div className="sc-field">
                    <label>Local Bind Port</label>
                    <input type="number" className="cme-cell mono" value={s.bindPort}
                      onChange={e => patchStream(s.id, { bindPort: +e.target.value })}/>
                  </div>
                  <div className="sc-field">
                    <label>TTL</label>
                    <input type="number" className="cme-cell mono" value={s.ttl}
                      onChange={e => patchStream(s.id, { ttl: +e.target.value })}/>
                  </div>
                </div>

                <div style={{ marginTop:16, padding:12, background:'var(--bg-1)', border:'1px solid var(--line-1)' }}>
                  <div style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>
                    Buffering & pacing
                  </div>
                  <div className="sc-grid">
                    <div className="sc-field">
                      <label>SO_RCVBUF</label>
                      <input defaultValue="16 MiB" className="cme-cell mono"/>
                    </div>
                    <div className="sc-field">
                      <label>Ring depth (frames)</label>
                      <input defaultValue="4096" type="number" className="cme-cell mono"/>
                    </div>
                    <div className="sc-field">
                      <label>Drop-on-overflow</label>
                      <select className="cme-cell" defaultValue="oldest">
                        <option>oldest</option><option>newest</option><option>block</option>
                      </select>
                    </div>
                    <div className="sc-field">
                      <label>CPU affinity</label>
                      <input defaultValue="core 3" className="cme-cell mono"/>
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab === 'framing' && (
              <>
                <div className="sc-grid">
                  <div className="sc-field">
                    <label>Sync pattern (hex)</label>
                    <input className="cme-cell mono" value={s.syncPattern}
                      onChange={e => patchStream(s.id, { syncPattern: e.target.value.toUpperCase() })}/>
                  </div>
                  <div className="sc-field">
                    <label>Sync width (bits)</label>
                    <select value={s.syncMaskBits} onChange={e => patchStream(s.id, { syncMaskBits: +e.target.value })} className="cme-cell mono">
                      {[8, 16, 24, 32, 48, 64].map(n => <option key={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="sc-field">
                    <label>Byte order</label>
                    <select value={s.byteOrder} onChange={e => patchStream(s.id, { byteOrder: e.target.value })} className="cme-cell">
                      <option value="little">little-endian</option>
                      <option value="big">big-endian</option>
                    </select>
                  </div>
                  <div className="sc-field">
                    <label>Frame size (bytes)</label>
                    <input type="number" className="cme-cell mono" value={s.frameSize}
                      onChange={e => patchStream(s.id, { frameSize: +e.target.value })}/>
                  </div>
                  <div className="sc-field">
                    <label>Frame period (ms)</label>
                    <input type="number" step="0.1" className="cme-cell mono" value={s.periodMs}
                      onChange={e => patchStream(s.id, { periodMs: +e.target.value })}/>
                  </div>
                  <div className="sc-field">
                    <label>Effective rate</label>
                    <div className="cme-cell mono" style={{ color:'var(--amber-0)', padding:'3px 6px', background:'var(--bg-0)' }}>
                      {s.periodMs > 0 ? (1000 / s.periodMs).toFixed(2) : '—'} Hz · {expMbps.toFixed(2)} Mbps exp
                    </div>
                  </div>
                  <div className="sc-field">
                    <label>CRC algorithm</label>
                    <select value={s.crc} onChange={e => patchStream(s.id, { crc: e.target.value })} className="cme-cell mono">
                      {CRC_OPTS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="sc-field">
                    <label>CRC offset</label>
                    <input type="number" className="cme-cell mono" value={s.crcOffset}
                      disabled={s.crc === 'none'}
                      onChange={e => patchStream(s.id, { crcOffset: +e.target.value })}/>
                  </div>
                </div>

                <div style={{ marginTop:16 }}>
                  <div style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>
                    Sync pattern · bit view
                  </div>
                  <div style={{ background:'var(--bg-0)', border:'1px solid var(--line-1)', padding:10 }}>
                    <SyncPatternStrip pattern={s.syncPattern} maskBits={s.syncMaskBits}/>
                    <div style={{ marginTop:6, fontSize:10, color:'var(--fg-2)', fontFamily:'JetBrains Mono' }}>
                      0x{s.syncPattern.toUpperCase()} · {s.syncMaskBits}-bit · {s.byteOrder}-endian ·
                      RX searches every {s.frameSize}B for this pattern; lock achieved after 3 consecutive matches.
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab === 'security' && (
              <>
                <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:'var(--fg-0)', marginBottom:12 }}>
                  <input type="checkbox" checked={s.aes.enabled}
                    onChange={e => patchStream(s.id, { aes: { ...s.aes, enabled: e.target.checked, mode: e.target.checked && s.aes.mode === 'none' ? 'AES-256-CTR' : s.aes.mode }})}
                    style={{ accentColor:'var(--amber-1)' }}/>
                  Payload decryption enabled
                </label>
                <div className="sc-grid" style={{ opacity: s.aes.enabled ? 1 : 0.45 }}>
                  <div className="sc-field">
                    <label>Cipher</label>
                    <select value={s.aes.mode} disabled={!s.aes.enabled}
                      onChange={e => patchStream(s.id, { aes: { ...s.aes, mode: e.target.value }})}
                      className="cme-cell mono">
                      {AES_MODE_OPTS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="sc-field">
                    <label>IV source</label>
                    <select value={s.aes.iv || 'per-frame · header IV'} disabled={!s.aes.enabled}
                      onChange={e => patchStream(s.id, { aes: { ...s.aes, iv: e.target.value }})}
                      className="cme-cell">
                      <option>per-frame · header IV</option>
                      <option>explicit · 96-bit</option>
                      <option>counter · from frame_counter</option>
                      <option>random · per-session</option>
                    </select>
                  </div>
                  <div className="sc-field" style={{ gridColumn:'1 / span 2' }}>
                    <label>Key label (from KMS)</label>
                    <input className="cme-cell mono" value={s.aes.keyLabel} disabled={!s.aes.enabled}
                      onChange={e => patchStream(s.id, { aes: { ...s.aes, keyLabel: e.target.value }})}/>
                  </div>
                  <div className="sc-field" style={{ gridColumn:'1 / span 2' }}>
                    <label>Key fingerprint</label>
                    <div className="cme-cell mono" style={{ color:'var(--fg-1)', background:'var(--bg-0)', padding:'3px 6px' }}>
                      {s.aes.keyFp || '—'}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop:16, padding:12, background:'var(--bg-1)', border:'1px solid var(--line-1)' }}>
                  <div style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>
                    Key management
                  </div>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                    <button className="tb-btn" disabled={!s.aes.enabled}>Load from KMS…</button>
                    <button className="tb-btn" disabled={!s.aes.enabled}>Import PEM…</button>
                    <button className="tb-btn" disabled={!s.aes.enabled}>Rotate now</button>
                    <button className="tb-btn" disabled={!s.aes.enabled}>Zeroize</button>
                  </div>
                  <div style={{ marginTop:10, fontSize:10, color:'var(--fg-3)', fontFamily:'JetBrains Mono' }}>
                    Keys never leave the receiver. Wrapped by hardware KEK · scrubbed on process exit.
                  </div>
                </div>
              </>
            )}

            {tab === 'layout' && (
              <>
                <div style={{ display:'flex', alignItems:'center', marginBottom:8 }}>
                  <div style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1 }}>
                    Frame layout · {s.frameSize} bytes
                  </div>
                  <div style={{ flex:1 }}/>
                  <button className="tb-btn" onClick={() => addRegion(s.id)}>+ Add region</button>
                </div>

                <div style={{ background:'var(--bg-0)', border:'1px solid var(--line-1)', padding:10, marginBottom:12 }}>
                  <FrameLayoutStrip frameSize={s.frameSize} regions={s.regions}
                    selectedId={selRegionId} onSelect={setSelRegionId}/>
                </div>

                {/* Region table */}
                <div style={{ background:'var(--bg-0)', border:'1px solid var(--line-1)' }}>
                  <div style={{
                    display:'grid',
                    gridTemplateColumns:'16px 1.2fr 0.8fr 0.7fr 0.7fr 0.7fr 24px',
                    gap:4, padding:'5px 8px',
                    fontSize:9, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:0.8,
                    background:'var(--bg-2)', borderBottom:'1px solid var(--line-1)' }}>
                    <span/>
                    <span>Name</span>
                    <span>Kind</span>
                    <span style={{ textAlign:'right' }}>Offset</span>
                    <span style={{ textAlign:'right' }}>Length</span>
                    <span style={{ textAlign:'right' }}>End</span>
                    <span/>
                  </div>
                  {s.regions.map(r => {
                    const hi = selRegionId === r.id;
                    return (
                      <div key={r.id} onClick={() => setSelRegionId(r.id)}
                        style={{
                          display:'grid',
                          gridTemplateColumns:'16px 1.2fr 0.8fr 0.7fr 0.7fr 0.7fr 24px',
                          gap:4, padding:'4px 8px',
                          borderTop:'1px solid var(--line-0)',
                          background: hi ? 'var(--bg-3)' : 'transparent',
                          cursor:'pointer', alignItems:'center',
                        }}>
                        <span style={{
                          display:'inline-block', width:10, height:10, background: r.color,
                          border:'1px solid rgba(0,0,0,0.4)',
                        }}/>
                        <input value={r.name} onClick={e => e.stopPropagation()}
                          onChange={e => patchRegion(s.id, r.id, { name: e.target.value })}
                          className="cme-cell"/>
                        <select value={r.kind} onClick={e => e.stopPropagation()}
                          onChange={e => {
                            const kk = REGION_KINDS.find(k => k.k === e.target.value);
                            patchRegion(s.id, r.id, { kind: e.target.value, color: kk?.color || r.color });
                          }}
                          className="cme-cell mono" style={{ color: r.color }}>
                          {REGION_KINDS.map(k => <option key={k.k} value={k.k}>{k.label}</option>)}
                        </select>
                        <input type="number" value={r.offset} onClick={e => e.stopPropagation()}
                          onChange={e => patchRegion(s.id, r.id, { offset: +e.target.value })}
                          className="cme-cell mono" style={{ textAlign:'right' }}/>
                        <input type="number" value={r.length} onClick={e => e.stopPropagation()}
                          onChange={e => patchRegion(s.id, r.id, { length: +e.target.value })}
                          className="cme-cell mono" style={{ textAlign:'right' }}/>
                        <span className="mono" style={{ textAlign:'right', paddingRight:6, color:'var(--fg-2)', fontSize:10 }}>
                          {r.offset + r.length}
                        </span>
                        <button onClick={e => { e.stopPropagation(); delRegion(s.id, r.id); }}
                          style={{ background:'transparent', border:'none', color:'var(--fg-3)', cursor:'pointer', fontSize:13 }}>×</button>
                      </div>
                    );
                  })}
                </div>

                <div style={{ marginTop:10, fontSize:9.5, color:'var(--fg-3)', display:'flex', gap:14, flexWrap:'wrap',
                  textTransform:'uppercase', letterSpacing:0.8 }}>
                  <span>video regions: <span style={{ color: s.regions.some(r=>r.kind==='video') ? 'var(--s4)' : 'var(--fg-2)' }}>
                    {s.regions.filter(r => r.kind === 'video').length}
                  </span></span>
                  <span>digital regions: <span style={{ color:'var(--amber-0)' }}>{s.regions.filter(r => r.kind === 'digital').length}</span></span>
                  <span>used: <span style={{ color:'var(--fg-1)' }}>
                    {s.regions.reduce((a,r)=>a+r.length,0)}</span> / {s.frameSize}B
                  </span>
                  <span>pad: <span style={{ color:'var(--fg-1)' }}>
                    {Math.max(0, s.frameSize - s.regions.reduce((a,r)=>a+r.length,0))}B
                  </span></span>
                </div>
              </>
            )}

            {tab === 'diagnostics' && (
              <>
                <div style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>
                  Live receive status
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10 }}>
                  {[
                    { label:'RX data rate', v: `${s.stat.rxMbps.toFixed(2)} Mbps`, sub: `exp ${expMbps.toFixed(2)} · Δ${rxDelta>=0?'+':''}${rxDelta.toFixed(2)} (${rxDeltaPct>=0?'+':''}${rxDeltaPct.toFixed(1)}%)`, color: Math.abs(rxDeltaPct)<5 ? 'var(--ok)' : Math.abs(rxDeltaPct)<20 ? 'var(--warn)' : 'var(--alarm)' },
                    { label:'Packets/sec', v: s.stat.pktPerSec.toFixed(0), sub: `exp ${s.periodMs>0?(1000/s.periodMs).toFixed(0):'—'}/s`, color:'var(--amber-0)' },
                    { label:'Sync state', v: s.stat.locked ? 'LOCKED' : 'NO LOCK', sub: s.stat.lastSyncMs === null ? 'never' : `last ${s.stat.lastSyncMs}ms ago`, color: s.stat.locked ? 'var(--ok)' : 'var(--alarm)' },
                    { label:'CRC errors', v: `${s.stat.crcErrPerMin}/min`, sub: s.crc, color: s.stat.crcErrPerMin===0 ? 'var(--ok)' : 'var(--warn)' },
                    { label:'Frame drops', v: `${s.stat.dropPerMin}/min`, sub: 'ring overflow + gap', color: s.stat.dropPerMin===0 ? 'var(--ok)' : 'var(--warn)' },
                    { label:'Sync losses', v: `${s.stat.syncLossPerMin}/min`, sub: 'since last lock', color: s.stat.syncLossPerMin===0 ? 'var(--ok)' : 'var(--alarm)' },
                    { label:'Decrypt', v: s.aes.enabled ? 'OK' : 'BYPASS', sub: s.aes.enabled ? s.aes.mode : 'plaintext', color: s.aes.enabled ? 'var(--pinned)' : 'var(--fg-3)' },
                    { label:'Uptime', v: s.enabled ? '02:14:37' : '—', sub: s.enabled ? 'since apply' : 'disabled', color:'var(--fg-1)' },
                  ].map(card => (
                    <div key={card.label} style={{
                      background:'var(--bg-1)', border:'1px solid var(--line-1)', padding:'10px 12px',
                    }}>
                      <div style={{ fontSize:9, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1 }}>
                        {card.label}
                      </div>
                      <div style={{ fontSize:18, fontFamily:'JetBrains Mono', color: card.color, marginTop:3 }}>{card.v}</div>
                      <div style={{ fontSize:9.5, color:'var(--fg-2)', marginTop:2, fontFamily:'JetBrains Mono' }}>{card.sub}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop:14, fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>
                  Last 60s rx rate
                </div>
                <div style={{ background:'var(--bg-0)', border:'1px solid var(--line-1)', padding:10 }}>
                  <svg viewBox="0 0 600 90" style={{ width:'100%', height:90 }}>
                    <line x1="0" y1="20" x2="600" y2="20" stroke="var(--warn)" strokeDasharray="3 3" opacity="0.5"/>
                    <text x="598" y="18" textAnchor="end" fontSize="9" fill="var(--warn)" fontFamily="JetBrains Mono">expected</text>
                    {(() => {
                      const pts = Array.from({ length: 60 }).map((_, i) => {
                        const jitter = Math.sin(i * 0.3) * 1.2 + Math.sin(i * 0.07) * 2;
                        const drop = (s.stat.locked ? 0 : 1) * Math.max(0, Math.sin(i * 0.4));
                        const val = s.stat.rxMbps + jitter - drop * s.stat.rxMbps * 0.9;
                        return Math.max(0.1, val);
                      });
                      const max = Math.max(expMbps * 1.4, ...pts, 1);
                      const path = pts.map((v, i) => {
                        const x = (i / 59) * 600;
                        const y = 80 - (v / max) * 70;
                        return (i === 0 ? 'M' : 'L') + x + ' ' + y;
                      }).join(' ');
                      const area = path + ' L600 80 L0 80 Z';
                      return (
                        <>
                          <path d={area} fill="var(--amber-1)" opacity="0.12"/>
                          <path d={path} fill="none" stroke="var(--amber-0)" strokeWidth="1.5"/>
                        </>
                      );
                    })()}
                  </svg>
                </div>

                <div style={{ marginTop:12, display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button className="tb-btn">Capture pcap · 30s</button>
                  <button className="tb-btn">Hex dump next frame</button>
                  <button className="tb-btn">Force resync</button>
                  <button className="tb-btn">Reset counters</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* bottom */}
      <div style={{ height:26, borderTop:'1px solid var(--line-1)', background:'var(--bg-2)',
        display:'flex', alignItems:'center', padding:'0 16px', gap:14,
        fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:0.8 }}>
        <span>config: <span style={{ color:'var(--fg-1)' }}>rx.streams.yaml</span></span>
        <span>·</span>
        <span>last apply: <span className="mono" style={{ color:'var(--fg-2)' }}>2026-04-20 14:02:11</span></span>
        <div style={{ flex:1 }}/>
        <span>apply requires RX restart · ~120ms interruption</span>
      </div>
    </div>
  );
}

Object.assign(window, { StreamConfigModal, StatusLED, streamHealth, STREAM_DEFS });

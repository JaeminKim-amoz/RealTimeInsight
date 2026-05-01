// Channel Mapping Editor — spreadsheet + inspector for IRIG TMATS calibration.
// Adds: Y-axis default ranges, alarm rule-base, bit-level sub-com packing,
// and embedded sub-channels (digital bitfields packed inside one parent channel).

const CME_CHANNELS = [
  { id: 1001, name: 'bus_volt_28v',  pkt: 'P01', dfmt: 'f32', word: 'W1',  lsb: 0,  bits: 16, rate: 100,
    subcomId: '—',    subcomMult: 1,  parentCh: null,
    gain: 1.0,  offset: 0.0,   eu: 'V',   fmla: 'raw * 0.004882 + 0.0',
    yAuto: false, yMin: 22, yMax: 32, yUnit: 'V',
    rules: [
      { id:'r1', kind:'warn',  op:'<',  a:24,  hyst:0.3, dwell:100, enabled:true },
      { id:'r2', kind:'alarm', op:'<',  a:22,  hyst:0.3, dwell:50,  enabled:true },
      { id:'r3', kind:'alarm', op:'>',  a:30,  hyst:0.3, dwell:50,  enabled:true },
    ],
    embedded: [], spec: null, notes: '28V main bus' },

  { id: 1002, name: 'bus_cur_28v',   pkt: 'P01', dfmt: 'f32', word: 'W2',  lsb: 0,  bits: 16, rate: 100,
    subcomId: '—',    subcomMult: 1,  parentCh: null,
    gain: 0.01, offset: 0.0, eu: 'A',   fmla: 'raw * 0.01',
    yAuto: false, yMin: 0, yMax: 50, yUnit: 'A',
    rules: [
      { id:'r1', kind:'warn',  op:'>',  a:30,  hyst:1.0, dwell:200, enabled:true },
      { id:'r2', kind:'alarm', op:'>',  a:40,  hyst:1.0, dwell:50,  enabled:true },
    ],
    embedded: [], spec: null, notes: 'Hall-effect HC-50' },

  { id: 1007, name: 'pdu_word',      pkt: 'P01', dfmt: 'u16', word: 'W4',  lsb: 0,  bits: 16, rate: 50,
    subcomId: '—',    subcomMult: 1,  parentCh: null,
    gain: 1, offset: 0, eu: '', fmla: 'raw',
    yAuto: true, yMin: 0, yMax: 65535, yUnit: '',
    rules: [],
    embedded: [
      { id:'e1', subId: 1007.1, name: 'pdu.bit_inv_fail',     startBit: 0,  width: 1, kind: 'bool', rate: 50,  states: ['ok','fail'] },
      { id:'e2', subId: 1007.2, name: 'pdu.bit_ovt',          startBit: 1,  width: 1, kind: 'bool', rate: 50,  states: ['ok','overtemp'] },
      { id:'e3', subId: 1007.3, name: 'pdu.bit_uv',           startBit: 2,  width: 1, kind: 'bool', rate: 50,  states: ['ok','undervolt'] },
      { id:'e4', subId: 1007.4, name: 'pdu.mode',             startBit: 3,  width: 3, kind: 'enum', rate: 50,  states: ['init','bit','run','std','xfer','ramp','hold','end'] },
      { id:'e5', subId: 1007.5, name: 'pdu.fault_code',       startBit: 6,  width: 6, kind: 'uint', rate: 50 },
      { id:'e6', subId: 1007.6, name: 'pdu.bitmask_reserved', startBit: 12, width: 4, kind: 'bits', rate: 50 },
    ],
    spec: null, notes: 'PDU composite BIT word — embedded sub-channels decoded from bit positions' },

  { id: 1205, name: 'hyd_pA', pkt: 'P02', dfmt: 'i16', word: 'W1', lsb: 0, bits: 14, rate: 200,
    subcomId: 'SC-01', subcomMult: 4, parentCh: null,
    gain: 0.25, offset: -100.0, eu: 'bar', fmla: '(raw * 0.25) - 100.0',
    yAuto: false, yMin: 0, yMax: 220, yUnit: 'bar',
    rules: [
      { id:'r1', kind:'warn',   op:'>',        a:180, hyst:2, dwell:100, enabled:true },
      { id:'r2', kind:'alarm',  op:'>',        a:205, hyst:2, dwell:50,  enabled:true },
      { id:'r3', kind:'alarm',  op:'<',        a:60,  hyst:2, dwell:100, enabled:true },
      { id:'r4', kind:'anom',   op:'rate>',    a:50,  hyst:0, dwell:300, enabled:true },
      { id:'r5', kind:'info',   op:'outside',  a:80,  b:200, hyst:0, dwell:0, enabled:false },
    ],
    embedded: [], spec: null, notes: 'Kulite XTM-190 · rate alarm = spike detect' },

  { id: 1206, name: 'hyd_pB', pkt: 'P02', dfmt: 'i16', word: 'W2', lsb: 0, bits: 14, rate: 200,
    subcomId: 'SC-01', subcomMult: 4, parentCh: null,
    gain: 0.25, offset: -100.0, eu: 'bar', fmla: '(raw * 0.25) - 100.0',
    yAuto: false, yMin: 0, yMax: 220, yUnit: 'bar',
    rules: [
      { id:'r1', kind:'alarm', op:'>', a:205, hyst:2, dwell:50, enabled:true },
      { id:'r2', kind:'alarm', op:'<', a:60,  hyst:2, dwell:100, enabled:true },
    ],
    embedded: [], spec: null, notes: '' },

  { id: 1210, name: 'hyd_discretes', pkt:'P02', dfmt:'u8', word:'W3', lsb: 0, bits: 8, rate: 50,
    subcomId: '—', subcomMult: 1, parentCh: null,
    gain: 1, offset: 0, eu: '', fmla: 'raw',
    yAuto: false, yMin: 0, yMax: 255, yUnit: '',
    rules: [],
    embedded: [
      { id:'e1', subId: 1210.1, name: 'hyd.valve_bypass',   startBit: 0, width: 1, kind: 'bool', rate: 50, states: ['closed','open'] },
      { id:'e2', subId: 1210.2, name: 'hyd.pump_sel',       startBit: 1, width: 2, kind: 'enum', rate: 50, states: ['none','A','B','A+B'] },
      { id:'e3', subId: 1210.3, name: 'hyd.res_lo',         startBit: 3, width: 1, kind: 'bool', rate: 50, states: ['ok','low'] },
      { id:'e4', subId: 1210.4, name: 'hyd.filter_bypass',  startBit: 4, width: 1, kind: 'bool', rate: 50, states: ['normal','bypass'] },
      { id:'e5', subId: 1210.5, name: 'hyd.bit_fail',       startBit: 5, width: 3, kind: 'bits', rate: 50 },
    ],
    spec: null, notes: 'Composite discrete word — 5 embedded sub-channels' },

  { id: 2210, name: 'imu_roll',  pkt: 'P04', dfmt: 'f32', word: 'W1', lsb: 0, bits: 32, rate: 400,
    subcomId: '—', subcomMult: 1, parentCh: null,
    gain: 1.0, offset: 0.0, eu: 'deg', fmla: 'raw',
    yAuto: false, yMin: -180, yMax: 180, yUnit: 'deg',
    rules: [ { id:'r1', kind:'warn', op:'|>|', a:60, hyst:1, dwell:100, enabled:true } ],
    embedded: [], spec: null, notes: 'IMU 400Hz' },
  { id: 2211, name: 'imu_pitch', pkt: 'P04', dfmt: 'f32', word: 'W2', lsb: 0, bits: 32, rate: 400,
    subcomId: '—', subcomMult: 1, parentCh: null,
    gain: 1.0, offset: 0.0, eu: 'deg', fmla: 'raw',
    yAuto: false, yMin: -90, yMax: 90, yUnit: 'deg',
    rules: [ { id:'r1', kind:'warn', op:'|>|', a:30, hyst:1, dwell:100, enabled:true } ],
    embedded: [], spec: null, notes: '' },
  { id: 2212, name: 'imu_yaw',   pkt: 'P04', dfmt: 'f32', word: 'W3', lsb: 0, bits: 32, rate: 400,
    subcomId: '—', subcomMult: 1, parentCh: null,
    gain: 1.0, offset: 0.0, eu: 'deg', fmla: 'unwrap(raw)',
    yAuto: false, yMin: 0, yMax: 360, yUnit: 'deg',
    rules: [], embedded: [], spec: null, notes: '' },
  { id: 2215, name: 'accel_z',   pkt: 'P04', dfmt: 'i16', word: 'W7', lsb: 0, bits: 16, rate: 1000,
    subcomId: 'SC-02', subcomMult: 10, parentCh: null,
    gain: 0.001, offset: 0.0, eu: 'g', fmla: 'raw * 0.001',
    yAuto: false, yMin: -3, yMax: 9, yUnit: 'g',
    rules: [
      { id:'r1', kind:'warn',  op:'>', a:6, hyst:0.2, dwell:50, enabled:true },
      { id:'r2', kind:'alarm', op:'>', a:8, hyst:0.2, dwell:30, enabled:true },
    ],
    embedded: [], spec: null, notes: 'high-rate accel' },
  { id: 2218, name: 'aoa', pkt: 'P04', dfmt: 'f32', word: 'W9', lsb: 0, bits: 32, rate: 100,
    subcomId: '—', subcomMult: 1, parentCh: null,
    gain: 1.0, offset: 0.0, eu: 'deg', fmla: 'raw',
    yAuto: false, yMin: -4, yMax: 20, yUnit: 'deg',
    rules: [
      { id:'r1', kind:'warn',  op:'>', a:12, hyst:0.3, dwell:200, enabled:true },
      { id:'r2', kind:'alarm', op:'>', a:14, hyst:0.3, dwell:100, enabled:true },
    ],
    embedded: [], spec: null, notes: '' },

  { id: 3501, name: 'gps_lat', pkt:'P05', dfmt:'f64', word:'W1', lsb:0, bits:64, rate:10,
    subcomId: 'SC-03', subcomMult: 0.1, parentCh: null,
    gain: 1.0, offset: 0.0, eu: 'deg', fmla: 'raw',
    yAuto: true, yMin: 36.0, yMax: 36.3, yUnit: 'deg',
    rules: [], embedded: [], spec: null, notes: 'WGS84' },
  { id: 3502, name: 'gps_lon', pkt:'P05', dfmt:'f64', word:'W2', lsb:0, bits:64, rate:10,
    subcomId: 'SC-03', subcomMult: 0.1, parentCh: null,
    gain: 1.0, offset: 0.0, eu: 'deg', fmla: 'raw',
    yAuto: true, yMin: 127.4, yMax: 127.7, yUnit: 'deg',
    rules: [], embedded: [], spec: null, notes: '' },
  { id: 3503, name: 'gps_alt', pkt:'P05', dfmt:'f32', word:'W3', lsb:0, bits:32, rate:10,
    subcomId: 'SC-03', subcomMult: 0.1, parentCh: null,
    gain: 1.0, offset: 0.0, eu: 'm', fmla: 'raw',
    yAuto: false, yMin: 0, yMax: 12000, yUnit: 'm',
    rules: [], embedded: [], spec: null, notes: '' },

  { id: 5001, name: 'rf_spectrum_l', pkt:'P07', dfmt:'spec', word:'W1+', lsb:0, bits:2048, rate:20,
    subcomId: '—', subcomMult: 1, parentCh: null,
    gain: 1.0, offset: 0.0, eu: 'dBm', fmla: 'fft(iq, 2048)',
    yAuto: false, yMin: -100, yMax: -20, yUnit: 'dBm',
    rules: [], embedded: [],
    spec: { fc: 1575.42, bw: 4, fftN: 2048, win: 'hann', avg: 4, unit: 'dBm' }, notes: 'L-band' },
  { id: 5002, name: 'link_rssi', pkt:'P07', dfmt:'i8', word:'W64', lsb: 0, bits: 8, rate: 20,
    subcomId: '—', subcomMult: 1, parentCh: null,
    gain: 0.5, offset: -70.0, eu: 'dBm', fmla: 'raw * 0.5 - 70',
    yAuto: false, yMin: -90, yMax: -40, yUnit: 'dBm',
    rules: [
      { id:'r1', kind:'warn',  op:'<', a:-75, hyst:1, dwell:500, enabled:true },
      { id:'r2', kind:'alarm', op:'<', a:-85, hyst:1, dwell:200, enabled:true },
    ],
    embedded: [], spec: null, notes: '' },
  { id: 5003, name: 'link_snr', pkt:'P07', dfmt:'u8', word:'W65', lsb: 0, bits: 8, rate: 20,
    subcomId: '—', subcomMult: 1, parentCh: null,
    gain: 0.1, offset: 0.0, eu: 'dB', fmla: 'raw * 0.1',
    yAuto: false, yMin: 0, yMax: 30, yUnit: 'dB',
    rules: [
      { id:'r1', kind:'warn', op:'<', a:12, hyst:0.5, dwell:300, enabled:true },
    ],
    embedded: [], spec: null, notes: '' },

  { id: 7001, name: 'cam_front', pkt:'P09', dfmt:'h264', word:'—', lsb: 0, bits: 0, rate: 30,
    subcomId: '—', subcomMult: 1, parentCh: null,
    gain: 1, offset: 0, eu: '', fmla: '—',
    yAuto: true, yMin: 0, yMax: 0, yUnit: '',
    rules: [], embedded: [], spec: null, notes: 'H.264 Main@L4 1920x1080' },

  { id: 8001, name: 'frame_counter', pkt:'P00', dfmt:'u16', word:'W0', lsb: 0, bits: 16, rate: 200,
    subcomId: '—', subcomMult: 1, parentCh: null,
    gain: 1, offset: 0, eu: 'count', fmla: 'raw',
    yAuto: true, yMin: 0, yMax: 65535, yUnit: 'count',
    rules: [
      { id:'r1', kind:'alarm', op:'seq_break', a:0, hyst:0, dwell:0, enabled:true },
    ],
    embedded: [], spec: null, notes: 'Monotonic frame counter — used by gap() for dropped-frame detection' },
  { id: 8002, name: 'frame_gap', pkt:'—', dfmt:'u16', word:'—', lsb: 0, bits: 16, rate: 200,
    subcomId: '—', subcomMult: 1, parentCh: null,
    gain: 1, offset: 0, eu: 'frames', fmla: 'gap(ch(8001), 65536)',
    yAuto: false, yMin: 0, yMax: 10, yUnit: 'frames',
    rules: [
      { id:'r1', kind:'warn',  op:'>', a:1, hyst:0, dwell:0, enabled:true },
      { id:'r2', kind:'alarm', op:'>', a:5, hyst:0, dwell:0, enabled:true },
    ],
    embedded: [], spec: null, notes: 'DERIVED continuity check · gap() on frame_counter — should be 1 per frame' },
  { id: 8003, name: 'pcm_seq', pkt:'P06', dfmt:'u8', word:'W1', lsb: 0, bits: 8, rate: 1000,
    subcomId: '—', subcomMult: 1, parentCh: null,
    gain: 1, offset: 0, eu: '', fmla: 'miss(raw, 1)',
    yAuto: false, yMin: 0, yMax: 4, yUnit: 'missed',
    rules: [
      { id:'r1', kind:'alarm', op:'>', a:0, hyst:0, dwell:0, enabled:true },
    ],
    embedded: [], spec: null, notes: 'PCM minor-frame seq wraps 0..255 · miss() counts drops' },

  { id: 9001, name: 'derived_power', pkt:'—', dfmt:'f32', word:'—', lsb: 0, bits: 32, rate: 100,
    subcomId: '—', subcomMult: 1, parentCh: null,
    gain: 1.0, offset: 0.0, eu: 'W', fmla: 'ch(1001) * ch(1002)',
    yAuto: false, yMin: 0, yMax: 1200, yUnit: 'W',
    rules: [], embedded: [], spec: null, notes: 'DERIVED V×I' },
  { id: 9002, name: 'derived_qbar', pkt:'—', dfmt:'f32', word:'—', lsb: 0, bits: 32, rate: 100,
    subcomId: '—', subcomMult: 1, parentCh: null,
    gain: 1.0, offset: 0.0, eu: 'Pa', fmla: '0.5 * rho(ch(3503)) * pow(ch(2217), 2)',
    yAuto: false, yMin: 0, yMax: 20000, yUnit: 'Pa',
    rules: [], embedded: [], spec: null, notes: 'DERIVED q-bar' },
];

const CME_FUNCTIONS = [
  { name: 'raw',       args: '',                      desc: 'Raw counts (pre-scale)' },
  { name: 'ch',        args: '(id)',                  desc: 'Reference another channel' },
  { name: 'prev',      args: '(ch, n=1)',             desc: 'Value n frames ago' },
  { name: 'gap',       args: '(raw, mod=2^bits)',     desc: 'Counter gap · (raw − prev) mod — detects dropped frames' },
  { name: 'miss',      args: '(raw, step=1)',         desc: 'Missing-frame count since last sample' },
  { name: 'cont_ok',   args: '(raw, step=1)',         desc: 'Boolean: continuous (no gap since prev)' },
  { name: 'seq_break', args: '(raw)',                 desc: 'Sequence-break flag (counter regressed)' },
  { name: 'stale_ms',  args: '()',                    desc: 'ms since last update' },
  { name: 'bits',      args: '(raw, a..b)',           desc: 'Extract bit range a..b' },
  { name: 'bit',       args: '(raw, n)',              desc: 'Single bit n' },
  { name: 'unwrap',    args: '(angle_deg)',           desc: 'Unwrap ±180°' },
  { name: 'clamp',     args: '(x, min, max)',         desc: 'Clamp [min,max]' },
  { name: 'lerp',      args: '(x,x0,x1,y0,y1)',       desc: 'Linear map' },
  { name: 'poly',      args: '(x, [a0,a1,...])',      desc: 'Polynomial' },
  { name: 'fft',       args: '(iq, N)',               desc: 'FFT N-point' },
  { name: 'rho',       args: '(alt_m)',               desc: 'ISA air density' },
  { name: 'pow',       args: '(x, n)',                desc: 'x^n' },
  { name: 'sqrt',      args: '(x)',                   desc: '√x' },
  { name: 'sin',       args: '(x)',                   desc: 'sin (rad)' },
  { name: 'cos',       args: '(x)',                   desc: 'cos (rad)' },
  { name: 'deg2rad',   args: '(x)',                   desc: 'deg→rad' },
  { name: 'rad2deg',   args: '(x)',                   desc: 'rad→deg' },
  { name: 'movavg',    args: '(x, n)',                desc: 'Rolling mean' },
  { name: 'deriv',     args: '(x)',                   desc: 'd/dt' },
  { name: 'integ',     args: '(x)',                   desc: '∫x dt' },
  { name: 'iir',       args: '(x, fc, order)',        desc: 'IIR LP' },
];

const DFMT_OPTS    = ['u1','u4','u8','i8','u16','i16','u32','i32','f32','f64','spec','h264','enum'];
const SUBCOM_IDS   = ['—','SC-01','SC-02','SC-03','SC-04','SC-05'];
const RULE_KINDS   = [
  { k:'info',  label:'INFO',  color:'var(--info, #6b9bd1)' },
  { k:'warn',  label:'WARN',  color:'var(--warn)' },
  { k:'alarm', label:'ALARM', color:'var(--alarm)' },
  { k:'anom',  label:'ANOM',  color:'#b06ed1' },
];
const RULE_OPS = ['<','<=','>','>=','==','!=','|>|','inside','outside','rate>','rate<','stuck','nan'];
const SUB_KINDS = ['bool','enum','uint','int','bits'];

function FormulaCell({ value, onChange, onFocus, onBlur }) {
  const inputRef = useRef(null);
  const [sug, setSug] = useState({ open: false, items: [], pos: 0 });

  const update = (v) => {
    onChange(v);
    const m = v.slice(0, inputRef.current?.selectionEnd ?? v.length).match(/([a-zA-Z_][a-zA-Z0-9_]*)$/);
    if (m) {
      const token = m[1].toLowerCase();
      const items = CME_FUNCTIONS.filter(f => f.name.toLowerCase().startsWith(token)).slice(0, 8);
      setSug({ open: items.length > 0, items, pos: 0, token, at: m.index });
    } else setSug(s => ({ ...s, open: false }));
  };
  const choose = (fn) => {
    if (!inputRef.current) return;
    const caret = inputRef.current.selectionEnd ?? value.length;
    const before = value.slice(0, sug.at ?? caret);
    const after = value.slice(caret);
    const inserted = fn.name + (fn.args.startsWith('(') ? fn.args : '');
    onChange(before + inserted + after);
    setSug(s => ({ ...s, open: false }));
    requestAnimationFrame(() => {
      if (inputRef.current) {
        const n = before.length + fn.name.length + (fn.args.startsWith('(') ? 1 : 0);
        inputRef.current.setSelectionRange(n, n);
        inputRef.current.focus();
      }
    });
  };
  const handleKey = (e) => {
    if (!sug.open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSug(s => ({ ...s, pos: Math.min(s.pos+1, s.items.length-1) })); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSug(s => ({ ...s, pos: Math.max(s.pos-1, 0) })); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); choose(sug.items[sug.pos]); }
    else if (e.key === 'Escape') { setSug(s => ({ ...s, open: false })); }
  };
  return (
    <div style={{ position: 'relative' }}>
      <input ref={inputRef} value={value}
        onChange={e => update(e.target.value)} onKeyDown={handleKey}
        onFocus={onFocus}
        onBlur={() => { setTimeout(() => setSug(s=>({ ...s, open:false })), 150); onBlur&&onBlur(); }}
        className="cme-cell cme-formula" spellCheck={false}/>
      {sug.open && (
        <div style={{ position:'absolute', top:'100%', left:0, zIndex:100, minWidth:280,
          background:'var(--bg-2)', border:'1px solid var(--amber-1)',
          boxShadow:'0 8px 20px rgba(0,0,0,0.6)', fontFamily:'JetBrains Mono, monospace', fontSize:10.5 }}>
          {sug.items.map((f, i) => (
            <div key={f.name} onMouseDown={(e)=>{ e.preventDefault(); choose(f); }}
              style={{ padding:'4px 8px', cursor:'pointer',
                background: i===sug.pos ? 'var(--bg-3)' : 'transparent',
                borderLeft: i===sug.pos ? '2px solid var(--amber-0)' : '2px solid transparent',
                display:'flex', gap:6, alignItems:'baseline' }}>
              <span style={{ color:'var(--amber-0)' }}>{f.name}</span>
              <span style={{ color:'var(--fg-2)' }}>{f.args}</span>
              <span style={{ color:'var(--fg-3)', marginLeft:'auto', fontSize:10 }}>{f.desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Visual: bit layout strip showing startBit/width placement for embedded sub-channels
function BitLayoutStrip({ bits, embedded, selectedSubId, onSelect }) {
  const W = 16; // px per bit
  const H = 28;
  const totalW = bits * W;
  const palette = ['#e5a24a','#6b9bd1','#b06ed1','#79a77a','#d08a5a','#6fb0b0','#c88a5a','#8a7fc4'];
  return (
    <svg viewBox={`0 0 ${totalW} ${H + 36}`} style={{ width: '100%', height: H + 36 }}>
      {/* base bits */}
      {Array.from({length: bits}).map((_, i) => {
        const bitIdx = bits - 1 - i; // MSB left
        return (
          <g key={i}>
            <rect x={i*W} y={10} width={W-1} height={H}
              fill="var(--bg-3)" stroke="var(--line-1)"/>
            <text x={i*W + W/2} y={10 + H/2 + 3} textAnchor="middle"
              fontSize="9" fill="var(--fg-3)" fontFamily="JetBrains Mono">{bitIdx}</text>
          </g>
        );
      })}
      {/* embedded overlays */}
      {embedded.map((sub, si) => {
        const c = palette[si % palette.length];
        const xLeft = (bits - (sub.startBit + sub.width)) * W;
        const w = sub.width * W - 1;
        const hi = selectedSubId === sub.subId;
        return (
          <g key={sub.id} onClick={() => onSelect(sub.subId)} style={{ cursor: 'pointer' }}>
            <rect x={xLeft} y={10} width={w} height={H}
              fill={c} opacity={hi ? 0.85 : 0.55}
              stroke={hi ? 'var(--amber-0)' : c} strokeWidth={hi ? 2 : 1}/>
            <text x={xLeft + w/2} y={10 + H/2 + 3} textAnchor="middle"
              fontSize="9" fill="#1a1614" fontFamily="JetBrains Mono"
              style={{ fontWeight: 600 }}>
              {sub.width === 1 ? `b${sub.startBit}` : `${sub.startBit}..${sub.startBit+sub.width-1}`}
            </text>
            <text x={xLeft + w/2} y={H + 24} textAnchor="middle"
              fontSize="9" fill="var(--fg-1)" fontFamily="JetBrains Mono">
              {sub.name.split('.').pop()}
            </text>
          </g>
        );
      })}
      {/* LSB/MSB labels */}
      <text x={2} y={8} fontSize="8" fill="var(--fg-3)" fontFamily="JetBrains Mono">MSB b{bits-1}</text>
      <text x={totalW-2} y={8} fontSize="8" fill="var(--fg-3)" fontFamily="JetBrains Mono" textAnchor="end">LSB b0</text>
    </svg>
  );
}

function RuleRow({ rule, yMin, yMax, onPatch, onDelete }) {
  const kind = RULE_KINDS.find(k => k.k === rule.kind) || RULE_KINDS[1];
  return (
    <div style={{
      display:'grid',
      gridTemplateColumns:'18px 60px 58px 60px 60px 52px 60px 24px',
      gap: 4, alignItems:'center', padding:'3px 4px',
      borderTop:'1px solid var(--line-0)',
      opacity: rule.enabled ? 1 : 0.45,
    }}>
      <input type="checkbox" checked={rule.enabled}
        onChange={e => onPatch({ enabled: e.target.checked })}
        style={{ accentColor:'var(--amber-1)' }}/>
      <select value={rule.kind}
        onChange={e => onPatch({ kind: e.target.value })}
        className="cme-cell" style={{
          color: kind.color,
          fontWeight: 500, letterSpacing: 0.8, textTransform:'uppercase', fontSize: 10,
        }}>
        {RULE_KINDS.map(k => <option key={k.k} value={k.k}>{k.label}</option>)}
      </select>
      <select value={rule.op} onChange={e => onPatch({ op: e.target.value })} className="cme-cell mono">
        {RULE_OPS.map(o => <option key={o}>{o}</option>)}
      </select>
      <input type="number" step="any" value={rule.a}
        onChange={e => onPatch({ a: +e.target.value })}
        className="cme-cell mono" style={{ textAlign:'right' }}/>
      {(rule.op === 'inside' || rule.op === 'outside') ? (
        <input type="number" step="any" value={rule.b ?? 0}
          onChange={e => onPatch({ b: +e.target.value })}
          className="cme-cell mono" style={{ textAlign:'right' }}/>
      ) : <span style={{ fontSize: 9, color:'var(--fg-3)', textAlign:'center' }}>—</span>}
      <input type="number" step="any" value={rule.hyst}
        onChange={e => onPatch({ hyst: +e.target.value })}
        className="cme-cell mono" style={{ textAlign:'right' }} title="hysteresis"/>
      <input type="number" value={rule.dwell}
        onChange={e => onPatch({ dwell: +e.target.value })}
        className="cme-cell mono" style={{ textAlign:'right' }} title="dwell (ms)"/>
      <button onClick={onDelete}
        style={{ background:'transparent', border:'none', color:'var(--fg-3)', cursor:'pointer', fontSize:13 }}>×</button>
    </div>
  );
}

// Visual: threshold map on y-axis range with colored zones
function ThresholdMap({ yMin, yMax, rules }) {
  if (yMax <= yMin) return null;
  const H = 60;
  const y = (v) => H - ((v - yMin) / (yMax - yMin)) * H;
  return (
    <svg viewBox={`0 0 280 ${H+20}`} style={{ width:'100%', height: H+20 }}>
      {/* range bar */}
      <rect x="40" y="0" width="220" height={H} fill="var(--bg-3)" stroke="var(--line-1)"/>
      {/* threshold bands */}
      {rules.filter(r => r.enabled && ['<','<=','>','>='].includes(r.op)).map((r, i) => {
        const col = RULE_KINDS.find(k => k.k===r.kind)?.color ?? 'var(--warn)';
        const yv = Math.max(0, Math.min(H, y(r.a)));
        const below = r.op.startsWith('<');
        return (
          <g key={r.id}>
            <rect x="40" y={below ? yv : 0} width="220"
              height={below ? H - yv : yv}
              fill={col} opacity="0.12"/>
            <line x1="40" x2="260" y1={yv} y2={yv}
              stroke={col} strokeWidth="1.4"
              strokeDasharray={r.kind==='warn' ? '4 2' : (r.kind==='alarm' ? '0' : '2 2')}/>
            <text x="266" y={yv+3} fontSize="9" fill={col} fontFamily="JetBrains Mono">{r.op}{r.a}</text>
            <text x="38" y={yv+3} fontSize="9" fill={col} fontFamily="JetBrains Mono" textAnchor="end">{r.kind.toUpperCase()}</text>
          </g>
        );
      })}
      {/* inside/outside bands */}
      {rules.filter(r => r.enabled && ['inside','outside'].includes(r.op)).map((r, i) => {
        const col = RULE_KINDS.find(k => k.k===r.kind)?.color ?? 'var(--warn)';
        const yA = y(Math.min(r.a, r.b ?? r.a));
        const yB = y(Math.max(r.a, r.b ?? r.a));
        return (
          <g key={r.id}>
            <rect x="40" y={yB} width="220" height={yA - yB} fill={col} opacity="0.08" stroke={col} strokeDasharray="2 2"/>
          </g>
        );
      })}
      {/* axis labels */}
      <text x="38" y={H} fontSize="9" fill="var(--fg-3)" fontFamily="JetBrains Mono" textAnchor="end">{yMin}</text>
      <text x="38" y={10}  fontSize="9" fill="var(--fg-3)" fontFamily="JetBrains Mono" textAnchor="end">{yMax}</text>
      <text x="150" y={H+16} textAnchor="middle" fontSize="9" fill="var(--fg-3)" textTransform="uppercase" fontFamily="JetBrains Mono">Y-AXIS · {yMin} — {yMax}</text>
    </svg>
  );
}

function ChannelMappingEditor({ open, onClose }) {
  const [rows, setRows] = useState(CME_CHANNELS);
  const [sel, setSel] = useState(1205);
  const [filter, setFilter] = useState('');
  const [dirty, setDirty] = useState(false);
  const [inspectorTab, setInspectorTab] = useState('commutation'); // commutation | yaxis | rules | embedded
  const [selSubId, setSelSubId] = useState(null);

  if (!open) return null;

  const updateRow = (id, patch) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r));
    setDirty(true);
  };
  const updateEmbedded = (id, subId, patch) => {
    setRows(rs => rs.map(r => r.id === id
      ? { ...r, embedded: r.embedded.map(e => e.subId === subId ? { ...e, ...patch } : e) }
      : r));
    setDirty(true);
  };
  const addEmbedded = (id) => {
    setRows(rs => rs.map(r => {
      if (r.id !== id) return r;
      const used = r.embedded.reduce((m, e) => Math.max(m, e.startBit + e.width), 0);
      const slot = Math.min(used, Math.max(0, r.bits - 1));
      const nextSub = (Math.max(...r.embedded.map(e => Math.floor(e.subId * 10) % 10), 0) + 1);
      return {
        ...r,
        embedded: [...r.embedded, {
          id: 'e' + Date.now(),
          subId: +(r.id + '.' + nextSub),
          name: r.name + '.new_sub',
          startBit: slot, width: 1, kind: 'bool', rate: r.rate,
          states: ['a','b'],
        }]
      };
    }));
    setDirty(true);
  };
  const delEmbedded = (id, subId) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, embedded: r.embedded.filter(e => e.subId !== subId) } : r));
    setDirty(true);
  };
  const addRule = (id) => {
    setRows(rs => rs.map(r => r.id === id
      ? { ...r, rules: [...r.rules, { id: 'r'+Date.now(), kind:'warn', op:'>', a:0, hyst:0, dwell:100, enabled:true }] }
      : r));
    setDirty(true);
  };
  const patchRule = (id, ruleId, patch) => {
    setRows(rs => rs.map(r => r.id === id
      ? { ...r, rules: r.rules.map(ru => ru.id === ruleId ? { ...ru, ...patch } : ru) }
      : r));
    setDirty(true);
  };
  const delRule = (id, ruleId) => {
    setRows(rs => rs.map(r => r.id === id
      ? { ...r, rules: r.rules.filter(ru => ru.id !== ruleId) }
      : r));
    setDirty(true);
  };

  const filtered = rows.filter(r =>
    !filter || r.name.includes(filter.toLowerCase()) || String(r.id).includes(filter) || r.pkt.toLowerCase().includes(filter.toLowerCase())
  );
  const selRow = rows.find(r => r.id === sel);

  // check bit-layout collisions in embedded
  const bitCollisions = (() => {
    if (!selRow) return new Set();
    const coll = new Set();
    for (let i=0; i<selRow.embedded.length; i++) {
      for (let j=i+1; j<selRow.embedded.length; j++) {
        const a = selRow.embedded[i], b = selRow.embedded[j];
        const aEnd = a.startBit + a.width;
        const bEnd = b.startBit + b.width;
        if (a.startBit < bEnd && b.startBit < aEnd) { coll.add(a.subId); coll.add(b.subId); }
      }
    }
    return coll;
  })();

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'var(--bg-0)',
      display:'flex', flexDirection:'column' }}>
      {/* header */}
      <div style={{ height:40, borderBottom:'1px solid var(--line-2)', background:'var(--bg-2)',
        display:'flex', alignItems:'center', padding:'0 16px', gap:14 }}>
        <span style={{ fontSize:11, fontWeight:600, letterSpacing:1.2, textTransform:'uppercase', color:'var(--amber-0)' }}>
          Channel Mapping Editor
        </span>
        <span style={{ fontSize:10, color:'var(--fg-3)', letterSpacing:1, textTransform:'uppercase' }}>
          TMATS IRIG-106 Ch10 · platform T-247 · rev 2026-04-20
        </span>
        {dirty && <span style={{ fontSize:10, color:'var(--warn)', letterSpacing:1, textTransform:'uppercase' }}>● unsaved</span>}
        <div style={{ flex:1 }}/>
        <input value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="filter by name / id / packet…"
          style={{ height:24, padding:'0 10px', width:240,
            background:'var(--bg-0)', border:'1px solid var(--line-1)',
            color:'var(--fg-0)', fontFamily:'inherit', fontSize:11 }}/>
        <button className="tb-btn">Import TMATS…</button>
        <button className="tb-btn">Validate</button>
        <button className="tb-btn primary">Save & Apply</button>
        <button className="tb-btn" onClick={onClose}>Close</button>
      </div>

      {/* summary bar */}
      <div style={{ height:28, borderBottom:'1px solid var(--line-1)', background:'var(--bg-1)',
        display:'flex', alignItems:'center', padding:'0 16px', gap:18,
        fontSize:10, color:'var(--fg-2)', textTransform:'uppercase', letterSpacing:0.8 }}>
        <span><span style={{ color:'var(--fg-0)' }}>{rows.length}</span> channels</span>
        <span><span style={{ color:'var(--fg-0)' }}>{rows.reduce((a,r)=>a+r.embedded.length,0)}</span> embedded sub-ch</span>
        <span><span style={{ color:'var(--fg-0)' }}>{rows.filter(r => r.subcomId !== '—').length}</span> sub/super-com</span>
        <span><span style={{ color:'var(--fg-0)' }}>{rows.reduce((a,r)=>a+r.rules.filter(x=>x.enabled).length,0)}</span> active rules</span>
        <span><span style={{ color:'var(--fg-0)' }}>{rows.filter(r => r.spec).length}</span> spectrum</span>
        <div style={{ flex:1 }}/>
        <span>selected: <span style={{ color:'var(--amber-0)' }}>{selRow?.name ?? '—'}</span></span>
      </div>

      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 460px', minHeight:0 }}>
        {/* main sheet */}
        <div style={{ overflow:'auto', borderRight:'1px solid var(--line-1)' }}>
          <table className="cme-sheet">
            <thead>
              <tr>
                <th style={{ width:30 }}>#</th>
                <th style={{ width:56 }}>ID</th>
                <th style={{ width:150 }}>Name</th>
                <th style={{ width:52 }}>Packet</th>
                <th style={{ width:64 }}>Data Type</th>
                <th style={{ width:56 }}>Word</th>
                <th style={{ width:44 }} title="LSB bit position">LSB</th>
                <th style={{ width:44 }}>Bits</th>
                <th style={{ width:56 }}>Rate Hz</th>
                <th style={{ width:70 }} title="Sub/Super-com ID (channels sharing same sub-com packing)">Sub-Com</th>
                <th style={{ width:58 }} title="Multiplier: super×N → N samples per major frame; sub/N → 1 sample per N major frames">×/÷</th>
                <th style={{ width:68 }}>Gain</th>
                <th style={{ width:70 }}>Offset</th>
                <th style={{ width:50 }}>EU</th>
                <th style={{ width:70 }} title="Y-axis range for default plot auto-scale">Y-Range</th>
                <th style={{ width:46 }} title="Alarm/warn rule count">Rules</th>
                <th style={{ width:46 }} title="Embedded sub-channel count">Emb.</th>
                <th style={{ minWidth:220 }}>Formula · EU conversion</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className={sel===r.id ? 'sel' : ''} onClick={() => { setSel(r.id); setSelSubId(null); }}>
                  <td className="cme-rownum">{i+1}</td>
                  <td className="mono" style={{ color:'var(--amber-0)', paddingLeft:6 }}>{r.id}</td>
                  <td><input value={r.name} onChange={e=>updateRow(r.id, { name:e.target.value })} className="cme-cell"/></td>
                  <td className="mono" style={{ color:'var(--s2)', paddingLeft:6 }}>{r.pkt}</td>
                  <td>
                    <select value={r.dfmt} onChange={e=>updateRow(r.id, { dfmt:e.target.value })} className="cme-cell">
                      {DFMT_OPTS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </td>
                  <td className="mono" style={{ color:'var(--fg-2)', paddingLeft:6 }}>{r.word}</td>
                  <td><input type="number" value={r.lsb} onChange={e=>updateRow(r.id, { lsb:+e.target.value })} className="cme-cell mono" style={{ textAlign:'right' }}/></td>
                  <td><input type="number" value={r.bits} onChange={e=>updateRow(r.id, { bits:+e.target.value })} className="cme-cell mono" style={{ textAlign:'right' }}/></td>
                  <td><input type="number" value={r.rate} onChange={e=>updateRow(r.id, { rate:+e.target.value })} className="cme-cell mono" style={{ textAlign:'right' }}/></td>
                  <td>
                    <select value={r.subcomId} onChange={e=>updateRow(r.id, { subcomId:e.target.value })}
                      className="cme-cell mono" style={{ color: r.subcomId==='—' ? 'var(--fg-3)' : 'var(--amber-0)' }}>
                      {SUBCOM_IDS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </td>
                  <td><input type="number" step="any" value={r.subcomMult} onChange={e=>updateRow(r.id, { subcomMult:+e.target.value })} className="cme-cell mono" style={{ textAlign:'right' }}/></td>
                  <td><input type="number" step="any" value={r.gain} onChange={e=>updateRow(r.id, { gain:+e.target.value })} className="cme-cell mono" style={{ textAlign:'right' }}/></td>
                  <td><input type="number" step="any" value={r.offset} onChange={e=>updateRow(r.id, { offset:+e.target.value })} className="cme-cell mono" style={{ textAlign:'right' }}/></td>
                  <td><input value={r.eu} onChange={e=>updateRow(r.id, { eu:e.target.value })} className="cme-cell" style={{ color:'var(--s3)' }}/></td>
                  <td className="mono" style={{ fontSize:10, color:'var(--fg-2)', padding:'0 6px' }}>
                    {r.yAuto ? <span style={{ color:'var(--fg-3)' }}>auto</span> : `${r.yMin}..${r.yMax}`}
                  </td>
                  <td className="mono" style={{ textAlign:'right', paddingRight:6,
                    color: r.rules.filter(x=>x.enabled && x.kind==='alarm').length ? 'var(--alarm)'
                         : r.rules.filter(x=>x.enabled && x.kind==='warn').length ? 'var(--warn)'
                         : 'var(--fg-3)' }}>
                    {r.rules.filter(x=>x.enabled).length || '—'}
                  </td>
                  <td className="mono" style={{ textAlign:'right', paddingRight:6,
                    color: r.embedded.length ? 'var(--amber-0)' : 'var(--fg-3)' }}>
                    {r.embedded.length || '—'}
                  </td>
                  <td><FormulaCell value={r.fmla} onChange={v=>updateRow(r.id, { fmla:v })}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* inspector */}
        <div style={{ overflow:'auto', background:'var(--bg-1)', display:'flex', flexDirection:'column' }}>
          {selRow && (
            <>
              {/* inspector header */}
              <div style={{ padding:'12px 14px 6px', borderBottom:'1px solid var(--line-1)' }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:8 }}>
                  <span style={{ fontSize:14, color:'var(--fg-0)', fontWeight:500 }}>{selRow.name}</span>
                  <span className="mono" style={{ fontSize:11, color:'var(--amber-0)' }}>#{selRow.id}</span>
                  <span style={{ fontSize:10, color:'var(--fg-3)', marginLeft:'auto', textTransform:'uppercase', letterSpacing:1 }}>
                    {selRow.pkt} · {selRow.dfmt} · {selRow.bits}b
                  </span>
                </div>
                <div style={{ display:'flex', gap:2 }}>
                  {[
                    ['commutation','Commutation'],
                    ['yaxis','Y-Axis'],
                    ['rules',`Rules · ${selRow.rules.length}`],
                    ['embedded',`Embedded · ${selRow.embedded.length}`],
                    ['spectrum', selRow.spec ? 'Spectrum ●' : 'Spectrum'],
                  ].map(([k,label]) => (
                    <button key={k} onClick={() => setInspectorTab(k)}
                      style={{
                        padding:'4px 10px', fontSize:10, textTransform:'uppercase', letterSpacing:0.8,
                        background: inspectorTab===k ? 'var(--bg-0)' : 'transparent',
                        color: inspectorTab===k ? 'var(--amber-0)' : 'var(--fg-2)',
                        border:'1px solid var(--line-1)',
                        borderBottom: inspectorTab===k ? '1px solid var(--bg-0)' : '1px solid var(--line-1)',
                        fontFamily:'inherit', cursor:'pointer',
                      }}>{label}</button>
                  ))}
                </div>
              </div>

              <div style={{ padding:14, flex:1, overflow:'auto' }}>
                {inspectorTab === 'commutation' && (
                  <>
                    <div style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Sub/Super-com packing</div>
                    <div style={{ background:'var(--bg-0)', border:'1px solid var(--line-1)', padding:10 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'100px 1fr', gap:'4px 10px', fontSize:10.5 }}>
                        <span style={{ color:'var(--fg-3)' }}>Sub-com ID</span>
                        <select value={selRow.subcomId} onChange={e=>updateRow(selRow.id, { subcomId:e.target.value })} className="cme-cell mono">
                          {SUBCOM_IDS.map(o => <option key={o}>{o}</option>)}
                        </select>
                        <span style={{ color:'var(--fg-3)' }}>Multiplier</span>
                        <input type="number" step="any" value={selRow.subcomMult}
                          onChange={e=>updateRow(selRow.id, { subcomMult:+e.target.value })}
                          className="cme-cell mono" style={{ textAlign:'right' }}/>
                        <span style={{ color:'var(--fg-3)' }}>Parent word</span>
                        <span className="mono" style={{ color:'var(--fg-1)' }}>{selRow.word}</span>
                        <span style={{ color:'var(--fg-3)' }}>LSB position</span>
                        <input type="number" value={selRow.lsb}
                          onChange={e=>updateRow(selRow.id, { lsb:+e.target.value })}
                          className="cme-cell mono" style={{ textAlign:'right' }} title="Bit position of LSB within parent word"/>
                        <span style={{ color:'var(--fg-3)' }}>Width (bits)</span>
                        <input type="number" value={selRow.bits}
                          onChange={e=>updateRow(selRow.id, { bits:+e.target.value })}
                          className="cme-cell mono" style={{ textAlign:'right' }}/>
                      </div>

                      <div style={{ fontSize:9.5, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:0.8, marginTop:10, marginBottom:4 }}>
                        Bit placement in parent word
                      </div>
                      <BitLayoutStrip bits={Math.min(selRow.bits+selRow.lsb, 16)}
                        embedded={[{
                          id:'self', subId:'self',
                          name: selRow.name,
                          startBit: selRow.lsb, width: selRow.bits,
                          kind: selRow.dfmt, rate: selRow.rate,
                        }]}
                        selectedSubId="self"
                        onSelect={()=>{}}/>

                      <div style={{ fontSize:9.5, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:0.8, marginTop:10, marginBottom:4 }}>
                        Major/minor frame commutation
                      </div>
                      <svg viewBox="0 0 340 80" style={{ width:'100%', height:80 }}>
                        <text x="4" y="12" fontSize="8" fill="var(--fg-3)" fontFamily="JetBrains Mono">MAJOR FRAME</text>
                        {Array.from({length:20}).map((_,i) => {
                          const mult = selRow.subcomMult;
                          const active = selRow.subcomId === '—'
                            ? true
                            : mult >= 1
                              ? (i % Math.round(20 / (mult * 4)) === 0 || mult === 1)
                              : i < Math.max(1, Math.round(20 * mult));
                          return (
                            <rect key={i} x={4+i*16.5} y={18} width={14} height={14}
                              fill={active ? 'var(--amber-1)' : 'var(--bg-3)'} stroke="var(--line-1)"/>
                          );
                        })}
                        <text x="4" y="48" fontSize="8" fill="var(--fg-3)" fontFamily="JetBrains Mono">
                          {selRow.subcomId === '—' ? 'NO SUB-COM · direct packing' : `SUB-COM ${selRow.subcomId} · ×${selRow.subcomMult}`}
                        </text>
                        <line x1="4" y1="55" x2="336" y2="55" stroke="var(--line-1)"/>
                        <text x="4" y="72" fontSize="9" fill="var(--fg-1)" fontFamily="JetBrains Mono">
                          word {selRow.word} · bits {selRow.lsb}..{selRow.lsb+selRow.bits-1} · {selRow.rate}Hz base → effective {(selRow.rate * selRow.subcomMult).toFixed(1)}Hz
                        </text>
                      </svg>
                    </div>

                    <div style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, marginTop:14, marginBottom:6 }}>EU preview</div>
                    <div style={{ background:'var(--bg-0)', border:'1px solid var(--line-1)', padding:10, fontFamily:'JetBrains Mono', fontSize:11 }}>
                      <div style={{ color:'var(--amber-0)' }}>y = raw × {selRow.gain} + {selRow.offset}</div>
                      {[0, 512, 1024, 2048, 4096].map(rr => (
                        <div key={rr} style={{ display:'flex', gap:10, fontSize:10.5, color:'var(--fg-1)' }}>
                          <span style={{ color:'var(--fg-3)', minWidth:60 }}>raw {rr}</span>
                          <span>→</span>
                          <span style={{ color:'var(--s3)' }}>{(rr*selRow.gain + selRow.offset).toFixed(3)} {selRow.eu}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {inspectorTab === 'yaxis' && (
                  <>
                    <div style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Default plot Y-axis</div>
                    <div style={{ background:'var(--bg-0)', border:'1px solid var(--line-1)', padding:10 }}>
                      <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, marginBottom:8 }}>
                        <input type="checkbox" checked={selRow.yAuto}
                          onChange={e => updateRow(selRow.id, { yAuto: e.target.checked })}
                          style={{ accentColor:'var(--amber-1)' }}/>
                        Auto-scale (min/max from live data window)
                      </label>
                      <div style={{ display:'grid', gridTemplateColumns:'90px 1fr', gap:'6px 10px', fontSize:10.5,
                        opacity: selRow.yAuto ? 0.5 : 1 }}>
                        <span style={{ color:'var(--fg-3)' }}>Y min</span>
                        <input type="number" step="any" value={selRow.yMin}
                          disabled={selRow.yAuto}
                          onChange={e=>updateRow(selRow.id, { yMin:+e.target.value })}
                          className="cme-cell mono" style={{ textAlign:'right' }}/>
                        <span style={{ color:'var(--fg-3)' }}>Y max</span>
                        <input type="number" step="any" value={selRow.yMax}
                          disabled={selRow.yAuto}
                          onChange={e=>updateRow(selRow.id, { yMax:+e.target.value })}
                          className="cme-cell mono" style={{ textAlign:'right' }}/>
                        <span style={{ color:'var(--fg-3)' }}>Unit label</span>
                        <input value={selRow.yUnit}
                          onChange={e=>updateRow(selRow.id, { yUnit:e.target.value })}
                          className="cme-cell"/>
                      </div>

                      <div style={{ display:'flex', gap:6, marginTop:10 }}>
                        <button className="tb-btn" onClick={() => {
                          // "snap to sensor range" — ±10% of EU min/max via formula range
                          const lo = selRow.offset;
                          const hi = selRow.offset + selRow.gain * (Math.pow(2, selRow.bits) - 1);
                          updateRow(selRow.id, { yMin: Math.floor(lo), yMax: Math.ceil(hi) });
                        }}>Snap to sensor range</button>
                        <button className="tb-btn" onClick={() => {
                          // symmetric around zero
                          const m = Math.max(Math.abs(selRow.yMin), Math.abs(selRow.yMax));
                          updateRow(selRow.id, { yMin: -m, yMax: m });
                        }}>Symmetric ± {Math.max(Math.abs(selRow.yMin), Math.abs(selRow.yMax))}</button>
                      </div>
                    </div>

                    <div style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, marginTop:14, marginBottom:6 }}>Threshold map preview</div>
                    <div style={{ background:'var(--bg-0)', border:'1px solid var(--line-1)', padding:10 }}>
                      <ThresholdMap yMin={selRow.yMin} yMax={selRow.yMax} rules={selRow.rules}/>
                      <div style={{ marginTop:6, fontSize:9.5, color:'var(--fg-3)' }}>
                        Shows enabled alarm/warn rules against the Y-range. Tune bounds so thresholds are visible on the default plot.
                      </div>
                    </div>
                  </>
                )}

                {inspectorTab === 'rules' && (
                  <>
                    <div style={{ display:'flex', alignItems:'center', marginBottom:6 }}>
                      <div style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1 }}>
                        Rule base · {selRow.rules.length} rules
                      </div>
                      <div style={{ flex:1 }}/>
                      <button className="tb-btn" onClick={() => addRule(selRow.id)}>+ Add rule</button>
                    </div>
                    <div style={{ background:'var(--bg-0)', border:'1px solid var(--line-1)' }}>
                      <div style={{ display:'grid',
                        gridTemplateColumns:'18px 60px 58px 60px 60px 52px 60px 24px',
                        gap:4, padding:'5px 4px',
                        fontSize:9, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:0.8,
                        background:'var(--bg-2)', borderBottom:'1px solid var(--line-1)' }}>
                        <span/>
                        <span>Kind</span>
                        <span>Op</span>
                        <span style={{ textAlign:'right' }}>A</span>
                        <span style={{ textAlign:'right' }}>B</span>
                        <span style={{ textAlign:'right' }}>Hyst</span>
                        <span style={{ textAlign:'right' }}>Dwell ms</span>
                        <span/>
                      </div>
                      {selRow.rules.length === 0 ? (
                        <div style={{ padding:14, textAlign:'center', fontSize:10, color:'var(--fg-3)' }}>
                          no rules defined — click “+ Add rule”
                        </div>
                      ) : selRow.rules.map(ru => (
                        <RuleRow key={ru.id} rule={ru}
                          yMin={selRow.yMin} yMax={selRow.yMax}
                          onPatch={patch => patchRule(selRow.id, ru.id, patch)}
                          onDelete={() => delRule(selRow.id, ru.id)}/>
                      ))}
                    </div>

                    <div style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, marginTop:12, marginBottom:6 }}>Quick presets</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {[
                        ['Over limit (warn/alarm)', [
                          { kind:'warn',  op:'>', a:selRow.yMax*0.85, hyst:(selRow.yMax-selRow.yMin)*0.01, dwell:200, enabled:true },
                          { kind:'alarm', op:'>', a:selRow.yMax*0.97, hyst:(selRow.yMax-selRow.yMin)*0.01, dwell:50,  enabled:true },
                        ]],
                        ['Under limit', [
                          { kind:'warn',  op:'<', a:selRow.yMin+(selRow.yMax-selRow.yMin)*0.15, hyst:0, dwell:200, enabled:true },
                          { kind:'alarm', op:'<', a:selRow.yMin+(selRow.yMax-selRow.yMin)*0.05, hyst:0, dwell:50,  enabled:true },
                        ]],
                        ['Rate spike', [
                          { kind:'anom', op:'rate>', a:50, hyst:0, dwell:300, enabled:true },
                        ]],
                        ['Stuck value', [
                          { kind:'warn', op:'stuck', a:5000, hyst:0, dwell:0, enabled:true },
                        ]],
                        ['NaN / dropout', [
                          { kind:'alarm', op:'nan', a:0, hyst:0, dwell:0, enabled:true },
                        ]],
                      ].map(([label, defs]) => (
                        <button key={label} className="tb-btn" onClick={() => {
                          const newRules = defs.map((d,i) => ({ ...d, id:'r'+Date.now()+i }));
                          setRows(rs => rs.map(r => r.id===selRow.id ? { ...r, rules:[...r.rules, ...newRules] } : r));
                          setDirty(true);
                        }}>+ {label}</button>
                      ))}
                    </div>

                    <div style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, marginTop:12, marginBottom:6 }}>Visual preview</div>
                    <div style={{ background:'var(--bg-0)', border:'1px solid var(--line-1)', padding:10 }}>
                      <ThresholdMap yMin={selRow.yMin} yMax={selRow.yMax} rules={selRow.rules}/>
                    </div>
                  </>
                )}

                {inspectorTab === 'embedded' && (
                  <>
                    <div style={{ display:'flex', alignItems:'center', marginBottom:6 }}>
                      <div style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1 }}>
                        Embedded sub-channels (bit-packed)
                      </div>
                      <div style={{ flex:1 }}/>
                      <button className="tb-btn" onClick={() => addEmbedded(selRow.id)}>+ Add sub-channel</button>
                    </div>

                    <div style={{ background:'var(--bg-0)', border:'1px solid var(--line-1)', padding:10, marginBottom:10 }}>
                      <div style={{ fontSize:9.5, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:0.8, marginBottom:4 }}>
                        Bit layout within parent ({selRow.bits} bits) {bitCollisions.size>0 && <span style={{ color:'var(--alarm)', marginLeft:8 }}>● bit collision</span>}
                      </div>
                      <BitLayoutStrip bits={selRow.bits} embedded={selRow.embedded}
                        selectedSubId={selSubId} onSelect={setSelSubId}/>
                    </div>

                    {selRow.embedded.length === 0 ? (
                      <div style={{ padding:20, textAlign:'center', fontSize:10, color:'var(--fg-3)', background:'var(--bg-0)', border:'1px dashed var(--line-1)' }}>
                        No embedded sub-channels. Use for composite words (BIT / discretes / status) — split them into named bit fields.
                      </div>
                    ) : selRow.embedded.map((sub, si) => {
                      const coll = bitCollisions.has(sub.subId);
                      const hi = selSubId === sub.subId;
                      return (
                        <div key={sub.id}
                          onClick={() => setSelSubId(sub.subId)}
                          style={{
                            background:'var(--bg-0)',
                            border:`1px solid ${coll ? 'var(--alarm)' : (hi ? 'var(--amber-1)' : 'var(--line-1)')}`,
                            padding:10, marginBottom:8,
                            cursor:'pointer',
                          }}>
                          <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:6 }}>
                            <span className="mono" style={{ color:'var(--amber-0)', fontSize:10.5 }}>#{sub.subId}</span>
                            <input value={sub.name}
                              onClick={e=>e.stopPropagation()}
                              onChange={e=>updateEmbedded(selRow.id, sub.subId, { name:e.target.value })}
                              className="cme-cell" style={{ flex:1 }}/>
                            <button onClick={e=>{ e.stopPropagation(); delEmbedded(selRow.id, sub.subId); }}
                              style={{ background:'transparent', border:'none', color:'var(--fg-3)', cursor:'pointer', fontSize:14 }}>×</button>
                          </div>
                          <div style={{ display:'grid',
                            gridTemplateColumns:'repeat(4, 1fr)', gap:'4px 8px', fontSize:10 }}>
                            <label style={{ color:'var(--fg-3)' }}>start bit
                              <input type="number" min="0" max={selRow.bits-1} value={sub.startBit}
                                onClick={e=>e.stopPropagation()}
                                onChange={e=>updateEmbedded(selRow.id, sub.subId, { startBit:+e.target.value })}
                                className="cme-cell mono" style={{ textAlign:'right', width:'100%' }}/>
                            </label>
                            <label style={{ color:'var(--fg-3)' }}>width
                              <input type="number" min="1" max={selRow.bits} value={sub.width}
                                onClick={e=>e.stopPropagation()}
                                onChange={e=>updateEmbedded(selRow.id, sub.subId, { width:+e.target.value })}
                                className="cme-cell mono" style={{ textAlign:'right', width:'100%' }}/>
                            </label>
                            <label style={{ color:'var(--fg-3)' }}>kind
                              <select value={sub.kind}
                                onClick={e=>e.stopPropagation()}
                                onChange={e=>updateEmbedded(selRow.id, sub.subId, { kind:e.target.value })}
                                className="cme-cell mono" style={{ width:'100%' }}>
                                {SUB_KINDS.map(o => <option key={o}>{o}</option>)}
                              </select>
                            </label>
                            <label style={{ color:'var(--fg-3)' }}>rate Hz
                              <input type="number" value={sub.rate}
                                onClick={e=>e.stopPropagation()}
                                onChange={e=>updateEmbedded(selRow.id, sub.subId, { rate:+e.target.value })}
                                className="cme-cell mono" style={{ textAlign:'right', width:'100%' }}/>
                            </label>
                          </div>
                          {(sub.kind === 'bool' || sub.kind === 'enum') && (
                            <div style={{ marginTop:6 }}>
                              <div style={{ fontSize:9, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:0.8, marginBottom:3 }}>
                                State labels ({Math.pow(2, sub.width)} codes)
                              </div>
                              <input
                                value={(sub.states || []).join(' | ')}
                                onClick={e=>e.stopPropagation()}
                                onChange={e=>updateEmbedded(selRow.id, sub.subId, { states: e.target.value.split('|').map(s=>s.trim()) })}
                                placeholder="0 | 1 | 2 | 3"
                                className="cme-cell mono" style={{ width:'100%' }}/>
                            </div>
                          )}
                          <div style={{ marginTop:6, fontSize:9.5, color:'var(--fg-3)', fontFamily:'JetBrains Mono' }}>
                            mask: 0x{((Math.pow(2, sub.width)-1) << sub.startBit).toString(16).toUpperCase().padStart(Math.ceil(selRow.bits/4), '0')} ·
                            extract: (raw &gt;&gt; {sub.startBit}) &amp; 0x{(Math.pow(2, sub.width)-1).toString(16).toUpperCase()}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {inspectorTab === 'spectrum' && (
                  <>
                    <div style={{ display:'flex', alignItems:'center', marginBottom:6 }}>
                      <div style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1 }}>Spectrum (FFT) config</div>
                      <div style={{ flex:1 }}/>
                      <button className="tb-btn" onClick={() => {
                        if (selRow.spec) updateRow(selRow.id, { spec:null });
                        else updateRow(selRow.id, { spec:{ fc:1000, bw:2, fftN:1024, win:'hann', avg:1, unit:'dBm' }});
                      }}>{selRow.spec ? 'Disable' : 'Enable'}</button>
                    </div>
                    {selRow.spec ? (
                      <div style={{ background:'var(--bg-0)', border:'1px solid var(--line-1)', padding:10,
                        display:'grid', gridTemplateColumns:'80px 1fr', gap:'4px 10px', fontSize:10.5 }}>
                        <span style={{ color:'var(--fg-3)' }}>Fc (MHz)</span>
                        <input type="number" step="any" value={selRow.spec.fc} className="cme-cell mono"
                          onChange={e=>updateRow(selRow.id, { spec:{ ...selRow.spec, fc:+e.target.value }})}/>
                        <span style={{ color:'var(--fg-3)' }}>BW (MHz)</span>
                        <input type="number" step="any" value={selRow.spec.bw} className="cme-cell mono"
                          onChange={e=>updateRow(selRow.id, { spec:{ ...selRow.spec, bw:+e.target.value }})}/>
                        <span style={{ color:'var(--fg-3)' }}>FFT N</span>
                        <select value={selRow.spec.fftN} className="cme-cell mono"
                          onChange={e=>updateRow(selRow.id, { spec:{ ...selRow.spec, fftN:+e.target.value }})}>
                          {[256,512,1024,2048,4096,8192].map(n => <option key={n}>{n}</option>)}
                        </select>
                        <span style={{ color:'var(--fg-3)' }}>Window</span>
                        <select value={selRow.spec.win} className="cme-cell"
                          onChange={e=>updateRow(selRow.id, { spec:{ ...selRow.spec, win:e.target.value }})}>
                          {['hann','hamming','blackman','rect','flat-top','kaiser'].map(w => <option key={w}>{w}</option>)}
                        </select>
                        <span style={{ color:'var(--fg-3)' }}>Averaging</span>
                        <input type="number" value={selRow.spec.avg} className="cme-cell mono"
                          onChange={e=>updateRow(selRow.id, { spec:{ ...selRow.spec, avg:+e.target.value }})}/>
                        <span style={{ color:'var(--fg-3)' }}>Unit</span>
                        <select value={selRow.spec.unit} className="cme-cell"
                          onChange={e=>updateRow(selRow.id, { spec:{ ...selRow.spec, unit:e.target.value }})}>
                          {['dBm','dBFS','V/√Hz','linear'].map(u => <option key={u}>{u}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div style={{ background:'var(--bg-0)', border:'1px dashed var(--line-1)', padding:20, fontSize:10, color:'var(--fg-3)', textAlign:'center' }}>
                        Non-spectrum channel — enable to configure FFT.
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* bottom bar */}
      <div style={{ height:26, borderTop:'1px solid var(--line-1)', background:'var(--bg-2)',
        display:'flex', alignItems:'center', padding:'0 16px', gap:14,
        fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:0.8 }}>
        <span>tmats source: <span style={{ color:'var(--fg-1)' }}>T-247_2026-04-20.tmats</span></span>
        <span>·</span>
        <span>schema: IRIG-106-22 Ch10</span>
        <span>·</span>
        <span>sha256: <span className="mono" style={{ color:'var(--fg-2)' }}>a3f8…e21c</span></span>
        <div style={{ flex:1 }}/>
        <span>↑↓ row · Tab next cell · Enter commit · Ctrl-Z undo</span>
      </div>
    </div>
  );
}

Object.assign(window, { ChannelMappingEditor });

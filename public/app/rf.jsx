// RF instrumentation panels — Keysight LAN/SCPI integration view.
//
// These four panels work as a coherent stack:
//
//   1. SpectrumPanel        — live trace + persistence + markers, pulled over
//                             LAN from a Keysight signal analyzer (N9040B/UXA,
//                             N9020B/MXA, etc.) via SCPI over TCP. Shows the
//                             "what does the air look like" view.
//   2. AnalyzerControlPanel — full front-panel remote control for the same
//                             analyzer: center/span/RBW/VBW, ref level, sweep
//                             mode, triggering, attenuation, preamp, and a
//                             SCPI console for ad-hoc commands.
//   3. IQPanel              — demodulated IQ constellation with per-symbol
//                             trail, EVM/MER/SNR readouts.
//   4. EyePanel             — digital eye diagram (persistence-fold) with
//                             mask template, jitter histogram, crossing pct.
//
// All panels assume samples arrive over the existing BUS, tagged with a Keysight
// instrument descriptor (shape below). In live mode they stream; in replay mode
// they play back whatever was captured alongside the flight.
//
//   KEY_INSTRUMENT = {
//     id: 'kx-rf-01',
//     model: 'N9040B UXA',
//     lan: '192.168.40.41:5025',          // SCPI TCP
//     vxi: 'TCPIP0::...::INSTR',           // VISA resource string
//     serial: 'MY60430187',
//     fw: 'A.27.82',
//     lastSweep: { centerHz, spanHz, rbwHz, vbwHz, refdBm, attndB, ... }
//   }

// ---- fake Keysight instruments inventory ----
const KEY_INSTRUMENTS = [
  { id:'kx-01', model:'N9040B UXA',      lan:'192.168.40.41',  port:5025,
    vxi:'TCPIP0::192.168.40.41::inst0::INSTR',
    serial:'MY60430187', fw:'A.27.82', state:'connected',   role:'primary'   },
  { id:'kx-02', model:'N9020B MXA',      lan:'192.168.40.42',  port:5025,
    vxi:'TCPIP0::192.168.40.42::inst0::INSTR',
    serial:'MY55120902', fw:'A.21.14', state:'connected',   role:'secondary' },
  { id:'kx-03', model:'N9030B PXA',      lan:'192.168.40.43',  port:5025,
    vxi:'TCPIP0::192.168.40.43::inst0::INSTR',
    serial:'MY58290041', fw:'A.25.06', state:'disconnected', role:'standby'   },
  { id:'kx-04', model:'N5193A UXG',      lan:'192.168.40.44',  port:5025,
    vxi:'TCPIP0::192.168.40.44::inst0::INSTR',
    serial:'MY58021003', fw:'A.04.83', state:'connected',   role:'source'    },
];

const KEY_SCPI_LOG = [
  { ts:'14:02:11.214', dir:'tx', cmd:':SENS:FREQ:CENT 1.2725E9' },
  { ts:'14:02:11.251', dir:'rx', cmd:'OK' },
  { ts:'14:02:11.262', dir:'tx', cmd:':SENS:FREQ:SPAN 40E6' },
  { ts:'14:02:11.298', dir:'rx', cmd:'OK' },
  { ts:'14:02:11.308', dir:'tx', cmd:':SENS:BAND 30E3' },
  { ts:'14:02:11.347', dir:'rx', cmd:'OK' },
  { ts:'14:02:11.355', dir:'tx', cmd:':INIT:CONT ON' },
  { ts:'14:02:11.392', dir:'rx', cmd:'OK' },
  { ts:'14:02:12.001', dir:'tx', cmd:':TRAC:DATA? TRACE1' },
  { ts:'14:02:12.094', dir:'rx', cmd:'<801 pts>' },
  { ts:'14:02:13.008', dir:'tx', cmd:':CALC:MARK1:X 1.27425E9' },
  { ts:'14:02:13.042', dir:'rx', cmd:'OK' },
  { ts:'14:02:13.051', dir:'tx', cmd:':CALC:MARK1:Y?' },
  { ts:'14:02:13.088', dir:'rx', cmd:'-37.24' },
];

// --- helpers --------------------------------------------------------------
function fmtHz(hz) {
  if (hz >= 1e9) return (hz/1e9).toFixed(4).replace(/0+$/,'').replace(/\.$/,'') + ' GHz';
  if (hz >= 1e6) return (hz/1e6).toFixed(3).replace(/0+$/,'').replace(/\.$/,'') + ' MHz';
  if (hz >= 1e3) return (hz/1e3).toFixed(2).replace(/0+$/,'').replace(/\.$/,'') + ' kHz';
  return hz.toFixed(0) + ' Hz';
}

// =========================================================================
// SPECTRUM PANEL — live trace, peak hold, markers, persistence
// =========================================================================
function SpectrumPanel({ panel, mode }) {
  const canvasRef = useRef(null);
  const persistRef = useRef(null);
  const [connected, setConnected] = useState(true);
  const [instrument, setInstrument] = useState('kx-01');
  const [center, setCenter]   = useState(1.2725e9);  // Hz
  const [span, setSpan]       = useState(40e6);
  const [rbw, setRbw]         = useState(30e3);
  const [vbw, setVbw]         = useState(30e3);
  const [refLevel, setRefLevel] = useState(-30);     // dBm, top of grid
  const [scale, setScale]     = useState(10);        // dB/div
  const [traceMode, setTraceMode] = useState('clear-write'); // clear-write | max-hold | average | min-hold
  const [persistence, setPersistence] = useState(true);
  const [markers, setMarkers] = useState([
    { id:1, hz: 1.27425e9, dBm: -37.24, enabled:true },
    { id:2, hz: 1.2705e9,  dBm: -68.10, enabled:true, delta:1 },
  ]);

  const instr = KEY_INSTRUMENTS.find(i => i.id === instrument);
  const N = 801; // typical Keysight trace point count
  const t = useTicker(mode === 'live' && connected);

  // build synthetic spectrum trace
  const trace = useMemo(() => {
    const startHz = center - span/2;
    const stepHz  = span / (N-1);
    const out = new Float32Array(N);
    const T = t; // drift phase
    for (let i = 0; i < N; i++) {
      const f = startHz + i * stepHz;
      // noise floor around -110 dBm
      let v = -108 + Math.random() * 3;
      // data carrier at center — OFDM-ish shoulder
      const dCenter = Math.abs(f - center);
      if (dCenter < 10e6) v += 72 * Math.exp(-Math.pow(dCenter/6e6, 2)) - 6;
      // strong CW at center + 4 MHz
      if (Math.abs(f - (center + 4e6)) < 50e3) v += 50 * Math.exp(-Math.pow((f-(center+4e6))/25e3, 2));
      // spurious at center - 6 MHz
      if (Math.abs(f - (center - 6e6)) < 25e3) v += 28 * Math.exp(-Math.pow((f-(center-6e6))/15e3, 2));
      // drifting inter-modulation product
      const drift = center + 12e6 + Math.sin(T*0.3)*2e6;
      if (Math.abs(f - drift) < 100e3) v += 22 * Math.exp(-Math.pow((f-drift)/60e3, 2));
      // pilot tones
      [-14e6, -8e6, 8e6, 14e6].forEach(off => {
        if (Math.abs(f - (center + off)) < 30e3) v += 35 * Math.exp(-Math.pow((f - (center + off))/18e3, 2));
      });
      out[i] = v;
    }
    return out;
  }, [t, center, span]);

  // peak-hold / min-hold buffers
  const holdRef = useRef({ max: null, min: null, avg: null, n: 0 });
  useEffect(() => { holdRef.current = { max: null, min: null, avg: null, n: 0 }; }, [center, span, rbw, traceMode]);
  useEffect(() => {
    const h = holdRef.current;
    if (!h.max || h.max.length !== trace.length) {
      h.max = new Float32Array(trace); h.min = new Float32Array(trace);
      h.avg = new Float32Array(trace); h.n = 1;
    } else {
      for (let i = 0; i < trace.length; i++) {
        if (trace[i] > h.max[i]) h.max[i] = trace[i];
        if (trace[i] < h.min[i]) h.min[i] = trace[i];
        h.avg[i] = (h.avg[i] * h.n + trace[i]) / (h.n + 1);
      }
      h.n++;
    }
  }, [trace]);

  // draw
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr; c.height = rect.height * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;

    // persistence background
    if (persistence) {
      const pc = persistRef.current;
      if (pc) {
        pc.width = W * dpr; pc.height = H * dpr;
        const pctx = pc.getContext('2d');
        pctx.scale(dpr, dpr);
        pctx.fillStyle = 'rgba(15,17,19,0.12)';
        pctx.fillRect(0, 0, W, H);
        pctx.strokeStyle = 'rgba(229,162,74,0.15)';
        pctx.lineWidth = 1.5;
        pctx.beginPath();
        const yMin = refLevel - scale * 10;
        for (let i = 0; i < trace.length; i++) {
          const x = (i / (trace.length - 1)) * W;
          const y = H - ((trace[i] - yMin) / (refLevel - yMin)) * H;
          i === 0 ? pctx.moveTo(x, y) : pctx.lineTo(x, y);
        }
        pctx.stroke();
        ctx.drawImage(pc, 0, 0, W, H);
      }
    } else {
      ctx.fillStyle = '#0f1113';
      ctx.fillRect(0, 0, W, H);
    }

    // Keysight-style grid: 10 x 10
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      ctx.beginPath(); ctx.moveTo((W*i)/10, 0); ctx.lineTo((W*i)/10, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (H*i)/10); ctx.lineTo(W, (H*i)/10); ctx.stroke();
    }
    // center axis
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.moveTo(W/2, 0); ctx.lineTo(W/2, H); ctx.stroke();

    // dBm axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '9px JetBrains Mono';
    for (let i = 0; i <= 10; i++) {
      const db = refLevel - i * scale;
      ctx.textAlign = 'left';
      ctx.fillText(`${db}`, 4, (H * i / 10) - 2 || 10);
    }
    // freq labels
    ctx.textAlign = 'center';
    for (let i = 0; i <= 10; i++) {
      const hz = center - span/2 + (span * i / 10);
      const t = fmtHz(hz);
      ctx.fillText(t, (W * i) / 10, H - 4);
    }

    const yMin = refLevel - scale * 10;
    const toY = (dBm) => H - ((dBm - yMin) / (refLevel - yMin)) * H;
    const toX = (i, n) => (i / (n - 1)) * W;

    // trace layers (mode)
    const h = holdRef.current;
    if (traceMode === 'max-hold' && h.max) {
      ctx.strokeStyle = '#e5a24a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < h.max.length; i++) {
        const x = toX(i, h.max.length), y = toY(h.max[i]);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (traceMode === 'min-hold' && h.min) {
      ctx.strokeStyle = '#7aa874';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < h.min.length; i++) {
        const x = toX(i, h.min.length), y = toY(h.min[i]);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (traceMode === 'average' && h.avg) {
      ctx.strokeStyle = '#4fb3b6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < h.avg.length; i++) {
        const x = toX(i, h.avg.length), y = toY(h.avg[i]);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // live trace on top — classic yellow Keysight
    ctx.strokeStyle = '#f4d65a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < trace.length; i++) {
      const x = toX(i, trace.length), y = toY(trace[i]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // markers
    markers.forEach(m => {
      if (!m.enabled) return;
      const frac = (m.hz - (center - span/2)) / span;
      if (frac < 0 || frac > 1) return;
      const x = frac * W;
      // locate nearest trace idx
      const idx = Math.round(frac * (trace.length - 1));
      const y = toY(trace[idx]);
      // marker diamond
      ctx.fillStyle = m.delta ? '#e56b5f' : '#f4d65a';
      ctx.strokeStyle = '#0f1113';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y-8); ctx.lineTo(x+6, y); ctx.lineTo(x, y+6); ctx.lineTo(x-6, y); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // label
      ctx.fillStyle = '#0f1113';
      ctx.fillRect(x+6, y-18, 22, 12);
      ctx.fillStyle = m.delta ? '#e56b5f' : '#f4d65a';
      ctx.font = 'bold 9px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(m.delta ? `Δ${m.id}` : `M${m.id}`, x+17, y-9);
    });
  }, [trace, refLevel, scale, traceMode, persistence, markers, center, span]);

  const toggleMarker = (id) => setMarkers(ms =>
    ms.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));

  return (
    <div style={{ display:'grid', gridTemplateRows:'28px 1fr 68px', height:'100%', background:'#0f1113' }}>
      {/* Instrument status strip */}
      <div style={{
        display:'flex', alignItems:'center', gap:10, padding:'0 10px',
        background:'var(--bg-2)', borderBottom:'1px solid var(--line-2)',
        fontSize:10, color:'var(--fg-2)',
      }}>
        <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%',
          background: connected ? 'var(--ok)' : 'var(--fg-3)',
          boxShadow: connected ? '0 0 6px rgba(122,168,116,0.6)' : 'none' }}/>
        <select value={instrument} onChange={e => setInstrument(e.target.value)}
          style={{ background:'transparent', border:'none', color:'var(--amber-0)',
            fontSize:10, fontFamily:'JetBrains Mono', outline:'none', cursor:'pointer' }}>
          {KEY_INSTRUMENTS.filter(i => i.state === 'connected').map(i =>
            <option key={i.id} value={i.id}>{i.model}</option>
          )}
        </select>
        <span style={{ color:'var(--fg-3)' }}>·</span>
        <span className="mono" style={{ color:'var(--fg-2)' }}>{instr?.lan}:{instr?.port}</span>
        <span style={{ color:'var(--fg-3)' }}>·</span>
        <span className="mono" style={{ color:'var(--fg-3)' }}>s/n {instr?.serial}</span>
        <div style={{ flex:1 }}/>
        <span className="mono" style={{ color:'var(--fg-2)' }}>801 pts · {(1000/33).toFixed(0)} Hz sweep</span>
        <span style={{ color:'var(--fg-3)' }}>·</span>
        <span className="mono" style={{ color: connected ? 'var(--ok)' : 'var(--alarm)' }}>
          {connected ? 'SWEEP LOCKED' : 'DISCONNECTED'}
        </span>
      </div>

      <div style={{ position:'relative' }}>
        <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }}/>
        <canvas ref={persistRef} style={{ display:'none' }}/>

        {/* corner readouts — Keysight-style */}
        <div style={{ position:'absolute', top:8, right:10,
          background:'rgba(15,17,19,0.85)', border:'1px solid rgba(244,214,90,0.4)',
          padding:'6px 10px', fontFamily:'JetBrains Mono', fontSize:10, color:'#f4d65a', lineHeight:1.6 }}>
          <div>Ref <span style={{ color:'#fff' }}>{refLevel} dBm</span></div>
          <div>Att <span style={{ color:'#fff' }}>10 dB</span> · Preamp <span style={{ color:'#fff' }}>Off</span></div>
          <div>{scale} dB/div · Log</div>
        </div>
        <div style={{ position:'absolute', top:8, left:10,
          background:'rgba(15,17,19,0.85)', border:'1px solid rgba(244,214,90,0.4)',
          padding:'6px 10px', fontFamily:'JetBrains Mono', fontSize:10, color:'#f4d65a', lineHeight:1.6 }}>
          <div>Center <span style={{ color:'#fff' }}>{fmtHz(center)}</span></div>
          <div>Span <span style={{ color:'#fff' }}>{fmtHz(span)}</span></div>
          <div>RBW <span style={{ color:'#fff' }}>{fmtHz(rbw)}</span> · VBW <span style={{ color:'#fff' }}>{fmtHz(vbw)}</span></div>
        </div>

        {/* trace mode pill */}
        <div style={{ position:'absolute', bottom:28, left:'50%', transform:'translateX(-50%)',
          background:'rgba(15,17,19,0.85)', border:'1px solid rgba(255,255,255,0.15)',
          display:'flex', fontSize:9, fontFamily:'JetBrains Mono' }}>
          {['clear-write','max-hold','min-hold','average'].map(m => (
            <button key={m} onClick={() => setTraceMode(m)}
              style={{
                background: traceMode===m ? '#e5a24a' : 'transparent',
                color: traceMode===m ? '#0f1113' : '#aaa',
                border:'none', borderRight:'1px solid rgba(255,255,255,0.1)',
                padding:'3px 10px', cursor:'pointer', textTransform:'uppercase', letterSpacing:0.8,
              }}>{m}</button>
          ))}
        </div>
      </div>

      {/* marker table */}
      <div style={{
        borderTop:'1px solid var(--line-2)', background:'var(--bg-2)',
        display:'grid', gridTemplateColumns:'40px 1.2fr 1fr 1fr 1fr auto',
        padding:'4px 10px', fontSize:10, color:'var(--fg-2)', alignItems:'center',
      }}>
        <span style={{ color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, fontSize:9 }}>MKR</span>
        <span style={{ color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, fontSize:9 }}>Frequency</span>
        <span style={{ color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, fontSize:9 }}>Amplitude</span>
        <span style={{ color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, fontSize:9 }}>Delta</span>
        <span style={{ color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, fontSize:9 }}>Band</span>
        <span/>
        {markers.map((m,idx) => {
          const refM = m.delta && markers.find(x => x.id === m.delta);
          return (
            <React.Fragment key={m.id}>
              <span className="mono" style={{ color: m.delta ? 'var(--alarm)' : '#f4d65a' }}>
                {m.delta ? `Δ${m.id}` : `M${m.id}`}
              </span>
              <span className="mono" style={{ color:'var(--fg-1)' }}>{fmtHz(m.hz)}</span>
              <span className="mono" style={{ color:'var(--fg-1)' }}>{m.dBm.toFixed(2)} dBm</span>
              <span className="mono" style={{ color:'var(--fg-2)' }}>
                {refM ? `${(m.hz - refM.hz > 0 ? '+' : '')}${((m.hz - refM.hz)/1e6).toFixed(3)} MHz` : '—'}
              </span>
              <span className="mono" style={{ color:'var(--fg-2)' }}>L-band</span>
              <button onClick={() => toggleMarker(m.id)}
                style={{ background:'transparent', border:'1px solid var(--line-2)',
                  color: m.enabled ? 'var(--fg-0)' : 'var(--fg-3)', fontSize:9,
                  padding:'1px 6px', fontFamily:'JetBrains Mono', cursor:'pointer' }}>
                {m.enabled ? 'ON' : 'OFF'}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// =========================================================================
// ANALYZER CONTROL PANEL — front-panel remote for a Keysight
// =========================================================================
function AnalyzerControlPanel({ panel, mode }) {
  const [instrument, setInstrument] = useState('kx-01');
  const [center, setCenter] = useState('1.27250 GHz');
  const [span, setSpan]     = useState('40.000 MHz');
  const [rbw, setRbw]       = useState('30 kHz');
  const [vbw, setVbw]       = useState('30 kHz');
  const [refLevel, setRefLevel] = useState('-30 dBm');
  const [atten, setAtten] = useState('10 dB');
  const [preamp, setPreamp] = useState(false);
  const [sweepMode, setSweepMode] = useState('cont');
  const [trigSrc, setTrigSrc] = useState('free');
  const [avgCount, setAvgCount] = useState(10);
  const [avgOn, setAvgOn] = useState(false);
  const [detector, setDetector] = useState('rms');
  const [scpi, setScpi] = useState(':SENS:BAND:VID 30E3');
  const [log, setLog] = useState(KEY_SCPI_LOG);

  const sendScpi = () => {
    const now = new Date();
    const ts = `${now.toTimeString().slice(0,8)}.${now.getMilliseconds().toString().padStart(3,'0')}`;
    setLog(l => [
      ...l.slice(-30),
      { ts, dir:'tx', cmd: scpi },
      { ts, dir:'rx', cmd: scpi.endsWith('?') ? '<response data>' : 'OK' },
    ]);
  };

  const instr = KEY_INSTRUMENTS.find(i => i.id === instrument);

  const Section = ({ title, children }) => (
    <div style={{ borderBottom:'1px solid var(--line-1)', padding:'8px 10px' }}>
      <div style={{ fontSize:9, letterSpacing:1.4, textTransform:'uppercase', color:'var(--fg-3)', marginBottom:6 }}>
        {title}
      </div>
      {children}
    </div>
  );
  const Row = ({ label, children }) => (
    <div style={{ display:'grid', gridTemplateColumns:'78px 1fr', gap:8, alignItems:'center',
      padding:'3px 0', fontSize:10.5 }}>
      <span style={{ color:'var(--fg-2)', fontFamily:'IBM Plex Sans' }}>{label}</span>
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>{children}</div>
    </div>
  );
  const CtlInput = ({ v, onChange, mono }) => (
    <input value={v} onChange={e => onChange(e.target.value)}
      style={{ flex:1, background:'var(--bg-0)', border:'1px solid var(--line-1)',
        color:'#f4d65a', padding:'3px 6px', fontSize:10.5,
        fontFamily: mono === false ? 'inherit' : 'JetBrains Mono',
        outline:'none', textAlign:'right' }}/>
  );
  const Pill = ({ on, onClick, children, accent }) => (
    <button onClick={onClick}
      style={{
        background: on ? (accent || 'var(--amber-1)') : 'transparent',
        color: on ? '#0f1113' : 'var(--fg-1)',
        border:'1px solid ' + (on ? (accent || 'var(--amber-1)') : 'var(--line-1)'),
        padding:'3px 10px', fontSize:9.5, letterSpacing:0.8, textTransform:'uppercase',
        fontFamily:'JetBrains Mono', cursor:'pointer', minWidth: 44,
      }}>{children}</button>
  );

  return (
    <div style={{ display:'grid', gridTemplateRows:'28px 1fr', height:'100%', background:'var(--bg-1)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'0 10px',
        background:'var(--bg-2)', borderBottom:'1px solid var(--line-2)', fontSize:10 }}>
        <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%',
          background: 'var(--ok)', boxShadow:'0 0 6px rgba(122,168,116,0.6)' }}/>
        <select value={instrument} onChange={e => setInstrument(e.target.value)}
          style={{ background:'transparent', border:'none', color:'var(--amber-0)',
            fontSize:10, fontFamily:'JetBrains Mono', outline:'none', cursor:'pointer' }}>
          {KEY_INSTRUMENTS.map(i =>
            <option key={i.id} value={i.id}>{i.model}</option>
          )}
        </select>
        <span className="mono" style={{ color:'var(--fg-3)' }}>{instr?.lan}:{instr?.port}</span>
        <span className="mono" style={{ color:'var(--fg-3)' }}>· fw {instr?.fw}</span>
        <div style={{ flex:1 }}/>
        <button style={{ background:'transparent', border:'1px solid var(--line-1)', color:'var(--fg-1)',
          padding:'2px 8px', fontSize:9.5, fontFamily:'JetBrains Mono', cursor:'pointer' }}>
          *IDN?
        </button>
        <button style={{ background:'transparent', border:'1px solid var(--line-1)', color:'var(--fg-1)',
          padding:'2px 8px', fontSize:9.5, fontFamily:'JetBrains Mono', cursor:'pointer' }}>
          PRESET
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', minHeight:0 }}>
        {/* left: parameters */}
        <div style={{ overflow:'auto', borderRight:'1px solid var(--line-1)' }}>
          <Section title="Frequency">
            <Row label="Center"><CtlInput v={center}   onChange={setCenter}/></Row>
            <Row label="Span">  <CtlInput v={span}     onChange={setSpan}/></Row>
            <Row label="Start"> <CtlInput v="1.25250 GHz" onChange={()=>{}}/></Row>
            <Row label="Stop">  <CtlInput v="1.29250 GHz" onChange={()=>{}}/></Row>
          </Section>

          <Section title="Bandwidth">
            <Row label="RBW"><CtlInput v={rbw} onChange={setRbw}/>
              <Pill on={true}>AUTO</Pill></Row>
            <Row label="VBW"><CtlInput v={vbw} onChange={setVbw}/>
              <Pill on={true}>AUTO</Pill></Row>
            <Row label="V/R">
              <CtlInput v="1.0" onChange={()=>{}}/>
            </Row>
          </Section>

          <Section title="Amplitude">
            <Row label="Ref Level"><CtlInput v={refLevel} onChange={setRefLevel}/></Row>
            <Row label="Attn">     <CtlInput v={atten}    onChange={setAtten}/>
              <Pill on={true}>AUTO</Pill></Row>
            <Row label="Preamp">
              <Pill on={!preamp}  onClick={() => setPreamp(false)}>OFF</Pill>
              <Pill on={preamp}   onClick={() => setPreamp(true)} accent="var(--warn)">ON</Pill>
            </Row>
            <Row label="Scale">
              <Pill on={true}>LOG 10 dB/</Pill>
              <Pill>LINEAR</Pill>
            </Row>
          </Section>

          <Section title="Sweep">
            <Row label="Mode">
              <Pill on={sweepMode==='cont'} onClick={() => setSweepMode('cont')}>CONT</Pill>
              <Pill on={sweepMode==='single'} onClick={() => setSweepMode('single')}>SINGLE</Pill>
            </Row>
            <Row label="Time"><CtlInput v="33.4 ms" onChange={()=>{}}/>
              <Pill on={true}>AUTO</Pill></Row>
            <Row label="Points"><CtlInput v="801" onChange={()=>{}}/></Row>
            <Row label="Detector">
              <Pill on={detector==='rms'}      onClick={() => setDetector('rms')}>RMS</Pill>
              <Pill on={detector==='pospeak'}  onClick={() => setDetector('pospeak')}>+PK</Pill>
              <Pill on={detector==='sample'}   onClick={() => setDetector('sample')}>SMP</Pill>
            </Row>
          </Section>

          <Section title="Averaging">
            <Row label="State">
              <Pill on={!avgOn} onClick={() => setAvgOn(false)}>OFF</Pill>
              <Pill on={avgOn}  onClick={() => setAvgOn(true)} accent="var(--pinned)">ON</Pill>
            </Row>
            <Row label="Count"><CtlInput v={avgCount} onChange={v => setAvgCount(+v)}/></Row>
            <Row label="Type">
              <Pill on={true}>LOG-PWR</Pill>
              <Pill>RMS</Pill>
              <Pill>SCALAR</Pill>
            </Row>
          </Section>

          <Section title="Trigger">
            <Row label="Source">
              <Pill on={trigSrc==='free'}   onClick={() => setTrigSrc('free')}>FREE</Pill>
              <Pill on={trigSrc==='video'}  onClick={() => setTrigSrc('video')}>VIDEO</Pill>
              <Pill on={trigSrc==='ext'}    onClick={() => setTrigSrc('ext')}>EXT</Pill>
              <Pill on={trigSrc==='irq'}    onClick={() => setTrigSrc('irq')}>IRQ</Pill>
            </Row>
            <Row label="Level"><CtlInput v="0.00 V" onChange={()=>{}}/></Row>
            <Row label="Delay"><CtlInput v="0.0 us" onChange={()=>{}}/></Row>
          </Section>
        </div>

        {/* right: SCPI console */}
        <div style={{ display:'grid', gridTemplateRows:'28px 1fr auto', minHeight:0 }}>
          <div style={{ display:'flex', alignItems:'center', padding:'0 10px',
            background:'var(--bg-2)', borderBottom:'1px solid var(--line-2)',
            fontSize:9, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1 }}>
            SCPI Console · IEEE-488.2
            <div style={{ flex:1 }}/>
            <button style={{ background:'transparent', border:'1px solid var(--line-1)', color:'var(--fg-1)',
              padding:'1px 6px', fontSize:9, fontFamily:'JetBrains Mono', cursor:'pointer' }}>
              clear
            </button>
          </div>

          <div style={{ overflow:'auto', background:'#0f1113', padding:'6px 10px',
            fontFamily:'JetBrains Mono', fontSize:10.5, lineHeight:1.65 }}>
            {log.map((entry, i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'80px 18px 1fr', gap:6,
                color: entry.dir === 'tx' ? '#f4d65a' : '#7aa874' }}>
                <span style={{ color:'#777' }}>{entry.ts}</span>
                <span style={{ color: entry.dir === 'tx' ? '#e5a24a' : '#4fb3b6' }}>{entry.dir === 'tx' ? '⇢' : '⇠'}</span>
                <span>{entry.cmd}</span>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', gap:0, padding:'6px 8px', borderTop:'1px solid var(--line-2)',
            background:'var(--bg-2)' }}>
            <span style={{ color:'#e5a24a', fontFamily:'JetBrains Mono', fontSize:11, padding:'4px 8px 4px 0' }}>SCPI›</span>
            <input value={scpi} onChange={e => setScpi(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendScpi()}
              style={{ flex:1, background:'#0f1113', border:'1px solid var(--line-1)',
                color:'#f4d65a', padding:'4px 8px', fontFamily:'JetBrains Mono',
                fontSize:10.5, outline:'none' }}/>
            <button onClick={sendScpi}
              style={{ background:'var(--amber-1)', color:'#0f1113', border:'none',
                padding:'4px 14px', fontFamily:'JetBrains Mono', fontSize:10,
                letterSpacing:0.8, cursor:'pointer', marginLeft:4 }}>
              SEND
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// IQ PANEL — constellation + metrics
// =========================================================================
function IQPanel({ panel, mode }) {
  const canvasRef = useRef(null);
  const [modulation, setModulation] = useState('QPSK');
  const [symbolRate, setSymbolRate] = useState('5.0 Msym/s');
  const [trailLen, setTrailLen] = useState(400);
  const t = useTicker(mode === 'live');

  const constellations = {
    'QPSK': [[1,1],[1,-1],[-1,1],[-1,-1]],
    '16QAM': (()=>{const p=[]; for(let i=-3;i<=3;i+=2) for(let j=-3;j<=3;j+=2) p.push([i/3,j/3]); return p;})(),
    '64QAM': (()=>{const p=[]; for(let i=-7;i<=7;i+=2) for(let j=-7;j<=7;j+=2) p.push([i/7,j/7]); return p;})(),
    '8PSK': Array.from({length:8}, (_,k)=>[Math.cos(k*Math.PI/4), Math.sin(k*Math.PI/4)]),
  };
  const ideal = constellations[modulation];

  // synthesize recent IQ samples around ideal points
  const samples = useMemo(() => {
    const out = [];
    const noise = 0.06 + Math.sin(t*0.5)*0.01;
    for (let i = 0; i < trailLen; i++) {
      const p = ideal[Math.floor(Math.random()*ideal.length)];
      out.push([
        p[0] + (Math.random()-0.5) * noise + Math.sin(i*0.1 + t)*0.015,
        p[1] + (Math.random()-0.5) * noise + Math.cos(i*0.12 + t)*0.015,
      ]);
    }
    return out;
  }, [modulation, trailLen, t]);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr; c.height = rect.height * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    ctx.fillStyle = '#0f1113';
    ctx.fillRect(0, 0, W, H);
    const cx = W/2, cy = H/2, R = Math.min(W, H)/2 - 16;

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      if (i === 0) continue;
      ctx.beginPath(); ctx.moveTo(cx + R*i/4, cy - R); ctx.lineTo(cx + R*i/4, cy + R); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - R, cy + R*i/4); ctx.lineTo(cx + R, cy + R*i/4); ctx.stroke();
    }
    // unit circle
    ctx.strokeStyle = 'rgba(229,162,74,0.18)';
    ctx.beginPath(); ctx.arc(cx, cy, R*0.7, 0, 2*Math.PI); ctx.stroke();
    // axes
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
    // axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px JetBrains Mono';
    ctx.textAlign = 'right'; ctx.fillText('I', cx + R - 4, cy - 4);
    ctx.textAlign = 'left';  ctx.fillText('Q', cx + 4, cy - R + 10);

    // persistence samples
    samples.forEach((s, i) => {
      const age = i / samples.length;
      const alpha = 0.2 + age * 0.5;
      ctx.fillStyle = `rgba(79,179,182,${alpha})`;
      ctx.fillRect(cx + s[0]*R*0.7 - 1.2, cy - s[1]*R*0.7 - 1.2, 2.4, 2.4);
    });
    // ideal points
    ideal.forEach(p => {
      ctx.fillStyle = '#f4d65a';
      ctx.beginPath(); ctx.arc(cx + p[0]*R*0.7, cy - p[1]*R*0.7, 3.5, 0, 2*Math.PI); ctx.fill();
      ctx.strokeStyle = 'rgba(15,17,19,0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }, [samples, modulation]);

  // compute fake metrics
  const evm = (2.1 + Math.sin(t*0.3)*0.6).toFixed(2);
  const mer = (34.8 - Math.sin(t*0.3)*1.2).toFixed(1);
  const snr = (28.4 - Math.sin(t*0.4)*0.8).toFixed(1);
  const ber = '3.2e-6';
  const iqGain = (-0.18 + Math.sin(t*0.2)*0.03).toFixed(2);
  const iqPhase = (1.24 + Math.cos(t*0.25)*0.2).toFixed(2);

  return (
    <div style={{ display:'grid', gridTemplateRows:'28px 1fr', height:'100%', background:'var(--bg-1)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 10px',
        background:'var(--bg-2)', borderBottom:'1px solid var(--line-2)', fontSize:10 }}>
        <span style={{ color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, fontSize:9 }}>Modulation</span>
        <select value={modulation} onChange={e => setModulation(e.target.value)}
          style={{ background:'transparent', border:'none', color:'var(--amber-0)',
            fontSize:10.5, fontFamily:'JetBrains Mono', outline:'none', cursor:'pointer' }}>
          {Object.keys(constellations).map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <span style={{ color:'var(--fg-3)' }}>·</span>
        <span className="mono" style={{ color:'var(--fg-1)' }}>{symbolRate}</span>
        <span style={{ color:'var(--fg-3)' }}>·</span>
        <span className="mono" style={{ color:'var(--fg-1)' }}>RRC α=0.35</span>
        <div style={{ flex:1 }}/>
        <span className="mono" style={{ color:'var(--ok)' }}>● LOCKED</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 160px', minHeight:0 }}>
        <div style={{ position:'relative' }}>
          <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }}/>
        </div>
        <div style={{ borderLeft:'1px solid var(--line-1)', padding:'8px 10px', overflow:'auto' }}>
          <div style={{ fontSize:9, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1.2, marginBottom:6 }}>
            Signal Quality
          </div>
          {[
            ['EVM',    `${evm} %`,  +evm < 3 ? 'var(--ok)' : 'var(--warn)'],
            ['MER',    `${mer} dB`, +mer > 30 ? 'var(--ok)' : 'var(--warn)'],
            ['SNR',    `${snr} dB`, +snr > 20 ? 'var(--ok)' : 'var(--warn)'],
            ['BER',    ber,         'var(--ok)'],
            ['I/Q Gain Imb',  `${iqGain} dB`, 'var(--fg-1)'],
            ['I/Q Phase',     `${iqPhase}°`,  'var(--fg-1)'],
            ['Freq Offset',   '+12 Hz',      'var(--fg-1)'],
            ['Pwr',           '-24.8 dBm',   'var(--fg-1)'],
          ].map(([l,v,c],i) => (
            <div key={i} style={{ marginBottom:8 }}>
              <div style={{ fontSize:9, color:'var(--fg-3)' }}>{l}</div>
              <div style={{ fontSize:16, color: c, fontFamily:'JetBrains Mono', fontWeight:500 }}>{v}</div>
            </div>
          ))}

          <div style={{ marginTop:10, padding:'6px 0', borderTop:'1px solid var(--line-1)' }}>
            <div style={{ fontSize:9, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1.2, marginBottom:6 }}>
              Persistence
            </div>
            <input type="range" min="50" max="2000" step="50" value={trailLen}
              onChange={e => setTrailLen(+e.target.value)}
              style={{ width:'100%', accentColor:'var(--amber-1)' }}/>
            <div className="mono" style={{ fontSize:10, color:'var(--fg-2)', textAlign:'right' }}>{trailLen} syms</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// EYE DIAGRAM PANEL — persistence-fold + mask + jitter
// =========================================================================
function EyePanel({ panel, mode }) {
  const canvasRef = useRef(null);
  const [bitRate, setBitRate] = useState('10 Mbps');
  const [showMask, setShowMask] = useState(true);
  const [maskMargin, setMaskMargin] = useState(20);
  const t = useTicker(mode === 'live');

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr; c.height = rect.height * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;

    ctx.fillStyle = '#0f1113';
    ctx.fillRect(0, 0, W, H);

    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let i = 1; i < 10; i++) {
      ctx.beginPath(); ctx.moveTo(W*i/10, 0); ctx.lineTo(W*i/10, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, H*i/10); ctx.lineTo(W, H*i/10); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.moveTo(0, H/2); ctx.lineTo(W, H/2); ctx.stroke();
    // 25% and 75% UI markers
    ctx.strokeStyle = 'rgba(229,162,74,0.3)';
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(W*0.25, 0); ctx.lineTo(W*0.25, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W*0.75, 0); ctx.lineTo(W*0.75, H); ctx.stroke();
    ctx.setLineDash([]);

    // mask region
    if (showMask) {
      const maskY = H*0.5;
      const openH = H*0.3;
      const openLeft = W*0.28, openRight = W*0.72;
      ctx.fillStyle = 'rgba(216,99,74,0.10)';
      // top forbidden
      ctx.beginPath();
      ctx.moveTo(openLeft, 0); ctx.lineTo(openRight, 0);
      ctx.lineTo(openRight, maskY - openH/2);
      ctx.lineTo((openLeft+openRight)/2, maskY - openH/2 - 6);
      ctx.lineTo(openLeft, maskY - openH/2);
      ctx.closePath(); ctx.fill();
      // bottom forbidden
      ctx.beginPath();
      ctx.moveTo(openLeft, H); ctx.lineTo(openRight, H);
      ctx.lineTo(openRight, maskY + openH/2);
      ctx.lineTo((openLeft+openRight)/2, maskY + openH/2 + 6);
      ctx.lineTo(openLeft, maskY + openH/2);
      ctx.closePath(); ctx.fill();
      // mask outlines
      ctx.strokeStyle = 'rgba(216,99,74,0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(openLeft, maskY - openH/2, openRight - openLeft, openH);
      ctx.setLineDash([]);
    }

    // many traces — eye persistence
    const nTraces = 120;
    const samplesPerUI = 160;
    ctx.lineWidth = 1;
    for (let tr = 0; tr < nTraces; tr++) {
      const jitterT = (Math.random()-0.5) * 0.06;
      const ampJ    = (Math.random()-0.5) * 0.08;
      const level   = Math.random() > 0.5 ? 1 : -1;
      const prevLevel = Math.random() > 0.5 ? 1 : -1;
      ctx.strokeStyle = `rgba(244,214,90,${0.08 + Math.random()*0.15})`;
      ctx.beginPath();
      for (let s = 0; s <= samplesPerUI; s++) {
        const u = s / samplesPerUI;
        // shift by jitter
        const uShift = u + jitterT - 0.5;
        // smoothstep transition centered at 0
        let v;
        if (uShift < -0.35) v = prevLevel;
        else if (uShift > 0.35) v = level;
        else {
          const k = (uShift + 0.35) / 0.7;
          const smooth = k*k*(3 - 2*k);
          v = prevLevel + (level - prevLevel) * smooth;
        }
        v += ampJ + (Math.random()-0.5) * 0.025;
        // wrap UI: draw two UIs side by side
        const x = u * W;
        const y = H/2 - v * H*0.38;
        s === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // axes labels
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '9px JetBrains Mono';
    ctx.textAlign = 'left';
    ctx.fillText('-1 UI', 4, H - 5);
    ctx.textAlign = 'center';
    ctx.fillText('0', W/2, H - 5);
    ctx.textAlign = 'right';
    ctx.fillText('+1 UI', W - 4, H - 5);
  }, [t, showMask]);

  const eyeHeight = (0.68 - Math.sin(t*0.3)*0.02).toFixed(3);
  const eyeWidth  = (0.82 - Math.sin(t*0.25)*0.015).toFixed(3);
  const jRms    = (11.2 + Math.sin(t*0.4)*0.8).toFixed(1);
  const jPk     = (42.5 + Math.sin(t*0.3)*2).toFixed(1);
  const maskHits = Math.max(0, Math.floor(2 + Math.sin(t*0.2)*3));
  const maskStatus = maskHits === 0 ? 'var(--ok)' : 'var(--alarm)';

  return (
    <div style={{ display:'grid', gridTemplateRows:'28px 1fr 84px', height:'100%', background:'var(--bg-1)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 10px',
        background:'var(--bg-2)', borderBottom:'1px solid var(--line-2)', fontSize:10 }}>
        <span style={{ color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, fontSize:9 }}>Eye Diagram</span>
        <span style={{ color:'var(--fg-3)' }}>·</span>
        <span className="mono" style={{ color:'var(--fg-1)' }}>{bitRate}</span>
        <span style={{ color:'var(--fg-3)' }}>·</span>
        <span className="mono" style={{ color:'var(--fg-1)' }}>NRZ</span>
        <span style={{ color:'var(--fg-3)' }}>·</span>
        <span className="mono" style={{ color:'var(--fg-2)' }}>120 traces folded</span>
        <div style={{ flex:1 }}/>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, color:'var(--fg-1)' }}>
          <input type="checkbox" checked={showMask} onChange={e => setShowMask(e.target.checked)}
            style={{ accentColor:'var(--amber-1)' }}/>
          mask
        </label>
        <span className="mono" style={{ color: maskStatus, fontSize:10 }}>
          {maskHits === 0 ? '● MASK OK' : `● ${maskHits} HITS`}
        </span>
      </div>

      <canvas ref={canvasRef} style={{ width:'100%', height:'100%', display:'block' }}/>

      <div style={{
        borderTop:'1px solid var(--line-2)', background:'var(--bg-2)',
        display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:1,
        padding:1,
      }}>
        {[
          ['Eye Height',  eyeHeight,     ''],
          ['Eye Width',   eyeWidth,     'UI'],
          ['Jitter RMS',  jRms,         'ps'],
          ['Jitter p-p',  jPk,          'ps'],
          ['Crossing',    '49.8',       '%'],
          ['Rise / Fall', '18 / 17',    'ps'],
        ].map(([l,v,u],i) => (
          <div key={i} style={{ padding:'8px 10px', background:'var(--bg-1)' }}>
            <div style={{ fontSize:9, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1 }}>{l}</div>
            <div style={{ fontSize:14, color:'var(--fg-0)', fontFamily:'JetBrains Mono', marginTop:2 }}>
              {v}
              {u && <span style={{ color:'var(--fg-3)', fontSize:10, marginLeft:4 }}>{u}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { SpectrumPanel, AnalyzerControlPanel, IQPanel, EyePanel, KEY_INSTRUMENTS });

// Sequence Validator + Test Report generator.
//
// SequenceValidator: define an expected ordered sequence of signal events
// (edges, state transitions, threshold crossings, value matches). Either
// hand-edit steps, or import by "capture" — record a recent run and the
// system extracts a canonical sequence the user can save as a template.
// At run time each frame is matched against the current expected step;
// tolerance windows, dwell, and timeouts are enforced. Misordered or missing
// signals surface as failures with the offending step highlighted.
//
// TestReportModal: generates a PASS/FAIL acceptance report (PDF-ready layout)
// combining (a) per-channel min/avg/max/stdev vs. the alarm thresholds defined
// in the Channel Mapping Editor and (b) results of any defined sequence runs.
// The modal is sized to an A4 page so Cmd-P produces a clean handoff.

// ---- sample sequence templates ------------------------------------------
const SEQ_STEPS_STARTUP = [
  { id:'s1', idx:1, name:'28V bus rises',        channelId:1001, kind:'threshold', op:'>=', value:24.0, tol:0.5,  dwellMs:200, timeoutMs:5000, tWindow:[0, 4000] },
  { id:'s2', idx:2, name:'PDU mode → RUN',       channelId:1007, kind:'enum',      op:'==', value:'run', stateBits:'3..5',      dwellMs:100, timeoutMs:3000, tWindow:[500, 6000] },
  { id:'s3', idx:3, name:'Hyd A pressurizes',    channelId:1205, kind:'threshold', op:'>=', value:150,  tol:5,    dwellMs:300, timeoutMs:8000, tWindow:[1000, 10000] },
  { id:'s4', idx:4, name:'Hyd B pressurizes',    channelId:1206, kind:'threshold', op:'>=', value:150,  tol:5,    dwellMs:300, timeoutMs:8000, tWindow:[1000, 10000] },
  { id:'s5', idx:5, name:'IMU roll stabilizes',  channelId:2210, kind:'settle',    op:'|<|', value:1.0, tol:0.2,  dwellMs:500, timeoutMs:12000, tWindow:[3000, 15000] },
  { id:'s6', idx:6, name:'Link SNR > 18 dB',     channelId:5003, kind:'threshold', op:'>=', value:18,   tol:0,    dwellMs:1000, timeoutMs:15000, tWindow:[3000, 18000] },
  { id:'s7', idx:7, name:'Video lock',           channelId:7001, kind:'event',     op:'==', value:'sync_ok',                   dwellMs:0,   timeoutMs:10000, tWindow:[4000, 18000] },
];

const SEQ_STEPS_SHUTDOWN = [
  { id:'s1', idx:1, name:'Command DISARM',       channelId:1007, kind:'enum',      op:'==', value:'std', stateBits:'3..5',     dwellMs:100, timeoutMs:2000, tWindow:[0, 3000] },
  { id:'s2', idx:2, name:'Hyd A decays',         channelId:1205, kind:'threshold', op:'<=', value:30,    tol:5,   dwellMs:500, timeoutMs:10000, tWindow:[500, 12000] },
  { id:'s3', idx:3, name:'Hyd B decays',         channelId:1206, kind:'threshold', op:'<=', value:30,    tol:5,   dwellMs:500, timeoutMs:10000, tWindow:[500, 12000] },
  { id:'s4', idx:4, name:'Bus current < 4A',     channelId:1002, kind:'threshold', op:'<=', value:4,     tol:0.5, dwellMs:1000, timeoutMs:15000, tWindow:[2000, 18000] },
  { id:'s5', idx:5, name:'Power rail off',       channelId:1001, kind:'threshold', op:'<=', value:2,     tol:0.5, dwellMs:200, timeoutMs:20000, tWindow:[5000, 25000] },
];

const SEQUENCES = [
  { id:'seq-startup',  name:'Engine Start · Nominal',     source:'captured 2026-04-18 11:22',
    bindPolicy:'strict-order', steps: SEQ_STEPS_STARTUP,
    lastRun: { verdict:'pass', durationMs: 14820, failedAt: null, runAt: '2026-04-20 09:11' } },
  { id:'seq-shutdown', name:'Shutdown · Controlled',      source:'hand-authored',
    bindPolicy:'strict-order', steps: SEQ_STEPS_SHUTDOWN,
    lastRun: { verdict:'fail', durationMs: 12040, failedAt: 4, runAt: '2026-04-20 10:44',
               failReason:'bus current timeout — expected <=4A within 15s, observed 6.2A at T+16.8s' } },
  { id:'seq-emergency', name:'Emergency Descent',          source:'captured 2026-04-15 04:30',
    bindPolicy:'strict-order', steps: [], lastRun: null },
];

const OP_LABEL = {
  '>=':'≥','<=':'≤','>':'>','<':'<','==':'=','!=':'≠','|<|':'|·| <','|>|':'|·| >',
};
const STEP_KINDS = [
  { k:'threshold', label:'THRESHOLD', desc:'value crosses limit' },
  { k:'edge',      label:'EDGE',      desc:'rising/falling edge' },
  { k:'enum',      label:'ENUM',      desc:'discrete state match' },
  { k:'event',     label:'EVENT',     desc:'named event token' },
  { k:'settle',    label:'SETTLE',    desc:'within band for dwell' },
  { k:'custom',    label:'CUSTOM',    desc:'custom formula' },
];

// Mock result dataset used by the run/report views
function mockRunResult(seq) {
  // Given a sequence, fabricate per-step pass/fail + timing
  if (!seq.steps.length) return null;
  const failedAt = seq.lastRun?.failedAt ?? null;
  let t = 0;
  return {
    verdict: seq.lastRun?.verdict ?? 'pending',
    runAt: seq.lastRun?.runAt ?? '—',
    durationMs: seq.lastRun?.durationMs ?? 0,
    steps: seq.steps.map((st, i) => {
      const targetMs = st.tWindow ? st.tWindow[0] + (st.tWindow[1] - st.tWindow[0]) * 0.35 : (i+1)*1200;
      const actualMs = targetMs + (Math.sin(i*1.7) * 180 | 0);
      const isFail = failedAt === st.idx;
      const isSkipped = failedAt !== null && st.idx > failedAt;
      t = Math.max(t, actualMs);
      return {
        stepId: st.id, idx: st.idx,
        status: isSkipped ? 'skipped' : (isFail ? 'fail' : 'pass'),
        targetMs, actualMs: isSkipped ? null : actualMs,
        deltaMs: isSkipped ? null : (actualMs - targetMs),
        observed: isFail ? '6.2A @ T+16.8s (timeout)' : `${st.op} ${st.value}${st.tol ? ' ±'+st.tol : ''}`,
        margin: isFail ? null : (Math.random() * 0.3 + 0.1),
      };
    }),
  };
}

// ==========================================================================
// STEP ROW inside the sequence editor
// ==========================================================================
function StepRow({ step, runStep, selected, onSelect, onPatch, onDelete }) {
  const ch = ALL_CHANNELS.find(c => c.id === step.channelId);
  const kind = STEP_KINDS.find(k => k.k === step.kind) || STEP_KINDS[0];
  const status = runStep?.status || 'idle';
  const statusColor = status === 'pass' ? 'var(--ok)'
                    : status === 'fail' ? 'var(--alarm)'
                    : status === 'skipped' ? 'var(--fg-3)'
                    : 'var(--fg-2)';
  return (
    <div onClick={onSelect}
      style={{
        display:'grid',
        gridTemplateColumns:'28px 14px 1.3fr 0.9fr 0.45fr 0.8fr 0.45fr 0.45fr 0.55fr 0.6fr 24px',
        gap: 6, alignItems:'center',
        padding:'5px 8px',
        background: selected ? 'var(--bg-3)' : 'transparent',
        borderLeft: selected ? '2px solid var(--amber-0)' : '2px solid transparent',
        borderBottom:'1px solid var(--line-0)',
        cursor:'pointer',
      }}>
      <span className="mono" style={{ color:'var(--amber-0)', fontSize:11, textAlign:'center' }}>{step.idx}.</span>
      <span title={status}
        style={{ display:'inline-block', width:8, height:8, borderRadius:'50%',
          background: statusColor,
          boxShadow: status==='pass' ? '0 0 6px rgba(122,168,116,0.5)'
                   : status==='fail' ? '0 0 8px rgba(216,99,74,0.7)' : 'none' }}/>
      <input value={step.name} className="cme-cell"
        onClick={e => e.stopPropagation()}
        onChange={e => onPatch({ name: e.target.value })}/>
      <select value={step.channelId} className="cme-cell mono"
        onClick={e => e.stopPropagation()}
        onChange={e => onPatch({ channelId: +e.target.value })}>
        {ALL_CHANNELS.map(c => <option key={c.id} value={c.id}>{c.id} · {c.name}</option>)}
      </select>
      <select value={step.kind} className="cme-cell mono" style={{ fontSize:10 }}
        onClick={e => e.stopPropagation()}
        onChange={e => onPatch({ kind: e.target.value })}>
        {STEP_KINDS.map(k => <option key={k.k} value={k.k}>{k.label}</option>)}
      </select>
      <select value={step.op} className="cme-cell mono" style={{ fontSize:10, textAlign:'center' }}
        onClick={e => e.stopPropagation()}
        onChange={e => onPatch({ op: e.target.value })}>
        {Object.keys(OP_LABEL).map(o => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
      </select>
      <input value={step.value} className="cme-cell mono" style={{ textAlign:'right' }}
        onClick={e => e.stopPropagation()}
        onChange={e => onPatch({ value: isNaN(+e.target.value) ? e.target.value : +e.target.value })}/>
      <input type="number" step="any" value={step.tol ?? 0} className="cme-cell mono" style={{ textAlign:'right' }}
        onClick={e => e.stopPropagation()}
        onChange={e => onPatch({ tol: +e.target.value })}
        title="tolerance"/>
      <input type="number" value={step.dwellMs} className="cme-cell mono" style={{ textAlign:'right' }}
        onClick={e => e.stopPropagation()}
        onChange={e => onPatch({ dwellMs: +e.target.value })}
        title="dwell ms"/>
      <input type="number" value={step.timeoutMs} className="cme-cell mono" style={{ textAlign:'right' }}
        onClick={e => e.stopPropagation()}
        onChange={e => onPatch({ timeoutMs: +e.target.value })}
        title="timeout ms"/>
      <button onClick={e => { e.stopPropagation(); onDelete(); }}
        style={{ background:'transparent', border:'none', color:'var(--fg-3)', cursor:'pointer', fontSize:13 }}>×</button>
    </div>
  );
}

// ==========================================================================
// SEQUENCE TIMELINE — horizontal gantt of expected vs actual step timing
// ==========================================================================
function SequenceTimeline({ seq, run, selectedId, onSelect }) {
  if (!seq.steps.length) return (
    <div style={{ padding:20, fontSize:10, color:'var(--fg-3)', textAlign:'center' }}>
      no steps defined — capture a run or add steps manually
    </div>
  );
  const maxT = Math.max(...seq.steps.map(s => s.tWindow?.[1] || 10000), 1000);
  const W = 720;
  const rowH = 16;
  const H = seq.steps.length * rowH + 20;
  const sx = (ms) => (ms / maxT) * (W - 140) + 130;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height: H }}>
      {/* time ruler */}
      <line x1="130" x2={W-10} y1="10" y2="10" stroke="var(--line-1)"/>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <g key={i}>
          <line x1={sx(maxT*f)} y1="8" x2={sx(maxT*f)} y2="12" stroke="var(--fg-3)"/>
          <text x={sx(maxT*f)} y="7" textAnchor="middle" fontSize="8" fill="var(--fg-3)" fontFamily="JetBrains Mono">
            {(maxT*f/1000).toFixed(1)}s
          </text>
        </g>
      ))}
      {seq.steps.map((st, i) => {
        const runStep = run?.steps[i];
        const y = 20 + i * rowH;
        const ch = ALL_CHANNELS.find(c => c.id === st.channelId);
        const statusColor = runStep?.status === 'pass' ? 'var(--ok)'
                          : runStep?.status === 'fail' ? 'var(--alarm)'
                          : runStep?.status === 'skipped' ? 'var(--fg-3)'
                          : 'var(--fg-2)';
        const hi = selectedId === st.id;
        return (
          <g key={st.id} onClick={() => onSelect?.(st.id)} style={{ cursor:'pointer' }}>
            <rect x={0} y={y-1} width={W} height={rowH-1}
              fill={hi ? 'var(--bg-3)' : 'transparent'}/>
            <text x={4} y={y+10} fontSize="9" fill="var(--amber-0)" fontFamily="JetBrains Mono">
              {st.idx}.
            </text>
            <text x={16} y={y+10} fontSize="9" fill="var(--fg-1)" fontFamily="IBM Plex Sans">
              {st.name.length > 20 ? st.name.slice(0, 19) + '…' : st.name}
            </text>
            {/* expected window */}
            {st.tWindow && (
              <rect x={sx(st.tWindow[0])} y={y+3} width={sx(st.tWindow[1]) - sx(st.tWindow[0])} height={rowH-6}
                fill="var(--amber-1)" opacity="0.15" stroke="var(--amber-2)" strokeDasharray="2 2" strokeWidth="1"/>
            )}
            {/* actual marker */}
            {runStep?.actualMs != null && (
              <>
                <line x1={sx(runStep.actualMs)} x2={sx(runStep.actualMs)} y1={y+2} y2={y+rowH-3}
                  stroke={statusColor} strokeWidth="2"/>
                <circle cx={sx(runStep.actualMs)} cy={y+rowH/2} r="3" fill={statusColor}/>
              </>
            )}
            {/* fail icon */}
            {runStep?.status === 'fail' && (
              <text x={W-6} y={y+11} textAnchor="end" fontSize="10" fill="var(--alarm)" fontFamily="JetBrains Mono">
                ✕ FAIL
              </text>
            )}
            {runStep?.status === 'skipped' && (
              <text x={W-6} y={y+11} textAnchor="end" fontSize="9" fill="var(--fg-3)" fontFamily="JetBrains Mono">
                — skipped
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ==========================================================================
// CAPTURE WIZARD — overlay showing the "capture from live" flow
// ==========================================================================
function CaptureWizard({ open, onClose, onCapture }) {
  const [phase, setPhase] = useState('arm'); // arm | recording | review
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (phase !== 'recording') return;
    const id = setInterval(() => setElapsed(e => e + 0.1), 100);
    return () => clearInterval(id);
  }, [phase]);

  if (!open) return null;
  const candidates = [
    { ch:1001, name:'bus_volt_28v', event:'rose from 0.3 → 27.8 V',       t:0.84, pick:true },
    { ch:1007, name:'pdu.mode',     event:"state 'bit' → 'run'",          t:1.22, pick:true },
    { ch:1205, name:'hyd_pA',       event:'≥ 150 bar (0.4s dwell)',       t:3.61, pick:true },
    { ch:1206, name:'hyd_pB',       event:'≥ 150 bar (0.5s dwell)',       t:3.78, pick:true },
    { ch:2210, name:'imu_roll',     event:'settled |·| < 1.0°',           t:6.91, pick:true },
    { ch:5003, name:'link_snr',     event:'≥ 18 dB (1s dwell)',           t:8.24, pick:true },
    { ch:7001, name:'cam_front',    event:"event 'sync_ok'",              t:9.02, pick:true },
    { ch:1002, name:'bus_cur_28v',  event:'brief spike 22A',              t:0.92, pick:false },
    { ch:2215, name:'accel_z',      event:'noise burst > 3g',             t:4.10, pick:false },
  ];

  return (
    <div style={{ position:'fixed', inset:0, zIndex:250, background:'rgba(15,17,19,0.85)',
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ width:640, background:'var(--bg-1)', border:'1px solid var(--amber-1)', boxShadow:'0 20px 48px rgba(0,0,0,0.7)' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--line-1)',
          display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:11, fontWeight:600, letterSpacing:1.2, textTransform:'uppercase', color:'var(--amber-0)' }}>
            Capture sequence from live run
          </span>
          <div style={{ flex:1 }}/>
          <button className="tb-btn" onClick={onClose}>Cancel</button>
        </div>

        {phase === 'arm' && (
          <div style={{ padding:20 }}>
            <div style={{ fontSize:11.5, color:'var(--fg-1)', lineHeight:1.7, marginBottom:14 }}>
              Demonstrate the procedure end-to-end on the live data feed. RTI will watch every
              channel and extract a canonical ordered signal sequence — edges, state changes,
              threshold crossings, and settle bands — that you can save as a reusable test template.
            </div>
            <div style={{ background:'var(--bg-0)', border:'1px solid var(--line-1)', padding:12, marginBottom:14 }}>
              <div style={{ fontSize:9.5, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, marginBottom:8 }}>
                Extraction scope
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:'6px 12px', fontSize:10.5 }}>
                <span style={{ color:'var(--fg-3)' }}>Channels</span>
                <span style={{ color:'var(--fg-1)' }}>all favorited · 17 channels</span>
                <span style={{ color:'var(--fg-3)' }}>Minimum dwell</span>
                <span style={{ color:'var(--fg-1)' }}>100 ms</span>
                <span style={{ color:'var(--fg-3)' }}>Edge sensitivity</span>
                <span style={{ color:'var(--fg-1)' }}>medium · 5% of Y-range</span>
                <span style={{ color:'var(--fg-3)' }}>Max duration</span>
                <span style={{ color:'var(--fg-1)' }}>60 s</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="tb-btn" onClick={onClose}>Back</button>
              <button className="tb-btn primary" onClick={() => setPhase('recording')}>● Arm & record</button>
            </div>
          </div>
        )}

        {phase === 'recording' && (
          <div style={{ padding:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <span style={{ display:'inline-block', width:12, height:12, borderRadius:'50%',
                background:'var(--alarm)', boxShadow:'0 0 12px rgba(216,99,74,0.7)',
                animation:'led-blink 0.8s infinite' }}/>
              <span style={{ fontSize:14, color:'var(--fg-0)' }}>Recording procedure…</span>
              <div style={{ flex:1 }}/>
              <span className="mono" style={{ fontSize:13, color:'var(--amber-0)' }}>{elapsed.toFixed(1)}s</span>
            </div>
            <div style={{ background:'var(--bg-0)', border:'1px solid var(--line-1)', padding:12, fontFamily:'JetBrains Mono', fontSize:10.5, color:'var(--fg-2)', minHeight:120 }}>
              {elapsed > 1.0 && <div>T+0.84s  edge  bus_volt_28v  0.3 → 27.8 V ✓ captured</div>}
              {elapsed > 1.8 && <div>T+1.22s  state pdu.mode       bit → run   ✓ captured</div>}
              {elapsed > 4.0 && <div>T+3.61s  thrs  hyd_pA          ≥150 bar    ✓ captured</div>}
              {elapsed > 4.2 && <div>T+3.78s  thrs  hyd_pB          ≥150 bar    ✓ captured</div>}
              {elapsed > 7.0 && <div>T+6.91s  settl imu_roll        |·|&lt;1°     ✓ captured</div>}
              {elapsed > 8.8 && <div>T+8.24s  thrs  link_snr        ≥18 dB      ✓ captured</div>}
              {elapsed > 9.5 && <div>T+9.02s  evnt  cam_front       sync_ok     ✓ captured</div>}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:14 }}>
              <button className="tb-btn" onClick={() => { setPhase('review'); setElapsed(0); }}>■ Stop & review</button>
            </div>
          </div>
        )}

        {phase === 'review' && (
          <div style={{ padding:20, maxHeight:'70vh', overflow:'auto' }}>
            <div style={{ fontSize:11, color:'var(--fg-1)', marginBottom:12 }}>
              Extracted <span style={{ color:'var(--amber-0)' }}>9</span> candidate signal events.
              Uncheck anything that is incidental (noise bursts, transients). Selected events will
              become ordered sequence steps.
            </div>
            <div style={{ background:'var(--bg-0)', border:'1px solid var(--line-1)' }}>
              {candidates.map((c, i) => (
                <div key={i} style={{
                  display:'grid', gridTemplateColumns:'20px 60px 120px 1fr 70px',
                  gap:8, padding:'5px 10px', fontSize:10.5, alignItems:'center',
                  borderBottom: i < candidates.length-1 ? '1px solid var(--line-0)' : 'none',
                  opacity: c.pick ? 1 : 0.45,
                }}>
                  <input type="checkbox" defaultChecked={c.pick} style={{ accentColor:'var(--amber-1)' }}/>
                  <span className="mono" style={{ color:'var(--amber-0)' }}>T+{c.t.toFixed(2)}s</span>
                  <span className="mono" style={{ color:'var(--fg-1)' }}>{c.name}</span>
                  <span style={{ color:'var(--fg-1)' }}>{c.event}</span>
                  <span style={{ color:'var(--fg-3)', fontSize:9, textTransform:'uppercase', letterSpacing:0.8 }}>
                    #{c.ch}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:14 }}>
              <button className="tb-btn" onClick={() => setPhase('arm')}>← Retry</button>
              <button className="tb-btn primary" onClick={() => { onCapture(); onClose(); }}>
                Save as sequence template
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================================================
// SEQUENCE VALIDATOR MODAL
// ==========================================================================
function SequenceValidator({ open, onClose, onOpenReport }) {
  const [seqs, setSeqs] = useState(SEQUENCES);
  const [selId, setSelId] = useState('seq-startup');
  const [selStep, setSelStep] = useState(null);
  const [running, setRunning] = useState(false);
  const [runT, setRunT] = useState(0);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setRunT(t => t + 0.1), 100);
    return () => clearInterval(id);
  }, [running]);

  if (!open) return null;

  const seq = seqs.find(x => x.id === selId);
  const run = seq ? mockRunResult(seq) : null;

  const patchStep = (stepId, patch) => {
    setSeqs(ss => ss.map(s => s.id !== selId ? s : {
      ...s, steps: s.steps.map(st => st.id === stepId ? { ...st, ...patch } : st)
    }));
    setDirty(true);
  };
  const addStep = () => {
    setSeqs(ss => ss.map(s => {
      if (s.id !== selId) return s;
      const nIdx = s.steps.length + 1;
      return {
        ...s, steps: [...s.steps, {
          id:'s'+Date.now(), idx: nIdx, name:'new step',
          channelId: 1001, kind:'threshold', op:'>=', value: 0, tol: 0,
          dwellMs: 100, timeoutMs: 5000, tWindow: [0, 5000],
        }]
      };
    }));
    setDirty(true);
  };
  const delStep = (stepId) => {
    setSeqs(ss => ss.map(s => s.id !== selId ? s : {
      ...s, steps: s.steps.filter(st => st.id !== stepId).map((st, i) => ({ ...st, idx: i+1 }))
    }));
    setDirty(true);
  };

  const verdictColor = (v) => v === 'pass' ? 'var(--ok)' : v === 'fail' ? 'var(--alarm)' : 'var(--fg-2)';

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'var(--bg-0)', display:'flex', flexDirection:'column' }}>
      {/* header */}
      <div style={{ height:40, borderBottom:'1px solid var(--line-2)', background:'var(--bg-2)',
        display:'flex', alignItems:'center', padding:'0 16px', gap:14 }}>
        <span style={{ fontSize:11, fontWeight:600, letterSpacing:1.2, textTransform:'uppercase', color:'var(--amber-0)' }}>
          Sequence Validator
        </span>
        <span style={{ fontSize:10, color:'var(--fg-3)', letterSpacing:1, textTransform:'uppercase' }}>
          Procedure conformance · T-247
        </span>
        {dirty && <span style={{ fontSize:10, color:'var(--warn)', letterSpacing:1, textTransform:'uppercase' }}>● unsaved</span>}
        <div style={{ flex:1 }}/>
        <button className="tb-btn" onClick={() => setCaptureOpen(true)}>● Capture from live…</button>
        <button className="tb-btn">Import .seq…</button>
        <button className="tb-btn" onClick={onOpenReport}>Generate report →</button>
        <button className="tb-btn" onClick={onClose}>Close</button>
      </div>

      <div style={{ flex:1, display:'grid', gridTemplateColumns:'260px 1fr', minHeight:0 }}>
        {/* left list */}
        <div style={{ borderRight:'1px solid var(--line-1)', background:'var(--bg-1)', display:'flex', flexDirection:'column' }}>
          <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--line-1)', display:'flex', alignItems:'center' }}>
            <span style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, flex:1 }}>
              Templates · {seqs.length}
            </span>
            <button className="tb-btn" onClick={() => {
              const id = 'seq-'+Date.now();
              setSeqs(ss => [...ss, { id, name:'New sequence', source:'hand-authored', bindPolicy:'strict-order', steps:[], lastRun:null }]);
              setSelId(id);
            }} style={{ padding:'2px 8px' }}>+</button>
          </div>
          <div style={{ flex:1, overflow:'auto' }}>
            {seqs.map(x => {
              const v = x.lastRun?.verdict || 'pending';
              return (
                <div key={x.id} onClick={() => { setSelId(x.id); setSelStep(null); }}
                  style={{
                    padding:'10px 12px',
                    cursor:'pointer',
                    background: selId === x.id ? 'var(--bg-0)' : 'transparent',
                    borderLeft: selId === x.id ? '2px solid var(--amber-0)' : '2px solid transparent',
                    borderBottom:'1px solid var(--line-0)',
                  }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%',
                      background: verdictColor(v) }}/>
                    <span style={{ fontSize:11, color:'var(--fg-0)', flex:1 }}>{x.name}</span>
                    <span style={{ fontSize:9, color: verdictColor(v), textTransform:'uppercase', letterSpacing:0.8 }}>
                      {v}
                    </span>
                  </div>
                  <div style={{ fontSize:9.5, color:'var(--fg-3)', marginTop:3, marginLeft:16 }}>
                    {x.steps.length} steps · {x.source}
                  </div>
                  {x.lastRun && (
                    <div className="mono" style={{ fontSize:9, color:'var(--fg-3)', marginTop:2, marginLeft:16 }}>
                      last: {x.lastRun.runAt} · {(x.lastRun.durationMs/1000).toFixed(1)}s
                      {x.lastRun.failedAt && <span style={{ color:'var(--alarm)' }}> · failed step {x.lastRun.failedAt}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* right detail */}
        <div style={{ overflow:'auto', display:'flex', flexDirection:'column' }}>
          {/* sequence header */}
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--line-1)' }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:10 }}>
              <input value={seq.name} onChange={e => {
                setSeqs(ss => ss.map(s => s.id === selId ? { ...s, name: e.target.value } : s));
                setDirty(true);
              }} style={{
                background:'transparent', border:'none', color:'var(--fg-0)',
                fontSize:16, fontWeight:500, fontFamily:'inherit', outline:'none', padding:0,
              }}/>
              <span className="mono" style={{ fontSize:11, color:'var(--amber-0)' }}>#{seq.id}</span>
              <span style={{ fontSize:10, color:'var(--fg-3)', marginLeft:10, textTransform:'uppercase', letterSpacing:1 }}>
                {seq.source}
              </span>
              <div style={{ flex:1 }}/>
              <label style={{ fontSize:10, color:'var(--fg-2)', textTransform:'uppercase', letterSpacing:1, display:'flex', alignItems:'center', gap:6 }}>
                order
                <select value={seq.bindPolicy}
                  onChange={e => {
                    setSeqs(ss => ss.map(s => s.id === selId ? { ...s, bindPolicy: e.target.value } : s));
                    setDirty(true);
                  }}
                  className="cme-cell mono">
                  <option value="strict-order">strict</option>
                  <option value="any-order">any-order</option>
                  <option value="within-window">time-windowed</option>
                </select>
              </label>
            </div>

            {/* run controls */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {!running ? (
                <button className="tb-btn primary" onClick={() => { setRunning(true); setRunT(0); }}>▶ Run against live</button>
              ) : (
                <button className="tb-btn" onClick={() => setRunning(false)}>■ Stop</button>
              )}
              <button className="tb-btn">▶ Run against replay…</button>
              <div style={{ flex:1 }}/>
              {run && (
                <>
                  <span style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1 }}>last run</span>
                  <span className="mono" style={{ fontSize:11, color:'var(--fg-1)' }}>{seq.lastRun?.runAt ?? '—'}</span>
                  <span style={{
                    padding:'2px 10px',
                    fontSize:10, fontWeight:600, letterSpacing:1.2, textTransform:'uppercase',
                    color: verdictColor(run.verdict),
                    border: `1px solid ${verdictColor(run.verdict)}`,
                    background: run.verdict === 'pass' ? 'rgba(122,168,116,0.12)' : run.verdict === 'fail' ? 'rgba(216,99,74,0.12)' : 'transparent',
                  }}>
                    {run.verdict}
                    {run.verdict === 'fail' && run.steps.find(x=>x.status==='fail') && ` · step ${run.steps.find(x=>x.status==='fail').idx}`}
                  </span>
                </>
              )}
            </div>

            {running && (
              <div style={{ marginTop:10, padding:8, background:'var(--bg-0)', border:'1px solid var(--amber-1)', fontSize:10.5, color:'var(--fg-1)', fontFamily:'JetBrains Mono' }}>
                <span style={{ display:'inline-block', width:8, height:8, borderRadius:'50%',
                  background:'var(--alarm)', boxShadow:'0 0 6px rgba(216,99,74,0.7)',
                  animation:'led-blink 0.8s infinite', marginRight:8, verticalAlign:'middle' }}/>
                matching against live stream · T+{runT.toFixed(1)}s · watching step {Math.min(Math.floor(runT/2)+1, seq.steps.length)}/{seq.steps.length}
              </div>
            )}

            {seq.lastRun?.failReason && (
              <div style={{ marginTop:10, padding:8, background:'rgba(216,99,74,0.08)', border:'1px solid var(--alarm)', fontSize:11, color:'var(--fg-0)' }}>
                <span style={{ color:'var(--alarm)', fontWeight:600, marginRight:6, letterSpacing:1, textTransform:'uppercase', fontSize:10 }}>
                  Fail · step {seq.lastRun.failedAt}
                </span>
                {seq.lastRun.failReason}
              </div>
            )}
          </div>

          {/* step table */}
          <div style={{ padding:12 }}>
            <div style={{ display:'flex', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1 }}>
                Steps · {seq.steps.length}
              </span>
              <div style={{ flex:1 }}/>
              <button className="tb-btn" onClick={addStep}>+ Add step</button>
            </div>
            <div style={{ background:'var(--bg-1)', border:'1px solid var(--line-1)' }}>
              <div style={{
                display:'grid',
                gridTemplateColumns:'28px 14px 1.3fr 0.9fr 0.45fr 0.8fr 0.45fr 0.45fr 0.55fr 0.6fr 24px',
                gap:6, padding:'5px 8px',
                background:'var(--bg-2)', borderBottom:'1px solid var(--line-1)',
                fontSize:9, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:0.8,
              }}>
                <span>#</span><span/><span>Name</span><span>Channel</span><span>Kind</span>
                <span>Op · Value</span>
                <span style={{ textAlign:'right' }}>±Tol</span>
                <span style={{ textAlign:'right' }}>Dwell</span>
                <span style={{ textAlign:'right' }}>Tout</span>
                <span/>
                <span/>
              </div>
              {seq.steps.length === 0 ? (
                <div style={{ padding:20, textAlign:'center', fontSize:10, color:'var(--fg-3)' }}>
                  no steps — add manually or capture from a live run
                </div>
              ) : seq.steps.map((st, i) => (
                <StepRow key={st.id} step={st}
                  runStep={run?.steps[i]}
                  selected={selStep === st.id}
                  onSelect={() => setSelStep(st.id)}
                  onPatch={patch => patchStep(st.id, patch)}
                  onDelete={() => delStep(st.id)}/>
              ))}
            </div>
          </div>

          {/* gantt */}
          <div style={{ padding:'0 12px 12px' }}>
            <div style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>
              Timeline · expected window vs observed
            </div>
            <div style={{ background:'var(--bg-1)', border:'1px solid var(--line-1)', padding:8 }}>
              <SequenceTimeline seq={seq} run={run} selectedId={selStep} onSelect={setSelStep}/>
            </div>
            <div style={{ marginTop:6, fontSize:9, color:'var(--fg-3)', display:'flex', gap:14 }}>
              <span><span style={{ display:'inline-block', width:10, height:10, background:'var(--amber-1)', opacity:0.3, marginRight:4, verticalAlign:'middle' }}/>expected window</span>
              <span><span style={{ display:'inline-block', width:3, height:10, background:'var(--ok)', marginRight:4, verticalAlign:'middle' }}/>observed · pass</span>
              <span><span style={{ display:'inline-block', width:3, height:10, background:'var(--alarm)', marginRight:4, verticalAlign:'middle' }}/>observed · fail</span>
            </div>
          </div>
        </div>
      </div>

      <CaptureWizard open={captureOpen} onClose={() => setCaptureOpen(false)}
        onCapture={() => {
          // noop — demo; would insert a new captured sequence
          setDirty(true);
        }}/>
    </div>
  );
}

// ==========================================================================
// TEST REPORT MODAL — PASS/FAIL acceptance report, PDF-ready
// ==========================================================================

// Mock per-channel stats — in real code would derive from stored samples
function mockChannelStats(ch) {
  const base = (ch.id * 7.13) % 100;
  const min = ch.min ?? 0;
  const max = ch.max ?? 100;
  const span = max - min;
  const mean = min + span * 0.45 + (base % 10) * 0.01 * span;
  const stdev = span * 0.05 + (ch.id % 7) * 0.003 * span;
  const minObs = Math.max(min - span*0.05, mean - stdev * 2.2);
  const maxObs = Math.min(max + span*0.05, mean + stdev * 2.4);
  const p95 = mean + stdev * 1.64;
  const samples = 24000 + (ch.id % 30) * 120;
  return { min: minObs, mean, max: maxObs, stdev, p95, samples };
}

function ReportChannelRow({ ch, stats }) {
  const range = (ch.max ?? 1) - (ch.min ?? 0);
  const pct = (v) => range ? ((v - (ch.min ?? 0)) / range) * 100 : 50;

  // Figure out alarms — use static data (in real code pull from mapping state)
  const warnLimits  = ch.warn  || [];
  const alarmLimits = ch.alarm || [];
  const overWarn  = stats.max > (warnLimits[1]  ?? Infinity) || stats.min < (warnLimits[0]  ?? -Infinity);
  const overAlarm = stats.max > (alarmLimits[1] ?? Infinity) || stats.min < (alarmLimits[0] ?? -Infinity);
  const verdict = overAlarm ? 'FAIL' : overWarn ? 'MARGINAL' : 'PASS';
  const vColor  = verdict === 'PASS' ? 'var(--ok)' : verdict === 'FAIL' ? 'var(--alarm)' : 'var(--warn)';

  return (
    <tr style={{ borderBottom:'1px solid var(--line-0)' }}>
      <td className="mono" style={{ padding:'5px 8px', color:'var(--amber-0)', fontSize:10 }}>{ch.id}</td>
      <td style={{ padding:'5px 8px', fontSize:10.5 }}>{ch.name}
        <div style={{ fontSize:9, color:'var(--fg-3)', fontFamily:'IBM Plex Sans' }}>{ch.display}</div>
      </td>
      <td className="mono" style={{ padding:'5px 8px', fontSize:10, textAlign:'right' }}>{stats.min.toFixed(2)}</td>
      <td className="mono" style={{ padding:'5px 8px', fontSize:10, textAlign:'right' }}>{stats.mean.toFixed(2)}</td>
      <td className="mono" style={{ padding:'5px 8px', fontSize:10, textAlign:'right' }}>{stats.max.toFixed(2)}</td>
      <td className="mono" style={{ padding:'5px 8px', fontSize:10, textAlign:'right' }}>{stats.stdev.toFixed(3)}</td>
      <td className="mono" style={{ padding:'5px 8px', fontSize:9, color:'var(--fg-3)', textAlign:'right' }}>{stats.samples.toLocaleString()}</td>
      <td style={{ padding:'5px 8px', width:180 }}>
        {/* mini range bar */}
        <svg viewBox="0 0 180 18" style={{ width:180, height:18 }}>
          <line x1="4" x2="176" y1="9" y2="9" stroke="var(--line-1)" strokeWidth="1"/>
          {warnLimits.length === 2 && (
            <rect x={4 + pct(warnLimits[0])*1.72/100} y="4"
              width={Math.max(1, pct(warnLimits[1])*1.72/100 - pct(warnLimits[0])*1.72/100)}
              height="10" fill="var(--warn)" opacity="0.15" stroke="var(--warn)" strokeDasharray="2 2"/>
          )}
          {/* min-max span */}
          <line x1={4 + pct(stats.min)*1.72/100} x2={4 + pct(stats.max)*1.72/100}
            y1="9" y2="9" stroke={vColor} strokeWidth="3"/>
          {/* mean */}
          <circle cx={4 + pct(stats.mean)*1.72/100} cy="9" r="3.5" fill={vColor}/>
          {/* endpoints */}
          <line x1={4 + pct(stats.min)*1.72/100} x2={4 + pct(stats.min)*1.72/100}
            y1="5" y2="13" stroke={vColor}/>
          <line x1={4 + pct(stats.max)*1.72/100} x2={4 + pct(stats.max)*1.72/100}
            y1="5" y2="13" stroke={vColor}/>
        </svg>
      </td>
      <td className="mono" style={{ padding:'5px 8px', fontSize:9.5, color:'var(--fg-2)', whiteSpace:'nowrap' }}>
        {warnLimits.length === 2 ? `${warnLimits[0]}..${warnLimits[1]}` : '—'}
      </td>
      <td style={{ padding:'5px 8px', textAlign:'center' }}>
        <span style={{
          padding:'1px 8px', fontSize:9.5, fontWeight:600, letterSpacing:1, textTransform:'uppercase',
          color: vColor, border:`1px solid ${vColor}`,
          background: verdict==='PASS' ? 'rgba(122,168,116,0.1)' : verdict==='FAIL' ? 'rgba(216,99,74,0.1)' : 'rgba(229,162,74,0.1)',
        }}>{verdict}</span>
      </td>
    </tr>
  );
}

function TestReportModal({ open, onClose }) {
  const [seqId, setSeqId] = useState('seq-startup');
  const [includeSeq, setIncludeSeq] = useState(true);
  const [title, setTitle] = useState('T-247 Flight Acceptance · Sortie 2026-04-20-A');
  const [reviewer, setReviewer] = useState('K. Park · Test Director');

  if (!open) return null;

  const seq = SEQUENCES.find(s => s.id === seqId);
  const seqRun = seq ? mockRunResult(seq) : null;

  // report channel set — take a representative selection
  const reportChans = ALL_CHANNELS.slice(0, 14);
  const chStats = reportChans.map(c => ({ ch: c, stats: mockChannelStats(c) }));
  // overall verdict
  const chFails = chStats.filter(({ ch, stats }) =>
    (ch.alarm?.[1] != null && stats.max > ch.alarm[1]) ||
    (ch.alarm?.[0] != null && stats.min < ch.alarm[0])
  ).length;
  const chWarn = chStats.filter(({ ch, stats }) =>
    (ch.warn?.[1] != null && stats.max > ch.warn[1]) ||
    (ch.warn?.[0] != null && stats.min < ch.warn[0])
  ).length - chFails;
  const seqFail = includeSeq && seqRun?.verdict === 'fail';
  const overall = (chFails > 0 || seqFail) ? 'FAIL' : (chWarn > 0 ? 'MARGINAL' : 'PASS');
  const overallColor = overall === 'PASS' ? 'var(--ok)' : overall === 'FAIL' ? 'var(--alarm)' : 'var(--warn)';

  return (
    <div style={{ position:'fixed', inset:0, zIndex:200, background:'var(--bg-0)', display:'flex', flexDirection:'column' }}>
      {/* header */}
      <div style={{ height:40, borderBottom:'1px solid var(--line-2)', background:'var(--bg-2)',
        display:'flex', alignItems:'center', padding:'0 16px', gap:14 }}>
        <span style={{ fontSize:11, fontWeight:600, letterSpacing:1.2, textTransform:'uppercase', color:'var(--amber-0)' }}>
          Test Report · Acceptance Grading
        </span>
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1 }}>
          ready for print · A4 portrait
        </span>
        <button className="tb-btn">Download PDF</button>
        <button className="tb-btn">Email to approvers…</button>
        <button className="tb-btn primary">⎙ Print / save PDF</button>
        <button className="tb-btn" onClick={onClose}>Close</button>
      </div>

      {/* options bar */}
      <div style={{ height:40, borderBottom:'1px solid var(--line-1)', background:'var(--bg-1)',
        display:'flex', alignItems:'center', padding:'0 16px', gap:14, flexShrink:0 }}>
        <span style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1 }}>Title</span>
        <input value={title} onChange={e => setTitle(e.target.value)}
          style={{ flex:1, maxWidth:420, background:'var(--bg-0)', border:'1px solid var(--line-1)',
            color:'var(--fg-0)', padding:'4px 8px', fontSize:11, fontFamily:'inherit' }}/>
        <span style={{ fontSize:10, color:'var(--fg-3)', textTransform:'uppercase', letterSpacing:1 }}>Reviewer</span>
        <input value={reviewer} onChange={e => setReviewer(e.target.value)}
          style={{ width:200, background:'var(--bg-0)', border:'1px solid var(--line-1)',
            color:'var(--fg-0)', padding:'4px 8px', fontSize:11, fontFamily:'inherit' }}/>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--fg-1)' }}>
          <input type="checkbox" checked={includeSeq} onChange={e => setIncludeSeq(e.target.checked)}
            style={{ accentColor:'var(--amber-1)' }}/>
          include sequence
        </label>
        <select value={seqId} onChange={e => setSeqId(e.target.value)}
          style={{ background:'var(--bg-0)', border:'1px solid var(--line-1)', color:'var(--fg-0)',
            padding:'4px 8px', fontSize:11, fontFamily:'inherit' }}>
          {SEQUENCES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* report preview */}
      <div style={{ flex:1, overflow:'auto', padding:'24px 0', background:'#2b2d30' }}>
        <div style={{
          width: 820, minHeight: 1120,
          margin:'0 auto',
          background:'#ffffff',
          color:'#1a1b1e',
          fontFamily:'IBM Plex Sans, sans-serif',
          padding: 48,
          boxShadow:'0 8px 40px rgba(0,0,0,0.4)',
        }}>
          {/* report header */}
          <div style={{ borderBottom:'3px solid #1a1b1e', paddingBottom:14, marginBottom:16 }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:12 }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:'#c9862f' }}>REALTIMEINSIGHT</span>
              <span style={{ fontSize:10, color:'#555' }}>· Test Acceptance Record</span>
              <div style={{ flex:1 }}/>
              <span style={{ fontSize:9, color:'#888', fontFamily:'JetBrains Mono' }}>doc TAR-2026-04-20-0087</span>
            </div>
            <div style={{ fontSize:22, fontWeight:500, marginTop:6, color:'#1a1b1e' }}>{title}</div>
            <div style={{ display:'flex', gap:20, marginTop:10, fontSize:10.5, color:'#444' }}>
              <span><b>Platform</b> &nbsp;T-247 · s/n 00142</span>
              <span><b>Session</b> &nbsp;2026-04-20 14:02:11 — 14:18:37 UTC</span>
              <span><b>Duration</b> &nbsp;16m 26s</span>
              <span><b>Reviewer</b> &nbsp;{reviewer}</span>
            </div>
          </div>

          {/* overall verdict */}
          <div style={{ display:'flex', gap:14, marginBottom:20 }}>
            <div style={{
              flex:'0 0 200px',
              background:'#f6f5f2',
              border:`2px solid ${overallColor}`,
              padding:16, textAlign:'center',
            }}>
              <div style={{ fontSize:9, letterSpacing:2, color:'#888', textTransform:'uppercase' }}>Overall Verdict</div>
              <div style={{ fontSize:36, fontWeight:700, color: overallColor, marginTop:4, letterSpacing:4 }}>{overall}</div>
              <div style={{ fontSize:9, color:'#666', marginTop:4, fontFamily:'JetBrains Mono' }}>
                {chFails} chan · {chWarn} warn · seq {seqRun?.verdict || '—'}
              </div>
            </div>

            <div style={{ flex:1, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8 }}>
              {[
                ['Channels evaluated', chStats.length, '#1a1b1e'],
                ['Samples analyzed',  chStats.reduce((a,b)=>a+b.stats.samples,0).toLocaleString(), '#1a1b1e'],
                ['Alarm excursions',  chFails, chFails > 0 ? '#c4432a' : '#6a8464'],
                ['Warn excursions',   chWarn, chWarn > 0 ? '#b8822f' : '#6a8464'],
                ['Sequence template',  seq?.name || '—', '#1a1b1e'],
                ['Steps executed',     seqRun ? seqRun.steps.length : '—', '#1a1b1e'],
                ['Steps passed',       seqRun ? seqRun.steps.filter(s => s.status==='pass').length : '—', '#6a8464'],
                ['Steps failed/skipped', seqRun ? seqRun.steps.filter(s => s.status !== 'pass').length : '—',
                  (seqRun && seqRun.steps.some(s => s.status !== 'pass')) ? '#c4432a' : '#6a8464'],
              ].map(([l,v,c],i) => (
                <div key={i} style={{ background:'#f6f5f2', padding:10, border:'1px solid #d8d3c6' }}>
                  <div style={{ fontSize:8, letterSpacing:1.5, color:'#888', textTransform:'uppercase' }}>{l}</div>
                  <div style={{ fontSize:16, fontWeight:500, color: c, marginTop:2, fontFamily:'JetBrains Mono' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* section 1: channel summary */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, letterSpacing:2, color:'#888', textTransform:'uppercase', marginBottom:6 }}>
              § 1 — Channel statistical summary
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
              <thead>
                <tr style={{ borderBottom:'2px solid #1a1b1e', background:'#f6f5f2' }}>
                  <th style={{ textAlign:'left', padding:'5px 8px', fontSize:9, letterSpacing:1, color:'#666' }}>ID</th>
                  <th style={{ textAlign:'left', padding:'5px 8px', fontSize:9, letterSpacing:1, color:'#666' }}>Signal</th>
                  <th style={{ textAlign:'right', padding:'5px 8px', fontSize:9, letterSpacing:1, color:'#666' }}>Min</th>
                  <th style={{ textAlign:'right', padding:'5px 8px', fontSize:9, letterSpacing:1, color:'#666' }}>Avg</th>
                  <th style={{ textAlign:'right', padding:'5px 8px', fontSize:9, letterSpacing:1, color:'#666' }}>Max</th>
                  <th style={{ textAlign:'right', padding:'5px 8px', fontSize:9, letterSpacing:1, color:'#666' }}>σ</th>
                  <th style={{ textAlign:'right', padding:'5px 8px', fontSize:9, letterSpacing:1, color:'#666' }}>N</th>
                  <th style={{ textAlign:'left', padding:'5px 8px', fontSize:9, letterSpacing:1, color:'#666' }}>Range · observed vs warn band</th>
                  <th style={{ textAlign:'left', padding:'5px 8px', fontSize:9, letterSpacing:1, color:'#666' }}>Warn limits</th>
                  <th style={{ textAlign:'center', padding:'5px 8px', fontSize:9, letterSpacing:1, color:'#666' }}>Result</th>
                </tr>
              </thead>
              <tbody style={{ color:'#1a1b1e' }}>
                {chStats.map(({ ch, stats }) => {
                  // light-theme override: re-render row with print-safe colors
                  const range = (ch.max ?? 1) - (ch.min ?? 0);
                  const pct = (v) => range ? ((v - (ch.min ?? 0)) / range) * 100 : 50;
                  const warnLimits  = ch.warn  || [];
                  const alarmLimits = ch.alarm || [];
                  const overWarn  = stats.max > (warnLimits[1]  ?? Infinity) || stats.min < (warnLimits[0]  ?? -Infinity);
                  const overAlarm = stats.max > (alarmLimits[1] ?? Infinity) || stats.min < (alarmLimits[0] ?? -Infinity);
                  const verdict = overAlarm ? 'FAIL' : overWarn ? 'MARGINAL' : 'PASS';
                  const vColor  = verdict === 'PASS' ? '#6a8464' : verdict === 'FAIL' ? '#c4432a' : '#b8822f';
                  return (
                    <tr key={ch.id} style={{ borderBottom:'1px solid #e5e2d8' }}>
                      <td style={{ padding:'5px 8px', fontFamily:'JetBrains Mono', color:'#c9862f' }}>{ch.id}</td>
                      <td style={{ padding:'5px 8px' }}>
                        <div style={{ fontWeight:500 }}>{ch.name}</div>
                        <div style={{ fontSize:9, color:'#888' }}>{ch.display}</div>
                      </td>
                      <td style={{ padding:'5px 8px', textAlign:'right', fontFamily:'JetBrains Mono' }}>{stats.min.toFixed(2)}</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', fontFamily:'JetBrains Mono', fontWeight:600 }}>{stats.mean.toFixed(2)}</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', fontFamily:'JetBrains Mono' }}>{stats.max.toFixed(2)}</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', fontFamily:'JetBrains Mono', color:'#888' }}>{stats.stdev.toFixed(3)}</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', fontFamily:'JetBrains Mono', fontSize:9, color:'#888' }}>{stats.samples.toLocaleString()}</td>
                      <td style={{ padding:'5px 8px', width:200 }}>
                        <svg viewBox="0 0 200 18" style={{ width:200, height:18 }}>
                          <line x1="4" x2="196" y1="9" y2="9" stroke="#d8d3c6" strokeWidth="1"/>
                          {warnLimits.length === 2 && (
                            <rect x={4 + pct(warnLimits[0])*1.92/100} y="4"
                              width={Math.max(1, pct(warnLimits[1])*1.92/100 - pct(warnLimits[0])*1.92/100)}
                              height="10" fill="#b8822f" opacity="0.18" stroke="#b8822f" strokeDasharray="2 2"/>
                          )}
                          <line x1={4 + pct(stats.min)*1.92/100} x2={4 + pct(stats.max)*1.92/100}
                            y1="9" y2="9" stroke={vColor} strokeWidth="3"/>
                          <circle cx={4 + pct(stats.mean)*1.92/100} cy="9" r="3.5" fill={vColor}/>
                          <line x1={4 + pct(stats.min)*1.92/100} x2={4 + pct(stats.min)*1.92/100}
                            y1="5" y2="13" stroke={vColor}/>
                          <line x1={4 + pct(stats.max)*1.92/100} x2={4 + pct(stats.max)*1.92/100}
                            y1="5" y2="13" stroke={vColor}/>
                        </svg>
                      </td>
                      <td style={{ padding:'5px 8px', fontSize:9.5, color:'#666', fontFamily:'JetBrains Mono', whiteSpace:'nowrap' }}>
                        {warnLimits.length === 2 ? `${warnLimits[0]}..${warnLimits[1]}` : '—'}
                      </td>
                      <td style={{ padding:'5px 8px', textAlign:'center' }}>
                        <span style={{
                          padding:'1px 8px', fontSize:9, fontWeight:700, letterSpacing:1.2,
                          color: vColor, border:`1px solid ${vColor}`,
                          background: verdict==='PASS' ? '#eaf0e6' : verdict==='FAIL' ? '#f7e2db' : '#f7ecd8',
                        }}>{verdict}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* section 2: sequence */}
          {includeSeq && seqRun && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, letterSpacing:2, color:'#888', textTransform:'uppercase', marginBottom:6 }}>
                § 2 — Sequence conformance · <span style={{ color:'#1a1b1e' }}>{seq.name}</span>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:10 }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid #1a1b1e', background:'#f6f5f2' }}>
                    <th style={{ textAlign:'left',  padding:'5px 8px', fontSize:9, letterSpacing:1, color:'#666' }}>#</th>
                    <th style={{ textAlign:'left',  padding:'5px 8px', fontSize:9, letterSpacing:1, color:'#666' }}>Expected signal</th>
                    <th style={{ textAlign:'right', padding:'5px 8px', fontSize:9, letterSpacing:1, color:'#666' }}>Target T+ms</th>
                    <th style={{ textAlign:'right', padding:'5px 8px', fontSize:9, letterSpacing:1, color:'#666' }}>Observed T+ms</th>
                    <th style={{ textAlign:'right', padding:'5px 8px', fontSize:9, letterSpacing:1, color:'#666' }}>Δ ms</th>
                    <th style={{ textAlign:'left',  padding:'5px 8px', fontSize:9, letterSpacing:1, color:'#666' }}>Observed</th>
                    <th style={{ textAlign:'center',padding:'5px 8px', fontSize:9, letterSpacing:1, color:'#666' }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {seqRun.steps.map((rs, i) => {
                    const st = seq.steps[i];
                    const ch = ALL_CHANNELS.find(c => c.id === st.channelId);
                    const col = rs.status === 'pass' ? '#6a8464' : rs.status === 'fail' ? '#c4432a' : '#888';
                    return (
                      <tr key={rs.stepId} style={{ borderBottom:'1px solid #e5e2d8' }}>
                        <td style={{ padding:'5px 8px', fontFamily:'JetBrains Mono', color:'#c9862f' }}>{rs.idx}</td>
                        <td style={{ padding:'5px 8px' }}>
                          <div style={{ fontWeight:500 }}>{st.name}</div>
                          <div style={{ fontSize:9, color:'#888' }}>
                            {ch?.name} · {OP_LABEL[st.op]} {String(st.value)}{st.tol ? ` ±${st.tol}` : ''}
                            {st.dwellMs ? ` · dwell ${st.dwellMs}ms` : ''}
                          </div>
                        </td>
                        <td style={{ padding:'5px 8px', textAlign:'right', fontFamily:'JetBrains Mono', color:'#888' }}>{rs.targetMs}</td>
                        <td style={{ padding:'5px 8px', textAlign:'right', fontFamily:'JetBrains Mono' }}>
                          {rs.actualMs == null ? '—' : rs.actualMs}
                        </td>
                        <td style={{ padding:'5px 8px', textAlign:'right', fontFamily:'JetBrains Mono', color: col }}>
                          {rs.deltaMs == null ? '—' : (rs.deltaMs >= 0 ? '+' : '') + rs.deltaMs}
                        </td>
                        <td style={{ padding:'5px 8px', fontSize:9.5, color:'#444' }}>{rs.observed}</td>
                        <td style={{ padding:'5px 8px', textAlign:'center' }}>
                          <span style={{
                            padding:'1px 8px', fontSize:9, fontWeight:700, letterSpacing:1.2,
                            color: col, border:`1px solid ${col}`,
                            background: rs.status==='pass' ? '#eaf0e6' : rs.status==='fail' ? '#f7e2db' : '#f0ede5',
                          }}>{rs.status.toUpperCase()}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {seq.lastRun?.failReason && (
                <div style={{ marginTop:8, padding:'8px 12px', background:'#f7e2db', border:'1px solid #c4432a', fontSize:10.5, color:'#1a1b1e' }}>
                  <b style={{ color:'#c4432a' }}>FAILURE ROOT CAUSE — step {seq.lastRun.failedAt}:</b> {seq.lastRun.failReason}
                </div>
              )}
            </div>
          )}

          {/* section 3: methodology */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, letterSpacing:2, color:'#888', textTransform:'uppercase', marginBottom:6 }}>
              § 3 — Methodology & references
            </div>
            <div style={{ fontSize:10, color:'#444', lineHeight:1.6 }}>
              Alarm and warn bands are read from the Channel Mapping Editor rule base in force at
              session start (TMATS hash <span style={{ fontFamily:'JetBrains Mono' }}>a3f8…e21c</span>).
              Channel samples are evaluated end-to-end — not windowed — against per-channel warn/alarm
              thresholds including hysteresis and dwell. A channel grades PASS if no enabled rule
              latched during the session; MARGINAL if only WARN-class rules latched; FAIL on any
              ALARM-class rule. Sequence conformance uses the template’s strict-order policy with each
              step’s dwell and timeout windows. Overall verdict is the worst of channel and sequence.
            </div>
          </div>

          {/* signature block */}
          <div style={{ marginTop:40, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:24 }}>
            {['Test Director', 'Quality Reviewer', 'Program Manager'].map(role => (
              <div key={role}>
                <div style={{ borderBottom:'1px solid #1a1b1e', height:40 }}/>
                <div style={{ fontSize:9, letterSpacing:1.5, color:'#888', textTransform:'uppercase', marginTop:4 }}>{role}</div>
                <div style={{ fontSize:9, color:'#888', marginTop:2 }}>name · signature · date</div>
              </div>
            ))}
          </div>

          {/* footer */}
          <div style={{ marginTop:30, borderTop:'1px solid #d8d3c6', paddingTop:8,
            display:'flex', fontSize:8.5, color:'#888', letterSpacing:0.8 }}>
            <span>RTI-TAR · confidential · do not distribute externally</span>
            <div style={{ flex:1 }}/>
            <span className="mono">page 1 / 1 · generated 2026-04-20 14:22:08</span>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SequenceValidator, TestReportModal });

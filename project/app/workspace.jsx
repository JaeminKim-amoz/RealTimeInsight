// Workspace Save/Load + Layout Preset modal + LLM chat full-screen view

// =========== Layout Preset Modal ===========
const LAYOUT_PRESETS = [
  {
    id: 'flight-analysis',
    name: 'Flight Analysis',
    desc: 'Power, hydraulics, attitude, trajectory, event log',
    author: 'factory',
    panels: 14,
    tags: ['flight-test', 'default'],
    thumb: 'flight',
  },
  {
    id: 'rf-spectrum',
    name: 'RF / Spectrum',
    desc: 'Wide waterfall, RSSI/SNR, link budget, CRC events',
    author: 'factory',
    panels: 8,
    tags: ['rf', 'link-analysis'],
    thumb: 'spectrum',
  },
  {
    id: 'map-video',
    name: 'Integrated Map + Video',
    desc: 'Full-width map, EO video, SimDIS bridge, tactical tracks',
    author: 'factory',
    panels: 6,
    tags: ['tactical', 'c2'],
    thumb: 'map',
  },
  {
    id: 'anomaly-triage',
    name: 'Anomaly Triage',
    desc: 'Compact chart stack + large insight pane + evidence graph',
    author: 'factory',
    panels: 10,
    tags: ['post-flight', 'analysis'],
    thumb: 'triage',
  },
  {
    id: 'mission-rehearsal',
    name: 'Mission Rehearsal',
    desc: 'Replay-focused: timeline front and center, scrubbable everything',
    author: 'factory',
    panels: 9,
    tags: ['replay', 'training'],
    thumb: 'rehearsal',
  },
  {
    id: 'eng-check',
    name: 'Engineering Check',
    desc: 'All numeric tiles, discrete states, CRC/decode health',
    author: 'factory',
    panels: 12,
    tags: ['preflight'],
    thumb: 'check',
  },
];

const SAVED_WORKSPACES = [
  { id: 'ws-0412', name: 'sortie-0420 post-debrief',     saved: '2026-04-20 16:32', pinned: true,  panels: 14, sharedWith: 'team-flight-test' },
  { id: 'ws-0411', name: 'HYD spike follow-up (v3)',     saved: '2026-04-20 15:10', pinned: true,  panels: 12, sharedWith: null },
  { id: 'ws-0410', name: 'RF link budget · run 0918',    saved: '2026-04-19 11:04', pinned: false, panels: 8,  sharedWith: 'eng-rf' },
  { id: 'ws-0409', name: 'Cockpit review for JW',        saved: '2026-04-18 09:22', pinned: false, panels: 10, sharedWith: 'jw-park' },
  { id: 'ws-0408', name: 'Preflight checklist view',     saved: '2026-04-17 07:48', pinned: false, panels: 16, sharedWith: null },
  { id: 'ws-0407', name: 'Temp · scratch',               saved: '2026-04-16 19:11', pinned: false, panels: 6,  sharedWith: null },
];

function LayoutPresetModal({ open, onClose }) {
  const [tab, setTab] = useState('presets'); // presets | saved | share
  const [sel, setSel] = useState('flight-analysis');
  if (!open) return null;

  const renderThumb = (kind) => {
    const bg = 'var(--bg-0)';
    const line = 'var(--amber-1)';
    const dim = 'var(--line-2)';
    const common = { background: bg, border: '1px solid var(--line-1)', height: 88 };
    switch (kind) {
      case 'flight': return (
        <svg viewBox="0 0 140 88" style={common}>
          <rect x="4" y="4" width="60" height="18" fill="none" stroke={dim}/>
          <polyline points="4,18 15,12 30,14 45,8 60,10" stroke={line} fill="none" strokeWidth="0.8"/>
          <rect x="68" y="4" width="68" height="18" fill="none" stroke={dim}/>
          <polyline points="68,16 85,9 100,13 120,6 136,8" stroke={line} fill="none" strokeWidth="0.8"/>
          <rect x="4" y="26" width="42" height="26" fill="none" stroke={dim}/>
          <circle cx="25" cy="39" r="8" fill="none" stroke={line}/>
          <rect x="50" y="26" width="42" height="26" fill="none" stroke={dim}/>
          <rect x="96" y="26" width="40" height="26" fill="none" stroke={dim}/>
          <path d="M 100 48 Q 110 40 118 44 T 132 36" fill="none" stroke={line} strokeWidth="0.8"/>
          <rect x="4" y="56" width="80" height="28" fill="none" stroke={dim}/>
          <line x1="4" y1="70" x2="84" y2="70" stroke={dim} strokeDasharray="2,1"/>
          <rect x="88" y="56" width="48" height="28" fill="none" stroke={dim}/>
        </svg>
      );
      case 'spectrum': return (
        <svg viewBox="0 0 140 88" style={common}>
          <rect x="4" y="4" width="132" height="54" fill="none" stroke={dim}/>
          {Array.from({length: 18}).map((_, i) => (
            <rect key={i} x={6 + i*7.2} y={10 + (i%4)*10} width="6" height="44" fill={`rgba(229,162,74,${0.3 + (i%5)*0.12})`}/>
          ))}
          <rect x="4" y="62" width="64" height="22" fill="none" stroke={dim}/>
          <polyline points="4,75 20,72 38,76 55,70 68,74" stroke={line} fill="none" strokeWidth="0.8"/>
          <rect x="72" y="62" width="64" height="22" fill="none" stroke={dim}/>
        </svg>
      );
      case 'map': return (
        <svg viewBox="0 0 140 88" style={common}>
          <rect x="4" y="4" width="86" height="58" fill="#1a1812" stroke={dim}/>
          <path d="M 10 50 Q 30 30 50 40 T 85 25" stroke={line} fill="none" strokeWidth="1"/>
          <circle cx="50" cy="40" r="2" fill={line}/>
          <rect x="94" y="4" width="42" height="38" fill="none" stroke={dim}/>
          <line x1="98" y1="20" x2="132" y2="20" stroke={dim}/>
          <line x1="115" y1="8" x2="115" y2="38" stroke={dim}/>
          <rect x="94" y="46" width="42" height="16" fill="none" stroke={dim}/>
          <rect x="4" y="66" width="132" height="18" fill="none" stroke={dim}/>
        </svg>
      );
      case 'triage': return (
        <svg viewBox="0 0 140 88" style={common}>
          <rect x="4" y="4" width="86" height="80" fill="none" stroke={dim}/>
          <rect x="94" y="4" width="42" height="80" fill="none" stroke={line} strokeWidth="1.2"/>
          {[0,1,2,3].map(i => (
            <g key={i}>
              <rect x="6" y={6 + i*20} width="82" height="18" fill="none" stroke={dim}/>
              <polyline points={`6,${18+i*20} 20,${12+i*20} 40,${16+i*20} 60,${10+i*20} 88,${14+i*20}`} stroke={line} fill="none" strokeWidth="0.6"/>
            </g>
          ))}
          <circle cx="110" cy="20" r="5" fill="none" stroke={line}/>
          <line x1="110" y1="20" x2="120" y2="34" stroke={dim}/>
          <circle cx="122" cy="40" r="3" fill={line}/>
          <line x1="110" y1="20" x2="100" y2="36" stroke={dim}/>
          <circle cx="98" cy="40" r="3" fill="var(--s2)"/>
        </svg>
      );
      case 'rehearsal': return (
        <svg viewBox="0 0 140 88" style={common}>
          <rect x="4" y="4" width="132" height="10" fill="none" stroke={dim}/>
          <rect x="4" y="4" width="86" height="10" fill={line} opacity="0.5"/>
          <line x1="88" y1="2" x2="88" y2="16" stroke={line} strokeWidth="1.5"/>
          {[0,1,2].map(i => (
            <rect key={i} x={4 + i*46} y="18" width="42" height="32" fill="none" stroke={dim}/>
          ))}
          <rect x="4" y="54" width="132" height="30" fill="none" stroke={dim}/>
          <polyline points="4,76 30,70 55,74 80,66 110,72 136,68" stroke={line} fill="none" strokeWidth="0.8"/>
        </svg>
      );
      case 'check': return (
        <svg viewBox="0 0 140 88" style={common}>
          {Array.from({length: 12}).map((_, i) => (
            <rect key={i} x={4 + (i%6)*22} y={4 + Math.floor(i/6)*28} width="20" height="24" fill="none" stroke={dim}/>
          ))}
          <rect x="4" y="60" width="132" height="24" fill="none" stroke={dim}/>
          <line x1="4" y1="72" x2="136" y2="72" stroke={dim} strokeDasharray="2,1"/>
        </svg>
      );
      default: return <div style={common}/>;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 860, height: 620 }} onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <span>Workspaces & Layouts</span>
          <button onClick={onClose} className="modal-close">×</button>
        </div>
        <div className="modal-tabs">
          <button className={tab==='presets'?'on':''} onClick={() => setTab('presets')}>Factory Presets</button>
          <button className={tab==='saved'?'on':''} onClick={() => setTab('saved')}>My Workspaces</button>
          <button className={tab==='share'?'on':''} onClick={() => setTab('share')}>Team · Shared</button>
          <div style={{ flex: 1 }}/>
          <div style={{ padding: '6px 14px', fontSize: 10, color: 'var(--fg-3)', alignSelf:'center' }}>
            current: <span style={{ color:'var(--amber-0)' }}>sortie-0420 post-debrief</span> · unsaved changes
          </div>
        </div>
        <div className="modal-body" style={{ gridTemplateColumns: '1fr', overflow: 'hidden', padding: 0 }}>
          {tab === 'presets' && (
            <div style={{ padding: 14, overflow: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {LAYOUT_PRESETS.map(p => (
                <div key={p.id}
                  onClick={() => setSel(p.id)}
                  style={{
                    background: sel===p.id ? 'var(--bg-3)' : 'var(--bg-0)',
                    border: `1px solid ${sel===p.id ? 'var(--amber-1)' : 'var(--line-1)'}`,
                    padding: 10, cursor: 'pointer',
                  }}>
                  {renderThumb(p.thumb)}
                  <div style={{ marginTop: 10, display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                    <span style={{ fontSize: 12, color:'var(--fg-0)', fontWeight: 500 }}>{p.name}</span>
                    <span className="mono" style={{ fontSize: 10, color:'var(--fg-3)' }}>{p.panels} panels</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-2)', marginTop: 4, lineHeight: 1.4 }}>{p.desc}</div>
                  <div style={{ marginTop: 6, display:'flex', gap: 4 }}>
                    {p.tags.map(t => (
                      <span key={t} style={{ fontSize: 9, color:'var(--fg-3)', border:'1px solid var(--line-1)', padding:'1px 5px', textTransform:'uppercase', letterSpacing: 0.6 }}>{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'saved' && (
            <div style={{ padding: 14, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ color:'var(--fg-3)', fontSize: 10, textTransform:'uppercase', letterSpacing: 1, textAlign:'left' }}>
                    <th style={{ padding: '6px 8px', width: 24 }}></th>
                    <th style={{ padding: '6px 8px' }}>Name</th>
                    <th style={{ padding: '6px 8px', width: 90 }}>Panels</th>
                    <th style={{ padding: '6px 8px', width: 140 }}>Shared</th>
                    <th style={{ padding: '6px 8px', width: 140 }}>Saved</th>
                    <th style={{ padding: '6px 8px', width: 120 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {SAVED_WORKSPACES.map(w => (
                    <tr key={w.id} style={{ borderTop: '1px solid var(--line-1)' }}>
                      <td style={{ padding: '8px', color: w.pinned ? 'var(--amber-0)' : 'var(--fg-3)' }}>★</td>
                      <td style={{ padding: '8px 8px', color: 'var(--fg-0)' }}>{w.name}</td>
                      <td style={{ padding: '8px 8px', color: 'var(--fg-2)' }} className="mono">{w.panels}</td>
                      <td style={{ padding: '8px 8px', color: w.sharedWith ? 'var(--s2)' : 'var(--fg-3)' }}>
                        {w.sharedWith || '—'}
                      </td>
                      <td style={{ padding: '8px 8px', color: 'var(--fg-2)' }} className="mono">{w.saved}</td>
                      <td style={{ padding: '8px 8px', textAlign:'right' }}>
                        <button className="tb-btn" style={{ marginRight: 4 }}>Load</button>
                        <button className="tb-btn">⋯</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'share' && (
            <div style={{ padding: 20, color: 'var(--fg-2)' }}>
              <div style={{ fontSize: 11, textTransform:'uppercase', letterSpacing: 1, color:'var(--fg-3)', marginBottom: 10 }}>Shared in your teams</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {[
                  ['team-flight-test', 'sortie-0420 post-debrief', 'jw-park',    '2h ago'],
                  ['team-flight-test', 'anomaly-triage v2',        'sh-kim',     '1d ago'],
                  ['eng-rf',           'link-budget-0918',         'mj-choi',    '3d ago'],
                  ['eng-rf',           'CRC cluster analysis',     'dh-lee',     '1w ago'],
                ].map(([team, name, by, when], i) => (
                  <div key={i} style={{ padding: 10, border: '1px solid var(--line-1)', background: 'var(--bg-0)', display:'flex', alignItems:'center', gap: 12 }}>
                    <span style={{ fontSize: 9, background: 'var(--bg-3)', padding: '2px 6px', textTransform:'uppercase', letterSpacing: 0.8, color:'var(--s2)' }}>{team}</span>
                    <span style={{ color: 'var(--fg-0)', fontSize: 12 }}>{name}</span>
                    <span style={{ color: 'var(--fg-3)', fontSize: 10 }}>by {by}</span>
                    <div style={{ flex: 1 }}/>
                    <span style={{ color: 'var(--fg-3)', fontSize: 10 }}>{when}</span>
                    <button className="tb-btn">Load</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="tb-btn">+ New empty workspace</button>
          <button className="tb-btn">Save current as…</button>
          <div className="spacer"/>
          <button className="tb-btn" onClick={onClose}>Cancel</button>
          <button className="tb-btn primary">Load selected</button>
        </div>
      </div>
    </div>
  );
}

// =========== LLM Chat Panel (slide-out drawer) ===========
const LLM_PRESEEDED = [
  {
    role: 'user',
    text: 'Why did hydraulic pressure A spike at T+182.340?',
    t: '16:32:12',
  },
  {
    role: 'assistant',
    text: 'Running a root-cause trace on CH 1205 in the window [182.28, 182.44]s. Three candidates above 0.5 confidence — summary below.',
    t: '16:32:13',
    tools: [
      { name: 'find_anomalies', args: { channel: 1205, window: '±0.2s' }, ms: 42,  result: '1 anomaly · score 0.93' },
      { name: 'correlate',      args: { targets: 'nearby subsystems', lag: '±500ms' }, ms: 118, result: '11 channels, top 3 shown' },
      { name: 'read_formulas',  args: { subsystem: 'hydraulic' }, ms: 22, result: 'P = f(V,I,valve) bridge formula found' },
    ],
    summary: [
      { rank: 1, label: 'Bus current transient on CH 1002 — leads by 120ms',  score: 0.86, reason: 'temporal-lead + formula-dep on Power→Hyd bridge' },
      { rank: 2, label: 'PDU BIT fault bit on CH 1007 within 80ms',           score: 0.72, reason: 'alarm co-occurrence, same frame 0x2A' },
      { rank: 3, label: 'Hyd bypass valve state change on CH 1210',           score: 0.58, reason: 'state transition just before spike' },
    ],
  },
  {
    role: 'user',
    text: 'Has #1 happened in previous runs on this platform?',
    t: '16:33:04',
  },
  {
    role: 'assistant',
    text: 'Searched 18 prior runs on tail T-247. Same power→hyd coupling appeared in 3 runs. Run 0918 had a near-identical signature — bookmarked by JW Park.',
    t: '16:33:07',
    tools: [
      { name: 'search_recordings', args: { tail: 'T-247', signature: 'hyd-spike-with-i-lead' }, ms: 3200, result: '3 matches across 18 runs' },
      { name: 'open_bookmark',     args: { run: '0918', mark: 'hyd-i-coupling' }, ms: 14, result: 'loaded' },
    ],
    summary: [
      { rank: 1, label: 'run 0918 · same coupling · resolved by replacing PDU-4 fuse',   score: 0.91, reason: 'identical spectral signature, 2.1σ match' },
      { rank: 2, label: 'run 0722 · similar but on Hyd B side, different cause',         score: 0.64, reason: 'subsystem swap, weaker' },
      { rank: 3, label: 'run 0410 · candidate — needs human review',                     score: 0.52, reason: 'partial overlap, not confirmed' },
    ],
  },
];

const LLM_QUICK_ACTIONS = [
  'Summarize last 30s of alarms',
  'Explain this anomaly',
  'Compare to run 0918',
  'What channels correlate with hyd pressure A?',
  'Is this within expected flight envelope?',
  'Generate flight-test report for this sortie',
];

function LLMDrawer({ open, onClose }) {
  const [msgs, setMsgs] = useState(LLM_PRESEEDED);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, open]);

  const send = (text) => {
    if (!text || thinking) return;
    setMsgs(m => [...m, { role: 'user', text, t: new Date().toTimeString().slice(0,8) }]);
    setInput('');
    setThinking(true);
    setTimeout(() => {
      setMsgs(m => [...m, {
        role: 'assistant',
        text: "I'd reach for the evidence graph and run correlate + find_anomalies on the named channels. Do you want me to build a focused workspace or push the findings to a shared note?",
        t: new Date().toTimeString().slice(0,8),
        tools: [
          { name: 'plan', args: { goal: text.slice(0, 50) }, ms: 80, result: 'drafted' },
        ],
      }]);
      setThinking(false);
    }, 1400);
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', top: 40, right: 0, bottom: 28, width: 480,
      background: 'var(--bg-1)', borderLeft: '1px solid var(--line-2)',
      zIndex: 150, display: 'flex', flexDirection: 'column',
      boxShadow: '-12px 0 28px rgba(0,0,0,0.5)',
    }}>
      <div style={{
        padding: '10px 14px', background: 'var(--bg-2)',
        borderBottom: '1px solid var(--line-1)', display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ color: 'var(--amber-0)', fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>
          Mission Assistant
        </span>
        <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>· rti-llm-3.2 · airgap-ok</span>
        <div style={{ flex: 1 }}/>
        <button className="tb-btn">Clear</button>
        <button className="tb-btn" onClick={onClose}>×</button>
      </div>

      <div ref={bodyRef} style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{
              width: 22, height: 22, flexShrink: 0,
              background: m.role === 'user' ? 'var(--bg-3)' : 'var(--amber-2)',
              color: m.role === 'user' ? 'var(--fg-0)' : '#1a1614',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 600, letterSpacing: 0.5,
            }}>{m.role === 'user' ? 'JW' : 'AI'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color:'var(--fg-2)', textTransform:'uppercase', letterSpacing: 0.8 }}>
                  {m.role === 'user' ? 'JW Park' : 'Assistant'}
                </span>
                <span className="mono" style={{ fontSize: 9, color:'var(--fg-3)' }}>{m.t}</span>
              </div>
              <div style={{ color: 'var(--fg-0)', fontSize: 12, lineHeight: 1.55 }}>{m.text}</div>

              {m.tools && (
                <details open style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 10, color: 'var(--fg-3)', cursor: 'pointer', textTransform:'uppercase', letterSpacing: 1, padding: '2px 0' }}>
                    ▸ tool trace · {m.tools.length} calls
                  </summary>
                  <div style={{ marginTop: 6, background: 'var(--bg-0)', border: '1px solid var(--line-1)', padding: 8 }}>
                    {m.tools.map((tc, k) => (
                      <div key={k} style={{ display:'flex', gap: 8, padding: '3px 0', fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace', borderTop: k ? '1px solid var(--line-1)' : 'none' }}>
                        <span style={{ color: 'var(--s2)', minWidth: 110 }}>{tc.name}</span>
                        <span style={{ color: 'var(--fg-3)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          ({Object.entries(tc.args).map(([k,v]) => `${k}=${JSON.stringify(v)}`).join(', ')})
                        </span>
                        <span style={{ color: 'var(--fg-2)' }}>{tc.ms}ms</span>
                        <span style={{ color: 'var(--ok)', minWidth: 140, textAlign: 'right' }}>→ {tc.result}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {m.summary && (
                <div style={{ marginTop: 8, border: '1px solid var(--line-1)', background: 'var(--bg-0)' }}>
                  {m.summary.map((s, k) => (
                    <div key={k} style={{ padding: 8, display:'flex', gap: 10, alignItems: 'center', borderTop: k ? '1px solid var(--line-1)' : 'none' }}>
                      <span style={{ fontSize: 10, color: 'var(--amber-0)', fontFamily: 'JetBrains Mono', minWidth: 16 }}>#{s.rank}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, color: 'var(--fg-0)' }}>{s.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--fg-2)', marginTop: 2 }}>{s.reason}</div>
                      </div>
                      <div style={{
                        fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--amber-0)',
                        padding: '1px 6px', background: 'var(--bg-3)', border: '1px solid var(--line-1)',
                      }}>{(s.score * 100).toFixed(0)}%</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {thinking && (
          <div style={{ display:'flex', gap: 10, alignItems: 'center', color: 'var(--fg-3)', fontSize: 10, textTransform:'uppercase', letterSpacing: 1 }}>
            <div style={{ width: 22, height: 22, background: 'var(--amber-2)', color:'#1a1614', display:'flex', alignItems:'center', justifyContent:'center', fontSize: 10, fontWeight: 600 }}>AI</div>
            <div>running tools<span className="blink">▮</span></div>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--line-1)', padding: 10, background: 'var(--bg-2)' }}>
        <div style={{ display:'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
          {LLM_QUICK_ACTIONS.map((q, i) => (
            <button key={i}
              onClick={() => send(q)}
              style={{
                fontSize: 10, padding: '3px 8px',
                background: 'var(--bg-0)', color: 'var(--fg-1)',
                border: '1px solid var(--line-1)', cursor: 'pointer',
                fontFamily: 'inherit',
              }}>{q}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap: 6 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(input); }}
            placeholder="Ask about a channel, anomaly, or run…"
            style={{
              flex: 1, height: 28, padding: '0 10px',
              background: 'var(--bg-0)', border: '1px solid var(--line-1)',
              color: 'var(--fg-0)', fontFamily: 'inherit', fontSize: 11.5,
            }}/>
          <button className="tb-btn primary" onClick={() => send(input)}>Send</button>
        </div>
        <div style={{ fontSize: 9, color: 'var(--fg-3)', marginTop: 6, display: 'flex', gap: 10 }}>
          <span>tools: find_anomalies · correlate · read_formulas · search_recordings · plot_matlab · open_bookmark</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { LayoutPresetModal, LLMDrawer });

// App shell: TopBar, ChannelExplorer, InsightPane, BottomConsole

// =========== Top command bar ===========
function TopBar({ mode, onModeChange, playing, onPlayToggle, cursorTime, rate, onRate, tweaksOn, onTweaksToggle, onExport, onMatlab, onPalette, onLayout, onLLM, onMapping, onLibrary, onStreams, onSequence, onReport }) {
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark"/>
        <span>REALTIMEINSIGHT</span>
        <span className="brand-dot"/>
      </div>

      <div className="tb-group">
        <span className="tb-label">Project</span>
        <button className="tb-btn">RTI Flight Test Demo ▾</button>
      </div>

      <div className="tb-group">
        <span className="tb-label">Mode</span>
        <div className="mode-switch">
          <button className={`live ${mode==='live'?'on':''}`} onClick={() => onModeChange('live')}>
            <span className="led"/> LIVE
          </button>
          <button className={mode==='replay'?'on':''} onClick={() => onModeChange('replay')}>
            <span className="led"/> REPLAY
          </button>
        </div>
      </div>

      <div className="tb-group">
        <span className="tb-label">RX</span>
        <button className="status-chip" onClick={onStreams}
          title="Click to open UDP Stream Configuration"
          style={{ cursor:'pointer', gap:4, display:'inline-flex', alignItems:'center' }}>
          <span style={{ display:'inline-flex', gap:3, alignItems:'center', marginRight:4 }}>
            <span title="Link · carrier detected"
              style={{ display:'inline-block', width:7, height:7, borderRadius:'50%',
                background:'var(--ok)', boxShadow:'0 0 6px rgba(122,168,116,0.6)' }}/>
            <span title="Sync · frame lock"
              style={{ display:'inline-block', width:7, height:7, borderRadius:'50%',
                background:'var(--ok)', boxShadow:'0 0 6px rgba(122,168,116,0.6)' }}/>
            <span title="CRC · 1 stream showing errors"
              style={{ display:'inline-block', width:7, height:7, borderRadius:'50%',
                background:'var(--warn)', boxShadow:'0 0 6px rgba(229,162,74,0.6)' }}/>
            <span title="AES · decryption active"
              style={{ display:'inline-block', width:7, height:7, borderRadius:'50%',
                background:'var(--pinned)', boxShadow:'0 0 6px rgba(79,179,182,0.55)' }}/>
            <span title="Drop · 1 stream unsynced"
              style={{ display:'inline-block', width:7, height:7, borderRadius:'50%',
                background:'var(--alarm)', boxShadow:'0 0 6px rgba(216,99,74,0.65)',
                animation:'led-blink 0.9s infinite' }}/>
          </span>
          <span className="mono" style={{ fontSize:10 }}>3 / 4 streams · 61.2 Mbps</span>
        </button>
      </div>

      <div className="tb-group">
        <button className="tb-btn" onClick={onPlayToggle}>{playing ? '▐▐' : '▶'}</button>
        <button className="tb-btn">◀</button>
        <button className="tb-btn">▶</button>
        <select className="tb-btn" value={rate} onChange={e => onRate(parseFloat(e.target.value))}
                style={{ padding: '0 6px' }}>
          <option value="0.25">×0.25</option>
          <option value="0.5">×0.5</option>
          <option value="1">×1</option>
          <option value="2">×2</option>
          <option value="4">×4</option>
        </select>
        <span className="status-chip" style={{ fontFamily:'JetBrains Mono' }}>
          T+<span style={{ color:'var(--amber-0)' }}>{cursorTime.toFixed(3)}</span>s
        </span>
      </div>

      <div className="tb-group">
        <button className="tb-btn" title="Record" style={{ color: mode==='live' ? 'var(--alarm)' : 'var(--fg-2)' }}>
          <span className="led alarm" style={{ display:'inline-block', width:6, height:6, borderRadius:'50%' }}/> REC
        </button>
        <button className="tb-btn" onClick={onPalette}>⌘K Search</button>
        <button className="tb-btn" onClick={onLayout}>Layout ▾</button>
        <button className="tb-btn" onClick={onLibrary}>Library</button>
        <button className="tb-btn" onClick={onMapping}>Channels</button>
        <button className="tb-btn" onClick={onStreams}>Streams</button>
        <button className="tb-btn" onClick={onSequence}>Sequence</button>
        <button className="tb-btn" onClick={onReport}>Report</button>
        <button className="tb-btn" onClick={onExport}>Export</button>
        <button className="tb-btn" onClick={onMatlab}>MATLAB</button>
        <button className="tb-btn">Integrations ▾</button>
        <button className="tb-btn" onClick={onLLM}>LLM</button>
        <button className={`tb-btn ${tweaksOn?'active':''}`} onClick={onTweaksToggle}>Tweaks</button>
      </div>
    </div>
  );
}

// =========== Channel Explorer ===========
const FILTER_CHIPS = ['Analog', 'Discrete', 'Spectrum', 'Alarmed', 'Favorite', 'Good only', 'Map-capable', 'Video-linked'];

function ChannelExplorer({ selectedIds, onSelect, onFavToggle, favorites }) {
  const [search, setSearch] = useState('');
  const [chips, setChips] = useState(new Set());
  const [open, setOpen] = useState({ power: true, hydraulic: true, pose: true, rf: true, nav: false, video: false });

  const toggle = (id) => setOpen(o => ({ ...o, [id]: !o[id] }));
  const toggleChip = (c) => setChips(s => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });

  const matches = (c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.includes(q) || c.display.toLowerCase().includes(q)
      || c.group.toLowerCase().includes(q) || (c.unit||'').toLowerCase().includes(q)
      || String(c.id).includes(q);
  };

  const totalMatched = ALL_CHANNELS.filter(matches).length;

  return (
    <div className="pane">
      <div className="pane-header">
        <span>Channel Explorer</span>
        <span className="count">{totalMatched} / {ALL_CHANNELS.length}</span>
      </div>
      <div className="searchbox" style={{ position:'relative' }}>
        <input placeholder="search channels, group:, unit:, type:…" value={search}
               onChange={e => setSearch(e.target.value)}/>
        <span className="kbd-hint">⌘K</span>
      </div>
      <div className="filter-chips">
        {FILTER_CHIPS.map(c => (
          <span key={c} className={`chip ${chips.has(c)?'on':''}`} onClick={() => toggleChip(c)}>
            {c.toLowerCase()}
          </span>
        ))}
      </div>
      <div className="tree">
        <div className="tree-section">Favorites</div>
        {ALL_CHANNELS.filter(c => favorites.has(c.id)).map(ch => (
          <ChannelRow key={`fav-${ch.id}`} ch={ch} selected={selectedIds.has(ch.id)}
                      onSelect={onSelect} onFav={onFavToggle} isFav={true}/>
        ))}

        <div className="tree-section">All Channels</div>
        {CHANNEL_GROUPS.map(g => (
          <div key={g.id}>
            <div className={`tree-group ${open[g.id]?'open':''}`} onClick={() => toggle(g.id)}>
              <span className="caret">▶</span>
              <span>{g.name}</span>
              <span className="grp-count">{g.children.length}</span>
            </div>
            {open[g.id] && g.children.filter(matches).map(ch => (
              <ChannelRow key={ch.id} ch={ch} selected={selectedIds.has(ch.id)}
                          onSelect={onSelect} onFav={onFavToggle} isFav={favorites.has(ch.id)}/>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChannelRow({ ch, selected, onSelect, onFav, isFav }) {
  const [dragging, setDragging] = useState(false);
  const onDragStart = (e) => {
    const payload = { kind: 'channel-drag', channelId: ch.id, display: ch.display, type: ch.type };
    DragState.set(payload);
    e.dataTransfer.setData('text/plain', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copy';
    setDragging(true);
  };
  const onDragEnd = () => { setDragging(false); DragState.set(null); };

  return (
    <div className={`ch-row ${selected?'selected':''} ${dragging?'dragging':''}`}
         draggable
         onDragStart={onDragStart}
         onDragEnd={onDragEnd}
         onClick={(e) => onSelect(ch.id, e.ctrlKey || e.metaKey)}>
      <span className={`fav-star ${isFav?'on':''}`} onClick={(e) => { e.stopPropagation(); onFav(ch.id); }}>★</span>
      <span className={`ctype ${ch.type}`}>{ch.type}</span>
      <div className="ch-name-wrap">
        <span className="ch-name">{ch.display}</span>
        <span className="ch-sub">{ch.group} · {ch.rate}Hz {ch.alarm ? '· ALARM' : ''}</span>
      </div>
      <span className="ch-unit">{ch.unit}</span>
      <span className="ch-id">#{ch.id}</span>
      {ch.alarm && <span className="alarm-dot"/>}
    </div>
  );
}

// =========== Insight Pane ===========
function InsightPane({ anomaly, onJumpToCh, layoutMode, onLayoutChange, onClose }) {
  const [tab, setTab] = useState('rootcause');

  if (!anomaly) {
    return (
      <div className="pane insight">
        <div className="pane-header">
          <span>Insight · Evidence</span>
          <span className="count">idle</span>
        </div>
        <div className="empty-insight">
          <div className="icon">⌕</div>
          <div>Click a data point or event</div>
          <div style={{ color:'var(--fg-2)', marginTop:6, fontSize:10.5 }}>
            Insight opens with root-cause candidates, relation graph, and linked evidence.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pane insight">
      <div className="pane-header">
        <span>Insight · Evidence</span>
        <span className="count">anom-001</span>
      </div>
      <div className="insight-tabs">
        {[['rootcause','Root Cause'],['graph','Graph'],['evidence','Evidence'],['related','Related'],['llm','LLM']].map(([k, l]) => (
          <button key={k} className={tab===k?'on':''} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      <div className="insight-body">
        <div className="obs-card">
          <div className="obs-label">▲ Observation anchor</div>
          <h4>{anomaly.label}</h4>
          <div className="meta">
            <div><b>Channel</b> CH{anomaly.ch} · {anomaly.channelDisplay}</div>
            <div><b>Time</b>    T+{anomaly.t.toFixed(3)}s · window ±80ms</div>
            <div><b>Severity</b> {anomaly.severity} · score {anomaly.score.toFixed(2)}</div>
          </div>
        </div>

        {tab === 'rootcause' && (
          <>
            <div className="section-hd">Ranked candidates</div>
            {anomaly.candidates.map(c => (
              <div key={c.rank} className="candidate">
                <div className="rank">#{c.rank}</div>
                <div>
                  <div className="cand-title">{c.title}</div>
                  <div className="cand-why">
                    {c.evidence.map(e => <span key={e} className="ev">{e}</span>)}
                    <div style={{ marginTop: 3, color:'var(--fg-2)' }}>{c.why}</div>
                  </div>
                </div>
                <div className="conf">
                  <div className="pct">{Math.round(c.confidence*100)}</div>
                  <div className="label">conf</div>
                </div>
              </div>
            ))}
            <div className="insight-actions">
              <button>⊕ Overlay evidence channels</button>
              <button>→ Jump video + map</button>
              <button>⎘ Compare to prior run</button>
              <button>⇱ Export evidence bundle</button>
            </div>
          </>
        )}

        {tab === 'graph' && (
          <>
            <div className="section-hd">Evidence graph layout</div>
            <div className="tweak-seg" style={{ marginBottom: 8 }}>
              {['force','radial','timeline'].map(m => (
                <button key={m} className={layoutMode===m?'on':''} onClick={() => onLayoutChange(m)}>
                  {m}
                </button>
              ))}
            </div>
            <div style={{ height: 260, border: '1px solid var(--line-1)' }}>
              <RelationGraphPanel panel={{}} layoutMode={layoutMode}/>
            </div>
            <div className="section-hd">Edge types</div>
            <div>
              {['temporal-lead','formula-dependency','shared-subsystem','shared-frame','correlation','operator-bookmark'].map(k => (
                <span key={k} className="evidence-chip">◦ {k}</span>
              ))}
            </div>
          </>
        )}

        {tab === 'evidence' && (
          <>
            <div className="section-hd">Why this was flagged</div>
            <div style={{ fontSize: 11, color: 'var(--fg-1)', lineHeight: 1.55 }}>
              Hydraulic Pressure A deviated +28 bar from its 5s rolling baseline (<span className="mono">μ=207.2, σ=2.8</span>)
              — a <b>9.9σ excursion</b>. The excursion overlaps with a CRC burst on frame 0x2A and a simultaneous
              bus-current transient leading by 120 ms.
            </div>
            <div className="section-hd">Linked evidence</div>
            <div>
              <span className="evidence-chip">⚠ alarm · PWR.DIP @ 182.341</span>
              <span className="evidence-chip">⌁ crc-cluster · 14 frames</span>
              <span className="evidence-chip">▶ video · cam_front · t+1.1s</span>
              <span className="evidence-chip">⌖ map · 37.512N 127.041E</span>
              <span className="evidence-chip">⌬ formula · P = V·I</span>
            </div>
            <div className="section-hd">Exportable context</div>
            <div className="insight-actions">
              <button>Evidence card · CSV</button>
              <button>Evidence card · Matlab</button>
            </div>
          </>
        )}

        {tab === 'related' && (
          <>
            <div className="section-hd">Related channels</div>
            {anomaly.relatedChannels.map(id => {
              const c = CH[id];
              if (!c) return null;
              return (
                <div key={id} className="candidate" onClick={() => onJumpToCh(id)}>
                  <div className="rank" style={{ fontSize: 11 }}>
                    <span className={`ctype ${c.type}`}>{c.type}</span>
                  </div>
                  <div>
                    <div className="cand-title">{c.display}</div>
                    <div className="cand-why">{c.group} · {c.unit} · {c.rate} Hz</div>
                  </div>
                  <div className="conf">
                    <div className="pct" style={{ fontSize: 11 }}>⊕</div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab === 'llm' && (
          <>
            <div className="section-hd">Ask about this observation</div>
            <textarea placeholder="e.g., why did pressure and current rise together?"
                      style={{ width:'100%', minHeight:60, background:'var(--bg-2)',
                               border:'1px solid var(--line-1)', color:'var(--fg-0)',
                               padding:6, fontFamily:'inherit', fontSize:11, resize:'vertical' }}/>
            <div className="section-hd">Suggested prompts</div>
            <div>
              <span className="evidence-chip">What caused this spike?</span>
              <span className="evidence-chip">Is this similar to run 0918?</span>
              <span className="evidence-chip">Summarize the 200ms window</span>
            </div>
            <div className="section-hd">Tool trace · last query</div>
            <div style={{ fontFamily:'JetBrains Mono', fontSize:10, color:'var(--fg-1)', lineHeight:1.6 }}>
              <div>→ query_window(ch=1205, t=182.28..182.44)</div>
              <div>→ list_alarms(window=±80ms) · 2 hits</div>
              <div>→ correlate(ch=1205, candidates=24)</div>
              <div>→ fetch_formula_graph(ch=1205) · 3 deps</div>
              <div style={{ color:'var(--amber-0)' }}>⌁ completed · 4 tools · 6 evidence items</div>
            </div>
            <div className="section-hd">Answer</div>
            <div style={{ fontSize: 11, lineHeight: 1.55, color: 'var(--fg-0)' }}>
              Evidence suggests the pressure spike is downstream of a bus-current transient on CH 1002,
              leading the pressure rise by ~120 ms. The P = V·I bridge formula and a co-occurring PDU BIT
              fault bit support this chain. Confidence rests on 6 cited evidence items — not LLM recall.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// =========== Bottom console ===========
function BottomConsole({ mode, cursorTime, crcRate, fps }) {
  return (
    <div className="console">
      <span className="metric"><span className="m-label">pkt/s</span><span className="m-val ok mono">3,247</span></span>
      <div className="divider"/>
      <span className="metric"><span className="m-label">frame/s</span><span className="m-val mono">847</span></span>
      <div className="divider"/>
      <span className="metric"><span className="m-label">CRC fail</span><span className={`m-val mono ${crcRate > 0.5 ? 'warn':''}`}>{crcRate.toFixed(2)}%</span></span>
      <div className="divider"/>
      <span className="metric"><span className="m-label">sync loss</span><span className="m-val mono">1</span></span>
      <div className="divider"/>
      <span className="metric"><span className="m-label">alarms</span><span className="m-val alarm mono">2</span></span>
      <div className="divider"/>
      <span className="metric"><span className="m-label">FPS</span><span className="m-val mono">{fps}</span></span>
      <div className="divider"/>
      <span className="metric"><span className="m-label">LLM</span><span className="m-val ok mono">llama-3.1-8b · local</span></span>
      <div className="divider"/>
      <div className="ticker">
        <div className="ticker-inner">
          {[...EVENTS, ...EVENTS].map((e, i) => (
            <span key={i} className={`ticker-item ${e.sev}`}>
              <span className="ts">[T+{e.t.toFixed(3)}]</span>
              <span className="sev">{e.sev.toUpperCase()}</span>
              <span style={{ color:'var(--amber-0)', marginRight:6 }}>{e.code}</span>
              {e.msg}
            </span>
          ))}
        </div>
      </div>
      <div className="divider"/>
      <span className="metric"><span className="m-label">offline</span><span className="m-val ok mono">◉ airgapped</span></span>
      <span className="metric"><span className="m-label">cursor</span><span className="m-val mono" style={{ color:'var(--amber-0)' }}>{cursorTime.toFixed(3)}s</span></span>
    </div>
  );
}

// =========== Tweaks panel ===========
const THEMES = [
  { id: 'warm',     color: '#e5a24a', label: 'Amber'    },
  { id: 'cool',     color: '#4fa0c4', label: 'Cool'     },
  { id: 'sage',     color: '#6ea85f', label: 'Sage'     },
  { id: 'terminal', color: '#7ab155', label: 'Terminal' },
];

function TweaksPanel({ theme, onTheme, density, onDensity, relLayout, onRelLayout, onClose }) {
  return (
    <div className="tweaks">
      <div className="tweaks-hd">
        Tweaks
        <button className="close" onClick={onClose}>×</button>
      </div>
      <div className="tweaks-body">
        <div className="tweak-row">
          <label>Accent</label>
          <div className="tweak-swatches">
            {THEMES.map(t => (
              <button key={t.id} className={theme===t.id?'on':''}
                      style={{ background: t.color }}
                      title={t.label}
                      onClick={() => onTheme(t.id)}/>
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <label>Density</label>
          <div className="tweak-seg">
            {['compact', 'roomy'].map(d => (
              <button key={d} className={density===d?'on':''} onClick={() => onDensity(d)}>{d}</button>
            ))}
          </div>
        </div>
        <div className="tweak-row">
          <label>Relation Graph Layout</label>
          <div className="tweak-seg">
            {['force','radial','timeline'].map(l => (
              <button key={l} className={relLayout===l?'on':''} onClick={() => onRelLayout(l)}>{l}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { TopBar, ChannelExplorer, InsightPane, BottomConsole, TweaksPanel });

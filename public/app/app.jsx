// Main App — assembles layout, wires drag/drop, panel grid, anomaly flow

const INITIAL_PANELS = [
  // Panel definitions — grid position is col/row start/span in 12x12
  { id: 'p1', kind: 'strip',        title: 'Power Bus',         bindings: [{type:'channel', channelId:1001}, {type:'channel', channelId:1002}], gx: 1, gy: 1, gw: 5, gh: 3, linked: true },
  { id: 'p2', kind: 'strip',        title: 'Hydraulic A / B',   bindings: [{type:'channel', channelId:1205}, {type:'channel', channelId:1206}], gx: 6, gy: 1, gw: 4, gh: 3, linked: true },
  { id: 'p3', kind: 'numeric',      title: 'Flight State',      bindings: [{type:'channel', channelId:1001}, {type:'channel', channelId:1002}, {type:'channel', channelId:2217}, {type:'channel', channelId:2218}, {type:'channel', channelId:1205}, {type:'channel', channelId:1207}], gx: 10, gy: 1, gw: 3, gh: 3 },
  { id: 'p4', kind: 'strip',        title: 'Pose · Roll/Pitch/Yaw', bindings: [{type:'channel', channelId:2210}, {type:'channel', channelId:2211}, {type:'channel', channelId:2212}], gx: 1, gy: 4, gw: 4, gh: 3, linked: true },
  { id: 'p5', kind: 'waterfall',    title: 'RF Spectrum L-band', bindings: [{type:'channel', channelId:5001}], gx: 5, gy: 4, gw: 4, gh: 3 },
  { id: 'p6', kind: 'attitude3d',   title: 'ADI · Attitude',     bindings: [{type:'channel', channelId:2210}, {type:'channel', channelId:2211}, {type:'channel', channelId:2212}], gx: 9, gy: 4, gw: 4, gh: 3 },
  { id: 'p7', kind: 'map2d',        title: 'Map · Sortie Track', bindings: [{type:'channel', channelId:3001}], gx: 1, gy: 7, gw: 3, gh: 3 },
  { id: 'p8', kind: 'video',        title: 'Video · Front EO',   bindings: [{type:'channel', channelId:7001}], gx: 4, gy: 7, gw: 2, gh: 3 },
  { id: 'p8b',kind: 'trajectory3d', title: '3D Trajectory',      bindings: [{type:'channel', channelId:3501}, {type:'channel', channelId:3502}, {type:'channel', channelId:3503}], gx: 6, gy: 7, gw: 3, gh: 3 },
  { id: 'p9', kind: 'relationgraph',title: 'Evidence Graph',     bindings: [], gx: 9, gy: 7, gw: 2, gh: 3 },
  { id: 'p10',kind: 'simdisbridge', title: 'SimDIS Bridge',      bindings: [], gx: 11, gy: 7, gw: 2, gh: 3 },
  { id: 'p11',kind: 'discrete',     title: 'Discrete States',    bindings: [{type:'channel', channelId:1007}, {type:'channel', channelId:1210}, {type:'channel', channelId:5004}, {type:'channel', channelId:5005}], gx: 1, gy: 10, gw: 4, gh: 2 },
  { id: 'p12',kind: 'eventlog',     title: 'Event Log · Alarms', bindings: [], gx: 5, gy: 10, gw: 5, gh: 2 },
  { id: 'p13',kind: 'strip',        title: 'Link RSSI · SNR',    bindings: [{type:'channel', channelId:5002}, {type:'channel', channelId:5003}], gx: 10, gy: 10, gw: 3, gh: 2 },
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "warm",
  "density": "compact",
  "relLayout": "force"
}/*EDITMODE-END*/;

function App() {
  const [mode, setMode] = useState('live');
  const [playing, setPlaying] = useState(true);
  const [rate, setRate] = useState(1);
  const [panels, setPanels] = useState(INITIAL_PANELS);
  const [focused, setFocused] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [favorites, setFavorites] = useState(new Set([1001, 1002, 1205, 2210, 5001]));
  const [anomaly, setAnomaly] = useState(null);
  const [cursorTime, setCursorTime] = useState(182.340);
  const [tweaksOn, setTweaksOn] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [matlabOpen, setMatlabOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [llmOpen, setLlmOpen] = useState(false);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [streamsOpen, setStreamsOpen] = useState(false);
  const [sequenceOpen, setSequenceOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [sheet, setSheet] = useState('workstation'); // workstation | space | ew | gps

  // Persistent tweakables
  const [theme, setTheme] = useState(TWEAK_DEFAULTS.theme);
  const [density, setDensity] = useState(TWEAK_DEFAULTS.density);
  const [relLayout, setRelLayout] = useState(TWEAK_DEFAULTS.relLayout);

  // Cursor time ticker
  const t = useTicker(playing && mode === 'live');
  useEffect(() => {
    if (mode === 'live' && playing) setCursorTime(182.340 + t * rate);
  }, [t, mode, playing, rate]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setPaletteOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault(); setExportOpen(true);
      } else if (e.key === ' ' && e.target === document.body) {
        e.preventDefault(); setPlaying(p => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Edit mode protocol
  useEffect(() => {
    const handler = (e) => {
      if (!e.data) return;
      if (e.data.type === '__activate_edit_mode') setTweaksOn(true);
      if (e.data.type === '__deactivate_edit_mode') setTweaksOn(false);
    };
    window.addEventListener('message', handler);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch(_){}
    return () => window.removeEventListener('message', handler);
  }, []);

  const persist = (edits) => {
    try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*'); } catch(_){}
  };

  const handleSelectChannel = (id, additive) => {
    setSelectedIds(s => {
      const n = new Set(additive ? s : []);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const handleFavToggle = (id) => {
    setFavorites(f => { const n = new Set(f); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleDrop = (panelId, zone, payload) => {
    if (!payload || payload.kind !== 'channel-drag') return;
    setPanels(ps => ps.map(p => {
      if (p.id !== panelId) return p;
      const exists = p.bindings.some(b => b.type === 'channel' && b.channelId === payload.channelId);
      if (zone === 'center') {
        if (exists) return p;
        return { ...p, bindings: [...p.bindings, { type: 'channel', channelId: payload.channelId }] };
      }
      // For edge drops we simulate a split-notification — simpler: add binding + flash focus
      if (exists) return p;
      return { ...p, bindings: [...p.bindings, { type: 'channel', channelId: payload.channelId }] };
    }));
    setFocused(panelId);
    setTimeout(() => setFocused(null), 700);
  };

  const handlePointClick = (pt) => {
    if (pt.anomalyId === 'anom-001') {
      setAnomaly(ANOMALY);
    } else {
      setAnomaly(null);
    }
    setCursorTime(182.28 + pt.t * 0.16);
  };

  const handleSelectEvent = (e) => {
    if (e.code === 'HYD.SPIKE') {
      setAnomaly(ANOMALY);
      setCursorTime(e.t);
    }
  };

  const handleJumpToCh = (id) => {
    // Add channel as overlay into the Hyd panel as a demo
    const target = 'p2';
    setPanels(ps => ps.map(p => {
      if (p.id !== target) return p;
      const exists = p.bindings.some(b => b.type === 'channel' && b.channelId === id);
      if (exists) return p;
      return { ...p, bindings: [...p.bindings, { type: 'channel', channelId: id }] };
    }));
    setFocused(target);
    setTimeout(() => setFocused(null), 800);
  };

  const handleClosePanel = (id) => setPanels(ps => ps.filter(p => p.id !== id));

  // Simulate CRC rate & FPS
  const fps = Math.round(58 + Math.sin(t) * 2);
  const crcRate = 0.12;

  const renderPanelBody = (p) => {
    switch (p.kind) {
      case 'strip':         return <StripChart panel={p} cursor={0.5} mode={mode} onPointClick={handlePointClick}/>;
      case 'numeric':       return <NumericPanel panel={p} mode={mode}/>;
      case 'waterfall':     return <WaterfallPanel panel={p} mode={mode}/>;
      case 'discrete':      return <DiscretePanel panel={p}/>;
      case 'eventlog':      return <EventLogPanel panel={p} onSelectEvent={handleSelectEvent} selectedAnomalyId={anomaly?.id}/>;
      case 'map2d':         return <MapPanel panel={p} mode={mode}/>;
      case 'video':         return <VideoPanel panel={p} mode={mode}/>;
      case 'attitude3d':    return <Attitude3DPanel panel={p} mode={mode}/>;
      case 'trajectory3d':  return <Trajectory3DPanel panel={p} mode={mode}/>;
      case 'relationgraph': return <RelationGraphPanel panel={p} layoutMode={relLayout} selectedAnomalyId={anomaly?.id}/>;
      case 'simdisbridge':  return <SimdisBridgePanel panel={p}/>;
      case 'globe':         return <GlobePanel panel={p} mode={mode}/>;
      case 'gpslos':        return <GpsLosPanel panel={p}/>;
      default:              return <div style={{ padding: 20, color: 'var(--fg-2)' }}>Unknown panel type</div>;
    }
  };

  return (
    <div className="app" data-theme={theme} data-density={density}>
      <TopBar
        mode={mode} onModeChange={setMode}
        playing={playing} onPlayToggle={() => setPlaying(p => !p)}
        cursorTime={cursorTime}
        rate={rate} onRate={setRate}
        tweaksOn={tweaksOn} onTweaksToggle={() => setTweaksOn(v => !v)}
        onExport={() => setExportOpen(true)}
        onMatlab={() => setMatlabOpen(true)}
        onPalette={() => setPaletteOpen(true)}
        onLayout={() => setLayoutOpen(true)}
        onLLM={() => setLlmOpen(v => !v)}
        onMapping={() => setMappingOpen(true)}
        onLibrary={() => setLibraryOpen(true)}
        onStreams={() => setStreamsOpen(true)}
        onSequence={() => setSequenceOpen(true)}
        onReport={() => setReportOpen(true)}
      />

      <div className="body">
        <ChannelExplorer
          selectedIds={selectedIds}
          onSelect={handleSelectChannel}
          onFavToggle={handleFavToggle}
          favorites={favorites}
        />

        <div className="workspace">
          <div className="ws-toolbar">
            <div className="sheet-tabs">
              {[
                ['workstation', '▤ Workstation', panels.length + ' panels'],
                ['space',       '◎ Space',       'Globe · Sat · Threats'],
                ['ew',          '△ EW Theater',  '1247 UAV · Live'],
                ['gps',         '○ GPS LOS',     'PDOP 1.42 · RTK FIX'],
              ].map(([k, label, sub]) => (
                <button key={k} className={`sheet-tab ${sheet===k?'on':''}`} onClick={() => setSheet(k)}>
                  <span className="sheet-tab-l">{label}</span>
                  <span className="sheet-tab-s mono">{sub}</span>
                </button>
              ))}
            </div>
            <div className="spacer"/>
            {sheet === 'workstation' && <>
              <button className="ws-btn on">Link Cursor</button>
              <button className="ws-btn">Compare Runs</button>
              <button className="ws-btn">Add Panel +</button>
              <button className="ws-btn">Save Workspace</button>
            </>}
            {sheet === 'space' && <>
              <button className="ws-btn">TLE Import</button>
              <button className="ws-btn">Pin to Workstation</button>
            </>}
            {sheet === 'ew' && <>
              <button className="ws-btn on">REC ON</button>
              <button className="ws-btn">Mission Plan</button>
              <button className="ws-btn">Engagement Authority</button>
            </>}
            {sheet === 'gps' && <>
              <button className="ws-btn">RTCM Stream</button>
              <button className="ws-btn">Almanac</button>
            </>}
          </div>

          {sheet === 'workstation' && (
            <div className="dockgrid" data-screen-label="Main Workspace">
              {panels.map(p => (
                <Panel key={p.id}
                       panel={p}
                       focused={focused === p.id}
                       onFocus={() => setFocused(p.id)}
                       onClose={() => handleClosePanel(p.id)}
                       onDrop={(zone, payload) => handleDrop(p.id, zone, payload)}>
                  {renderPanelBody(p)}
                </Panel>
              ))}
            </div>
          )}
          {sheet === 'space' && <GlobeSheet active/>}
          {sheet === 'ew'    && <EwSheet active/>}
          {sheet === 'gps'   && <GpsSheet active/>}
        </div>

        <InsightPane
          anomaly={anomaly}
          onJumpToCh={handleJumpToCh}
          layoutMode={relLayout}
          onLayoutChange={(m) => { setRelLayout(m); persist({ relLayout: m }); }}
          onClose={() => setAnomaly(null)}
        />
      </div>

      <BottomConsole mode={mode} cursorTime={cursorTime} crcRate={crcRate} fps={fps}/>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} selectedChannels={selectedIds}/>
      <MatlabModal open={matlabOpen} onClose={() => setMatlabOpen(false)}/>
      <LayoutPresetModal open={layoutOpen} onClose={() => setLayoutOpen(false)}/>
      <LLMDrawer open={llmOpen} onClose={() => setLlmOpen(false)}/>
      <ChannelMappingEditor open={mappingOpen} onClose={() => setMappingOpen(false)}/>
      <StreamConfigModal open={streamsOpen} onClose={() => setStreamsOpen(false)}/>
      <SequenceValidator open={sequenceOpen} onClose={() => setSequenceOpen(false)}
        onOpenReport={() => { setSequenceOpen(false); setReportOpen(true); }}/>
      <TestReportModal open={reportOpen} onClose={() => setReportOpen(false)}/>
      <RecordingLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)}
        onOpenRecording={(r) => { setLibraryOpen(false); setMode('replay'); }}/>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)}
        onRunCommand={(r) => {
          if (r.kind === 'channel') handleJumpToCh(r.channelId);
          else if (r.label.startsWith('Jump · hydraulic')) setAnomaly(ANOMALY);
          else if (r.label.includes('Export')) setExportOpen(true);
          else if (r.label.includes('MATLAB')) setMatlabOpen(true);
        }}
      />

      {tweaksOn && (
        <TweaksPanel
          theme={theme} onTheme={(v) => { setTheme(v); persist({ theme: v }); }}
          density={density} onDensity={(v) => { setDensity(v); persist({ density: v }); }}
          relLayout={relLayout} onRelLayout={(v) => { setRelLayout(v); persist({ relLayout: v }); }}
          onClose={() => setTweaksOn(false)}
        />
      )}
    </div>
  );
}

function Panel({ panel, focused, onFocus, onClose, onDrop, children }) {
  const style = {
    gridColumn: `${panel.gx} / span ${panel.gw}`,
    gridRow:    `${panel.gy} / span ${panel.gh}`,
  };
  return (
    <div className={`panel ${focused?'focused':''}`}
         style={style}
         onMouseDown={onFocus}
         data-screen-label={panel.title}>
      <PanelHeader
        panel={panel}
        onAction={(a) => a === 'close' && onClose()}
        focused={focused}
      />
      <div className="panel-body">
        {children}
        <DropOverlay panel={panel} onDrop={onDrop}/>
      </div>
      <div className="panel-footer">
        <span>{panel.kind.toUpperCase()}</span>
        <span>·</span>
        <span>{panel.bindings.filter(b => b.type==='channel').length} ch</span>
        <div className="spacer"/>
        <span>{panel.linked ? '⌖ linked' : ''}</span>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);

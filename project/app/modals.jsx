// Export, Matlab, Command Palette modals

// =========== Export Modal ===========
function ExportModal({ open, onClose, selectedChannels }) {
  const [format, setFormat] = useState('csv');
  const [target, setTarget] = useState('channels');
  const [quality, setQuality] = useState('good-crc-only');
  const [valueMode, setValueMode] = useState('both');
  const [includeMeta, setIncludeMeta] = useState(true);
  const [fileSplit, setFileSplit] = useState(false);
  const [fileName, setFileName] = useState('sortie_0420_hyd_spike');

  if (!open) return null;

  const channels = selectedChannels && selectedChannels.size > 0
    ? Array.from(selectedChannels)
    : [1001, 1002, 1205, 2210];
  const excluded = quality === 'keep-all' ? 0 : quality === 'good-crc-only' ? 14 : 38;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 720 }} onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <span>Export</span>
          <button onClick={onClose} className="modal-close">×</button>
        </div>
        <div className="modal-tabs">
          {[['csv','CSV'],['parquet','Parquet'],['arrow','Arrow IPC'],['matlab','MATLAB'],['snapshot','Snapshot']].map(([k,l]) => (
            <button key={k} className={format===k?'on':''} onClick={() => setFormat(k)}>{l}</button>
          ))}
        </div>
        <div className="modal-body">
          <div className="mf-grid">
            <div className="mf-row">
              <label>Target</label>
              <div className="tweak-seg">
                {['channels','panel','selection','anomaly'].map(t => (
                  <button key={t} className={target===t?'on':''} onClick={() => setTarget(t)}>{t}</button>
                ))}
              </div>
            </div>
            <div className="mf-row">
              <label>Channels</label>
              <div className="mf-chips">
                {channels.map(id => {
                  const c = CH[id];
                  return c ? (
                    <span key={id} className="evidence-chip">
                      <span className={`ctype ${c.type}`} style={{ fontSize:8, padding:'0 3px' }}>{c.type}</span>
                      {c.name}
                    </span>
                  ) : null;
                })}
                <span className="evidence-chip" style={{ cursor:'pointer' }}>+ add</span>
              </div>
            </div>
            <div className="mf-row">
              <label>Time Range</label>
              <div style={{ display:'flex', gap:6, fontFamily:'JetBrains Mono', fontSize:11 }}>
                <input className="mf-input" defaultValue="182.200"/>
                <span style={{ color:'var(--fg-3)', alignSelf:'center' }}>—</span>
                <input className="mf-input" defaultValue="182.500"/>
                <span style={{ color:'var(--fg-3)', alignSelf:'center', fontSize:10 }}>300 ms · 60,000 samples</span>
              </div>
            </div>
            <div className="mf-row">
              <label>Quality Policy</label>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {[
                  ['keep-all',          'Keep all rows',                  'No filtering. Includes bad CRC, decode errors, stale.'],
                  ['good-crc-only',     'Only good CRC',                  'Drops rows where frame CRC did not validate.'],
                  ['decode-valid-only', 'Only decode-valid / formula-valid','Drops rows where decoder or derived formula failed.'],
                  ['split-by-quality',  'Split good / bad into separate files', 'Produces <name>.csv and <name>.rejects.csv'],
                  ['anomaly-adjacent',  'Only anomaly-adjacent rows',     '±200ms around detected anomalies.'],
                ].map(([v, l, d]) => (
                  <label key={v} className="mf-radio">
                    <input type="radio" checked={quality===v} onChange={() => setQuality(v)}/>
                    <div>
                      <div style={{ color:'var(--fg-0)', fontSize:11 }}>{l}</div>
                      <div style={{ color:'var(--fg-2)', fontSize:10 }}>{d}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="mf-row">
              <label>Value Mode</label>
              <div className="tweak-seg">
                {['raw','eng','both'].map(v => (
                  <button key={v} className={valueMode===v?'on':''} onClick={() => setValueMode(v)}>{v}</button>
                ))}
              </div>
            </div>
            <div className="mf-row">
              <label>Options</label>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                <label className="mf-check"><input type="checkbox" checked={includeMeta} onChange={e => setIncludeMeta(e.target.checked)}/> Include metadata JSON sidecar</label>
                <label className="mf-check"><input type="checkbox" checked={fileSplit} onChange={e => setFileSplit(e.target.checked)}/> Split by 100k rows</label>
                <label className="mf-check"><input type="checkbox" defaultChecked/> Include quality flags column</label>
                <label className="mf-check"><input type="checkbox" defaultChecked/> Include original timestamp (ns)</label>
              </div>
            </div>
            <div className="mf-row">
              <label>Output Path</label>
              <input className="mf-input" style={{ width:'100%' }}
                     defaultValue={`/data/exports/${fileName}.${format}`}/>
            </div>
          </div>

          <div className="mf-preview">
            <div className="mf-preview-hd">Preview</div>
            <pre className="mono" style={{ margin:0, fontSize:10, lineHeight:1.5 }}>
{`# ${channels.length} channels · 60,000 rows · ~${(channels.length * 60000 * 12 / 1024 / 1024).toFixed(1)} MB
timestamp_ns,ch1001_raw,ch1001_eng,ch1001_q,ch1002_raw,ch1002_eng,ch1002_q
182200000000,0x0E34,28.14,OK,0x1A80,42.18,OK
182200005000,0x0E35,28.16,OK,0x1A82,42.21,OK
182200010000,0x0E30,28.11,OK,0x1A85,42.27,OK
...`}
            </pre>
          </div>
        </div>

        <div className="modal-footer">
          <div className="mf-stat">
            <span className="m-label">to export</span>
            <span className="mono" style={{ color:'var(--fg-0)' }}>{60000 - excluded} rows</span>
            {excluded > 0 && (
              <span style={{ color:'var(--warn)', fontSize:10, marginLeft:6 }}>
                · {excluded} dropped by quality policy
              </span>
            )}
          </div>
          <div className="spacer"/>
          <button className="tb-btn" onClick={onClose}>Cancel</button>
          <button className="tb-btn">Queue in background</button>
          <button className="tb-btn primary">Export now</button>
        </div>
      </div>
    </div>
  );
}

// =========== Matlab Handoff Modal ===========
function MatlabModal({ open, onClose }) {
  const [preset, setPreset] = useState('overlay');
  if (!open) return null;
  const presets = [
    ['overlay',   'Overlay time plot',       'Single figure, multiple series, shared x-axis.'],
    ['split',     'Split time plot',         'Subplots stacked, one series per axis.'],
    ['xy',        'Scatter / XY',            'Two-channel relationship, time-colored.'],
    ['spectro',   'Spectrogram-like plot',   'STFT of selected analog channel.'],
    ['evidence',  'Anomaly evidence bundle', 'All evidence channels + alarm markers.'],
    ['compare',   'Compare runs',            'Same channels across multiple runs, aligned.'],
  ];
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-hd">
          <span>MATLAB Handoff</span>
          <button onClick={onClose} className="modal-close">×</button>
        </div>
        <div className="modal-body">
          <div className="mf-grid">
            <div className="mf-row">
              <label>Bridge</label>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <span className="status-chip"><span className="led ok"/> MATLAB R2024b · MCP ready</span>
                <span style={{ fontSize:10, color:'var(--fg-2)' }}>local, airgapped</span>
              </div>
            </div>
            <div className="mf-row">
              <label>Plot preset</label>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {presets.map(([v, l, d]) => (
                  <label key={v} className="mf-radio">
                    <input type="radio" checked={preset===v} onChange={() => setPreset(v)}/>
                    <div>
                      <div style={{ fontSize:11 }}>{l}</div>
                      <div style={{ color:'var(--fg-2)', fontSize:10 }}>{d}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="mf-row">
              <label>Handoff</label>
              <div className="tweak-seg">
                <button className="on">Direct bridge</button>
                <button>Temp .mat file</button>
                <button>Script only</button>
              </div>
            </div>
            <div className="mf-row">
              <label>Script preview</label>
              <pre className="mf-preview" style={{ margin:0, padding:10, fontSize:10, lineHeight:1.55 }}>
{`% RealTimeInsight → MATLAB handoff
run  = load_rti_run('/data/runs/sortie-0420.rti');
tr   = [182.200 182.500];
ch   = {'bus_voltage','bus_current','hyd_pressure_1','hyd_pressure_2'};
data = rti_window(run, ch, tr, 'quality', 'good-crc-only');

figure('Name','RTI Overlay');
plot(data.t, data.y);
legend(ch, 'Interpreter', 'none');
xlabel('T+ (s)'); ylabel('engineering units');
grid on; title('Hydraulic spike window · ${preset}');`}
              </pre>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <div className="spacer"/>
          <button className="tb-btn" onClick={onClose}>Cancel</button>
          <button className="tb-btn">Copy script</button>
          <button className="tb-btn primary">Plot in MATLAB</button>
        </div>
      </div>
    </div>
  );
}

// =========== Command Palette ===========
const COMMANDS = [
  { cat: 'Panels',   label: 'New Strip Chart panel',         kbd: 'N S', kind: 'cmd' },
  { cat: 'Panels',   label: 'New Waterfall panel',           kbd: 'N W', kind: 'cmd' },
  { cat: 'Panels',   label: 'New Map panel',                 kbd: 'N M', kind: 'cmd' },
  { cat: 'Panels',   label: 'Convert focused panel to Strip', kind: 'cmd' },
  { cat: 'Layouts',  label: 'Open layout · Flight Analysis', kind: 'cmd' },
  { cat: 'Layouts',  label: 'Open layout · RF / Spectrum',   kind: 'cmd' },
  { cat: 'Layouts',  label: 'Open layout · Integrated Map + Video', kind: 'cmd' },
  { cat: 'Bookmarks',label: 'Jump · climb segment start',    kbd: 'T+181.120', kind: 'cmd' },
  { cat: 'Bookmarks',label: 'Jump · hydraulic spike',        kbd: 'T+182.340', kind: 'cmd' },
  { cat: 'Anomalies',label: 'Recent · HYD.SPIKE @ 182.340',  kind: 'cmd' },
  { cat: 'Anomalies',label: 'Recent · AOA.HIGH @ 179.820',   kind: 'cmd' },
  { cat: 'Commands', label: 'Export selection as CSV',       kbd: '⌘E', kind: 'cmd' },
  { cat: 'Commands', label: 'Send selection to MATLAB',      kind: 'cmd' },
  { cat: 'Commands', label: 'Save workspace',                kbd: '⌘S', kind: 'cmd' },
  { cat: 'Commands', label: 'Toggle Insight Pane',           kind: 'cmd' },
  { cat: 'Integrations', label: 'Connect SimDIS bridge',     kind: 'cmd' },
  { cat: 'Integrations', label: 'Reload offline map pack · Korea Sat', kind: 'cmd' },
  { cat: 'LLM',      label: 'Why did pressure & current rise together?', kind: 'cmd' },
  { cat: 'LLM',      label: 'Summarize last 30s of alarms',  kind: 'cmd' },
];

function CommandPalette({ open, onClose, onRunCommand }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setQ(''); setSel(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  // Include channels in palette results
  const results = useMemo(() => {
    const Q = q.trim().toLowerCase();
    const chs = ALL_CHANNELS
      .filter(c => !Q || c.name.includes(Q) || c.display.toLowerCase().includes(Q) || String(c.id).includes(Q))
      .slice(0, 6)
      .map(c => ({ cat: 'Channels', label: c.display, kbd: `CH${c.id} · ${c.group}`, kind: 'channel', channelId: c.id }));
    const cmds = COMMANDS.filter(c => !Q || c.label.toLowerCase().includes(Q) || c.cat.toLowerCase().includes(Q));
    return [...chs, ...cmds];
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(results.length - 1, s + 1)); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
      else if (e.key === 'Enter')     { e.preventDefault(); const r = results[sel]; if (r) { onRunCommand?.(r); onClose(); } }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, results, sel, onClose, onRunCommand]);

  if (!open) return null;

  // group by category
  const grouped = {};
  results.forEach((r, i) => {
    (grouped[r.cat] ||= []).push({ ...r, idx: i });
  });

  return (
    <div className="modal-backdrop palette-backdrop" onClick={onClose}>
      <div className="palette" onClick={e => e.stopPropagation()}>
        <div className="palette-hd">
          <span className="mono" style={{ color:'var(--amber-0)' }}>⌘K</span>
          <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setSel(0); }}
                 placeholder="Search channels, layouts, bookmarks, commands…"/>
          <span style={{ fontSize: 9, color: 'var(--fg-3)' }}>ESC</span>
        </div>
        <div className="palette-body">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="palette-cat">{cat}</div>
              {items.map(r => (
                <div key={r.idx} className={`palette-row ${sel===r.idx?'on':''}`}
                     onMouseEnter={() => setSel(r.idx)}
                     onClick={() => { onRunCommand?.(r); onClose(); }}>
                  <span className="palette-icon">
                    {r.kind === 'channel' ? '◇' : cat === 'Anomalies' ? '▲' : cat === 'Bookmarks' ? '★' : '▸'}
                  </span>
                  <span className="palette-label">{r.label}</span>
                  {r.kbd && <span className="palette-kbd mono">{r.kbd}</span>}
                </div>
              ))}
            </div>
          ))}
          {results.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)' }}>
              No results for “{q}”
            </div>
          )}
        </div>
        <div className="palette-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> run</span>
          <span><kbd>esc</kbd> close</span>
          <div className="spacer"/>
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ExportModal, MatlabModal, CommandPalette });

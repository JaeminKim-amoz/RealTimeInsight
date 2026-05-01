// Recording Library — full-screen view for browsing Ch10 recordings, sorties, runs.
// Left: faceted search / filters. Center: recording list (table) + selected detail.
// Right: timeline preview with events scatter, channel audit, quick actions.

const REC_AIRCRAFT = ['T-247', 'T-248', 'F-201', 'RQ-180-A', 'H-98-C'];
const REC_PROFILES = ['Envelope Expansion', 'Weapon Sep', 'Vibe Survey', 'EMI Survey', 'Flutter', 'FCS Tuning', 'Mission Rehearsal', 'Certification'];
const REC_STATUS   = ['New', 'Processed', 'QC Passed', 'QC Failed', 'Anomaly', 'Archived'];

function genRecordings() {
  const out = [];
  const rand = mulberry32(7);
  for (let i = 0; i < 48; i++) {
    const ac = REC_AIRCRAFT[Math.floor(rand() * REC_AIRCRAFT.length)];
    const profile = REC_PROFILES[Math.floor(rand() * REC_PROFILES.length)];
    const sortie = `S-${(2410 + i).toString().padStart(4,'0')}`;
    const date = new Date(2026, 2, 1 + Math.floor(i * 0.9), 8 + Math.floor(rand()*10), Math.floor(rand()*60));
    const durMin = 28 + Math.floor(rand() * 140);
    const size = (durMin * (12 + rand()*16) / 8).toFixed(1); // GB
    const anomalies = Math.floor(rand() * 6);
    const crcBurst = rand() < 0.15;
    const badQC = rand() < 0.1;
    const status = badQC ? 'QC Failed' : anomalies > 3 ? 'Anomaly' : i < 6 ? 'New' : i < 24 ? 'Processed' : rand() < 0.6 ? 'QC Passed' : 'Archived';
    const channels = 180 + Math.floor(rand() * 140);
    out.push({
      id: `rec-${i.toString().padStart(3,'0')}`,
      sortie, ac, profile, date,
      durMin, sizeGB: +size, channels, anomalies, crcBurst, status,
      tags: [
        profile.toLowerCase().replace(/ /g,'-'),
        `block-${Math.floor(rand()*3)+1}`,
        rand() < 0.3 ? 'priority' : null,
        rand() < 0.2 ? 'replay-ready' : null,
      ].filter(Boolean),
      operator: ['J. Choi','H. Park','S. Lim','D. Yoo','M. Han'][Math.floor(rand()*5)],
      range: ['NRA-01','NRA-02','Yellow Sea East','Uljin'][Math.floor(rand()*4)],
      startAlt: 2800 + Math.floor(rand()*2200),
      peakMach: (0.5 + rand() * 0.9).toFixed(2),
      peakNz: (1.0 + rand() * 5.5).toFixed(2),
    });
  }
  return out;
}

function mulberry32(a) {
  return function() {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RECORDINGS = genRecordings();

function fmtDate(d) {
  return d.toISOString().slice(0,10) + ' ' + d.toTimeString().slice(0,5);
}
function fmtDur(m) {
  const h = Math.floor(m / 60), mm = m % 60;
  return `${h}:${mm.toString().padStart(2,'0')}`;
}

function RecFacet({ title, options, selected, onToggle, counts }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform:'uppercase', letterSpacing: 1.2, marginBottom: 5 }}>{title}</div>
      {options.map(o => {
        const isOn = selected.has(o);
        return (
          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', cursor: 'pointer', fontSize: 11 }}>
            <input type="checkbox" checked={isOn} onChange={() => onToggle(o)} style={{ accentColor: 'var(--amber-1)' }}/>
            <span style={{ color: isOn ? 'var(--fg-0)' : 'var(--fg-1)' }}>{o}</span>
            <span style={{ marginLeft: 'auto', color: 'var(--fg-3)', fontFamily:'JetBrains Mono', fontSize: 10 }}>{counts[o] ?? 0}</span>
          </label>
        );
      })}
    </div>
  );
}

function RecordingLibrary({ open, onClose, onOpenRecording }) {
  const [q, setQ] = useState('');
  const [selAircraft, setSelAircraft] = useState(new Set());
  const [selProfile, setSelProfile] = useState(new Set());
  const [selStatus, setSelStatus] = useState(new Set());
  const [sort, setSort] = useState({ key: 'date', dir: 'desc' });
  const [view, setView] = useState('table'); // table | cards
  const [selected, setSelected] = useState(RECORDINGS[0].id);

  if (!open) return null;

  // Filter + sort
  const qLower = q.toLowerCase().trim();
  const filtered = RECORDINGS.filter(r => {
    if (selAircraft.size && !selAircraft.has(r.ac)) return false;
    if (selProfile.size && !selProfile.has(r.profile)) return false;
    if (selStatus.size && !selStatus.has(r.status)) return false;
    if (qLower && !(
      r.sortie.toLowerCase().includes(qLower) ||
      r.profile.toLowerCase().includes(qLower) ||
      r.operator.toLowerCase().includes(qLower) ||
      r.tags.some(t => t.includes(qLower))
    )) return false;
    return true;
  }).sort((a,b) => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const va = a[sort.key], vb = b[sort.key];
    if (va instanceof Date) return (va - vb) * dir;
    if (typeof va === 'number') return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });

  const counts = {
    ac: Object.fromEntries(REC_AIRCRAFT.map(x => [x, RECORDINGS.filter(r => r.ac === x).length])),
    pr: Object.fromEntries(REC_PROFILES.map(x => [x, RECORDINGS.filter(r => r.profile === x).length])),
    st: Object.fromEntries(REC_STATUS.map(x => [x, RECORDINGS.filter(r => r.status === x).length])),
  };

  const toggle = (set, setSet, v) => {
    const n = new Set(set);
    n.has(v) ? n.delete(v) : n.add(v);
    setSet(n);
  };

  const toggleSort = (key) => {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
  };

  const sel = RECORDINGS.find(r => r.id === selected);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'var(--bg-0)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* header */}
      <div style={{
        height: 40, borderBottom: '1px solid var(--line-2)', background: 'var(--bg-2)',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 14,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--amber-0)' }}>
          Recording Library
        </span>
        <span style={{ fontSize: 10, color: 'var(--fg-3)', letterSpacing: 1, textTransform: 'uppercase' }}>
          {RECORDINGS.length} files · {(RECORDINGS.reduce((a,r)=>a+r.sizeGB,0)).toFixed(0)} GB total · local + archive
        </span>
        <div style={{ flex: 1 }}/>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="sortie · profile · operator · tag…"
          style={{
            height: 24, padding: '0 10px', width: 260,
            background: 'var(--bg-0)', border: '1px solid var(--line-1)',
            color: 'var(--fg-0)', fontFamily: 'inherit', fontSize: 11,
          }}/>
        <div style={{ display:'flex', border:'1px solid var(--line-1)' }}>
          {['table','cards'].map(v => (
            <button key={v}
              onClick={() => setView(v)}
              style={{
                padding: '3px 10px',
                background: view===v ? 'var(--amber-2)' : 'var(--bg-3)',
                color: view===v ? '#1a1614' : 'var(--fg-1)',
                border: 'none', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6,
                fontFamily: 'inherit', cursor: 'pointer',
              }}>{v}</button>
          ))}
        </div>
        <button className="tb-btn">Import Ch10…</button>
        <button className="tb-btn primary">Open Selected</button>
        <button className="tb-btn" onClick={onClose}>Close</button>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr 340px', minHeight: 0 }}>
        {/* facets */}
        <div style={{ overflow:'auto', padding: 14, borderRight: '1px solid var(--line-1)', background: 'var(--bg-1)' }}>
          <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform:'uppercase', letterSpacing: 1.2, marginBottom: 8 }}>Date range</div>
          <div style={{ background: 'var(--bg-0)', border: '1px solid var(--line-1)', padding: 8, fontSize: 10.5, color: 'var(--fg-1)', fontFamily: 'JetBrains Mono' }}>
            <div style={{ color: 'var(--fg-3)', fontSize: 9 }}>FROM</div>
            <div>2026-03-01 00:00</div>
            <div style={{ color: 'var(--fg-3)', fontSize: 9, marginTop: 6 }}>TO</div>
            <div>2026-04-21 23:59</div>
          </div>
          <div style={{ marginTop: 14 }}>
            <RecFacet title="Aircraft" options={REC_AIRCRAFT} selected={selAircraft} counts={counts.ac}
              onToggle={(v) => toggle(selAircraft, setSelAircraft, v)}/>
            <RecFacet title="Test Profile" options={REC_PROFILES} selected={selProfile} counts={counts.pr}
              onToggle={(v) => toggle(selProfile, setSelProfile, v)}/>
            <RecFacet title="QC Status" options={REC_STATUS} selected={selStatus} counts={counts.st}
              onToggle={(v) => toggle(selStatus, setSelStatus, v)}/>
          </div>
          <div style={{ marginTop: 14, fontSize: 10, color: 'var(--fg-3)', textTransform:'uppercase', letterSpacing: 1.2, marginBottom: 5 }}>Has event</div>
          {['CRC burst','Sync loss','High g','AoA warn','HydPress spike','Video discont.'].map(t => (
            <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', cursor: 'pointer', fontSize: 11 }}>
              <input type="checkbox" style={{ accentColor: 'var(--amber-1)' }}/>
              <span>{t}</span>
            </label>
          ))}
        </div>

        {/* center: list or cards */}
        <div style={{ overflow:'auto', background: 'var(--bg-0)' }}>
          {view === 'table' && (
            <table className="cme-sheet">
              <thead>
                <tr>
                  {[
                    ['sortie','Sortie'], ['ac','A/C'], ['profile','Profile'],
                    ['date','Started'], ['durMin','Duration'], ['sizeGB','Size'],
                    ['channels','Chans'], ['anomalies','Anom'],
                    ['status','Status'], ['operator','Operator'], ['range','Range'],
                  ].map(([k, label]) => (
                    <th key={k} onClick={() => toggleSort(k)} style={{ cursor: 'pointer' }}>
                      {label}
                      {sort.key === k && <span style={{ color: 'var(--amber-0)', marginLeft: 4 }}>{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id}
                    className={selected === r.id ? 'sel' : ''}
                    onClick={() => setSelected(r.id)}
                    onDoubleClick={() => onOpenRecording && onOpenRecording(r)}
                    style={{ cursor: 'pointer' }}>
                    <td className="mono" style={{ color: 'var(--amber-0)', padding: '4px 8px' }}>{r.sortie}</td>
                    <td className="mono" style={{ color: 'var(--s2)', padding: '4px 8px' }}>{r.ac}</td>
                    <td style={{ padding: '4px 8px' }}>{r.profile}</td>
                    <td className="mono" style={{ color: 'var(--fg-2)', padding: '4px 8px', fontSize: 10 }}>{fmtDate(r.date)}</td>
                    <td className="mono" style={{ color: 'var(--fg-1)', padding: '4px 8px', textAlign: 'right' }}>{fmtDur(r.durMin)}</td>
                    <td className="mono" style={{ color: 'var(--fg-1)', padding: '4px 8px', textAlign: 'right' }}>{r.sizeGB} GB</td>
                    <td className="mono" style={{ color: 'var(--fg-2)', padding: '4px 8px', textAlign: 'right' }}>{r.channels}</td>
                    <td className="mono" style={{
                      padding: '4px 8px', textAlign: 'right',
                      color: r.anomalies > 3 ? 'var(--alarm)' : r.anomalies > 0 ? 'var(--warn)' : 'var(--fg-2)',
                    }}>{r.anomalies || '—'}</td>
                    <td style={{ padding: '4px 8px' }}>
                      <span className={`rec-stat st-${r.status.toLowerCase().replace(/ /g,'-')}`}>{r.status}</span>
                    </td>
                    <td style={{ padding: '4px 8px', color: 'var(--fg-2)', fontSize: 10.5 }}>{r.operator}</td>
                    <td style={{ padding: '4px 8px', color: 'var(--fg-3)', fontSize: 10 }}>{r.range}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {view === 'cards' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, padding: 14 }}>
              {filtered.map(r => (
                <div key={r.id}
                  onClick={() => setSelected(r.id)}
                  onDoubleClick={() => onOpenRecording && onOpenRecording(r)}
                  style={{
                    background: 'var(--bg-1)', border: '1px solid ' + (selected === r.id ? 'var(--amber-1)' : 'var(--line-1)'),
                    padding: 12, cursor: 'pointer', position: 'relative',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span className="mono" style={{ color: 'var(--amber-0)', fontSize: 13, fontWeight: 600 }}>{r.sortie}</span>
                    <span className="mono" style={{ color: 'var(--s2)', fontSize: 10 }}>{r.ac}</span>
                    <span style={{ flex: 1 }}/>
                    <span className={`rec-stat st-${r.status.toLowerCase().replace(/ /g,'-')}`}>{r.status}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-1)', marginTop: 4 }}>{r.profile}</div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--fg-2)', marginTop: 2 }}>{fmtDate(r.date)}</div>

                  {/* mini spark */}
                  <svg viewBox="0 0 260 28" style={{ width: '100%', height: 28, marginTop: 8 }}>
                    <polyline
                      points={Array.from({length: 40}).map((_,i) => {
                        const x = (i / 39) * 260;
                        const y = 14 + Math.sin(i * 0.3 + r.id.charCodeAt(4)) * 5 + Math.cos(i * 0.11) * 3;
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none" stroke="var(--amber-1)" strokeWidth="1" opacity="0.8"/>
                    {r.anomalies > 0 && Array.from({length: Math.min(r.anomalies, 4)}).map((_,i) => (
                      <circle key={i} cx={30 + i*55} cy={14 - (i%2)*4} r="2" fill="var(--alarm)"/>
                    ))}
                  </svg>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 10, color: 'var(--fg-3)', fontFamily: 'JetBrains Mono' }}>
                    <span>{fmtDur(r.durMin)}</span>
                    <span>{r.sizeGB} GB</span>
                    <span>{r.channels} ch</span>
                    {r.anomalies > 0 && <span style={{ color: 'var(--warn)' }}>{r.anomalies} anom</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* right: detail preview */}
        {sel && (
          <div style={{ overflow: 'auto', padding: 14, background: 'var(--bg-1)', borderLeft: '1px solid var(--line-1)' }}>
            <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 }}>Recording</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span className="mono" style={{ fontSize: 16, color: 'var(--amber-0)', fontWeight: 600 }}>{sel.sortie}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--s2)' }}>{sel.ac}</span>
              <span className={`rec-stat st-${sel.status.toLowerCase().replace(/ /g,'-')}`} style={{ marginLeft: 'auto' }}>{sel.status}</span>
            </div>

            {/* timeline preview with events */}
            <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform:'uppercase', letterSpacing: 1, marginBottom: 4 }}>Timeline preview</div>
            <div style={{ background: 'var(--bg-0)', border: '1px solid var(--line-1)', padding: '10px 12px' }}>
              <svg viewBox="0 0 300 60" style={{ width: '100%', height: 60 }}>
                <line x1="0" y1="30" x2="300" y2="30" stroke="var(--line-1)"/>
                {/* channel-density heatmap */}
                {Array.from({length: 60}).map((_,i) => (
                  <rect key={i} x={i*5} y="10" width="4.5" height="3"
                    fill="var(--amber-0)"
                    opacity={0.15 + Math.abs(Math.sin(i*0.4 + sel.id.charCodeAt(4)))*0.45}/>
                ))}
                {/* anomaly pips */}
                {Array.from({length: sel.anomalies}).map((_,i) => {
                  const x = 20 + (i/Math.max(1, sel.anomalies-1)) * 260 + Math.sin(i + sel.id.charCodeAt(4))*20;
                  return (
                    <g key={i}>
                      <line x1={x} y1="18" x2={x} y2="42" stroke="var(--alarm)" strokeWidth="1"/>
                      <circle cx={x} cy="30" r="2.5" fill="var(--alarm)"/>
                    </g>
                  );
                })}
                {sel.crcBurst && (
                  <rect x="120" y="40" width="40" height="6" fill="var(--warn)" opacity="0.7"/>
                )}
                <text x="0" y="55" fontSize="8" fill="var(--fg-3)" fontFamily="JetBrains Mono">t=0</text>
                <text x="300" y="55" fontSize="8" fill="var(--fg-3)" fontFamily="JetBrains Mono" textAnchor="end">{fmtDur(sel.durMin)}</text>
              </svg>
            </div>

            {/* metadata grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '4px 10px', marginTop: 12, fontSize: 10.5 }}>
              <span style={{ color: 'var(--fg-3)' }}>Profile</span>   <span>{sel.profile}</span>
              <span style={{ color: 'var(--fg-3)' }}>Operator</span>  <span>{sel.operator}</span>
              <span style={{ color: 'var(--fg-3)' }}>Range</span>     <span>{sel.range}</span>
              <span style={{ color: 'var(--fg-3)' }}>Started</span>   <span className="mono">{fmtDate(sel.date)}</span>
              <span style={{ color: 'var(--fg-3)' }}>Duration</span>  <span className="mono">{fmtDur(sel.durMin)}</span>
              <span style={{ color: 'var(--fg-3)' }}>Size</span>      <span className="mono">{sel.sizeGB} GB</span>
              <span style={{ color: 'var(--fg-3)' }}>Channels</span>  <span className="mono">{sel.channels}</span>
              <span style={{ color: 'var(--fg-3)' }}>Anomalies</span> <span className="mono" style={{ color: sel.anomalies > 0 ? 'var(--alarm)' : 'var(--fg-1)' }}>{sel.anomalies}</span>
              <span style={{ color: 'var(--fg-3)' }}>Peak Mach</span> <span className="mono" style={{ color: 'var(--s3)' }}>{sel.peakMach}</span>
              <span style={{ color: 'var(--fg-3)' }}>Peak Nz</span>   <span className="mono" style={{ color: 'var(--s3)' }}>{sel.peakNz}g</span>
              <span style={{ color: 'var(--fg-3)' }}>Start alt</span> <span className="mono">{sel.startAlt} m</span>
            </div>

            <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform:'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 4 }}>Tags</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {sel.tags.map(t => (
                <span key={t} style={{ fontSize: 10, padding: '2px 6px', background: 'var(--bg-0)', border: '1px solid var(--line-1)', color: 'var(--fg-2)' }}>{t}</span>
              ))}
            </div>

            <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform:'uppercase', letterSpacing: 1, marginTop: 12, marginBottom: 4 }}>Channel audit</div>
            <div style={{ background: 'var(--bg-0)', border: '1px solid var(--line-1)', padding: 8, fontSize: 10.5 }}>
              {[
                ['TMATS schema', 'IRIG-106-22 ✓', 'var(--ok)'],
                ['CRC pass rate', '99.87%', 'var(--ok)'],
                ['Decoder coverage', `${sel.channels}/${sel.channels} mapped`, 'var(--ok)'],
                ['Time sync (IRIG-B)', 'locked · drift 0.3 ms/min', 'var(--ok)'],
                ['Video BIT', sel.crcBurst ? '2 gaps, 145ms total' : 'clean', sel.crcBurst ? 'var(--warn)' : 'var(--ok)'],
              ].map(([k,v,c]) => (
                <div key={k} style={{ display: 'flex', gap: 8, padding: '2px 0' }}>
                  <span style={{ color: 'var(--fg-3)', minWidth: 110 }}>{k}</span>
                  <span style={{ color: c, fontFamily: 'JetBrains Mono', fontSize: 10 }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="tb-btn primary" onClick={() => onOpenRecording && onOpenRecording(sel)}>Open in Workspace</button>
              <button className="tb-btn">Replay</button>
              <button className="tb-btn">Compare to…</button>
              <button className="tb-btn">Export…</button>
              <button className="tb-btn">Re-run QC</button>
              <button className="tb-btn" style={{ marginLeft: 'auto' }}>Archive</button>
            </div>
          </div>
        )}
      </div>

      {/* bottom bar */}
      <div style={{
        height: 26, borderTop: '1px solid var(--line-1)', background: 'var(--bg-2)',
        display: 'flex', alignItems: 'center', padding: '0 16px', gap: 14,
        fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.8,
      }}>
        <span>{filtered.length} shown · {RECORDINGS.length} total</span>
        <span>·</span>
        <span>storage: <span style={{ color: 'var(--fg-1)' }}>local 87% · archive 42%</span></span>
        <span>·</span>
        <span>sync: <span style={{ color: 'var(--ok)' }}>all in sync</span></span>
        <div style={{ flex: 1 }}/>
        <span>dbl-click to open · Shift+click to multi-select</span>
      </div>
    </div>
  );
}

Object.assign(window, { RecordingLibrary });

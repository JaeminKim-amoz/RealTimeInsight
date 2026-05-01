// Electronic Warfare sheet — 1000+ UAV swarm control, jam zones, RF spectrum

const { useEffect: useEffEW, useRef: useRefEW, useState: useStateEW, useMemo: useMemoEW } = React;

// =========== Mock UAV swarm with formations ===========
function makeSwarm(count, theaterW, theaterH) {
  const list = [];
  // Distribute across 6 squadrons with different missions
  const squads = [
    { id:'ALPHA-RECON', mission:'RECON',     count: Math.floor(count*0.18), color:'#6bb7d9', cx: theaterW*0.22, cy: theaterH*0.30, spread: 90 },
    { id:'BRAVO-EW',    mission:'EW JAM',    count: Math.floor(count*0.22), color:'#7aa874', cx: theaterW*0.40, cy: theaterH*0.45, spread: 110 },
    { id:'CHARLIE-STRK',mission:'STRIKE',    count: Math.floor(count*0.20), color:'#e5a24a', cx: theaterW*0.55, cy: theaterH*0.60, spread: 70 },
    { id:'DELTA-SEAD',  mission:'SEAD',      count: Math.floor(count*0.15), color:'#d8634a', cx: theaterW*0.65, cy: theaterH*0.40, spread: 80 },
    { id:'ECHO-DECOY',  mission:'DECOY',     count: Math.floor(count*0.15), color:'#c78fd1', cx: theaterW*0.30, cy: theaterH*0.65, spread: 100 },
    { id:'FOXTROT-ISR', mission:'ISR LOITER',count: Math.floor(count*0.10), color:'#9bc0d8', cx: theaterW*0.78, cy: theaterH*0.70, spread: 65 },
  ];
  let id = 0;
  squads.forEach(sq => {
    for (let i = 0; i < sq.count; i++) {
      const a = (i / sq.count) * Math.PI * 2 + Math.random()*0.4;
      const r = sq.spread * (0.3 + Math.random() * 0.7);
      list.push({
        id: 'UAV-' + (1000+id).toString(36).toUpperCase(),
        nid: id++,
        squad: sq.id, mission: sq.mission, color: sq.color,
        x: sq.cx + Math.cos(a) * r,
        y: sq.cy + Math.sin(a) * r,
        heading: a + Math.PI/2,
        speed: 0.3 + Math.random() * 0.6,
        battery: 50 + Math.random() * 50,
        link: Math.random() < 0.94 ? 'OK' : (Math.random() < 0.5 ? 'WARN' : 'LOST'),
      });
    }
  });
  return { swarm: list, squads };
}

// =========== EW main sheet ===========
function EwSheet({ active }) {
  const canvasRef = useRefEW(null);
  const [count] = useStateEW(1247);
  const [tick, setTick] = useStateEW(0);
  const [showOrders, setShowOrders] = useStateEW(true);
  const [showJam, setShowJam] = useStateEW(true);
  const [showThreats, setShowThreats] = useStateEW(true);
  const [selectedSquad, setSelectedSquad] = useStateEW(null);
  const [missionFilter, setMissionFilter] = useStateEW('ALL');
  const [trailMode, setTrailMode] = useStateEW(true);

  const theaterW = 1600, theaterH = 900;
  const dataRef = useRefEW(null);
  if (!dataRef.current) dataRef.current = makeSwarm(count, theaterW, theaterH);
  const { swarm, squads } = dataRef.current;

  // Animate swarm — light per-frame motion
  useEffEW(() => {
    if (!active) return;
    let raf;
    const trailCv = document.createElement('canvas');
    trailCv.width = theaterW; trailCv.height = theaterH;
    const trailCtx = trailCv.getContext('2d');

    const tick0 = performance.now();
    const loop = () => {
      const cv = canvasRef.current; if (!cv) return;
      const ctx = cv.getContext('2d');
      const W = cv.width, H = cv.height;
      const sx = W / theaterW, sy = H / theaterH;

      // BG
      ctx.fillStyle = '#0a0d10';
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = '#1c2024';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 40 * sx) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y += 40 * sy) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

      // Coastline silhouette — fake
      ctx.strokeStyle = '#3a4048';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const coast = [[0.0,0.55],[0.05,0.50],[0.1,0.55],[0.18,0.45],[0.25,0.5],[0.32,0.42],[0.4,0.48],[0.5,0.40],[0.6,0.45],[0.7,0.38],[0.78,0.43],[0.85,0.36],[0.92,0.42],[1.0,0.40]];
      coast.forEach(([px,py],i)=>{
        const x = px*W, y = py*H;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.stroke();
      // shaded land
      ctx.fillStyle = 'rgba(58,64,72,0.15)';
      ctx.beginPath();
      coast.forEach(([px,py],i)=>{
        const x = px*W, y = py*H;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
      ctx.fill();

      // === Threat (red) and friendly jam zones ===
      const t = (performance.now() - tick0) / 1000;
      if (showThreats) {
        const threats = [
          { x: 0.72*W, y: 0.30*H, r: 110*sx, label:'SA-21', freq:'S-band' },
          { x: 0.85*W, y: 0.55*H, r: 75*sx,  label:'HQ-9',  freq:'L/S'    },
          { x: 0.55*W, y: 0.18*H, r: 90*sx,  label:'S-400', freq:'X'      },
        ];
        threats.forEach(th => {
          const grd = ctx.createRadialGradient(th.x, th.y, 0, th.x, th.y, th.r);
          grd.addColorStop(0, 'rgba(216,99,74,0.16)');
          grd.addColorStop(0.7, 'rgba(216,99,74,0.08)');
          grd.addColorStop(1, 'rgba(216,99,74,0)');
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(th.x, th.y, th.r, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = 'rgba(216,99,74,0.5)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.arc(th.x, th.y, th.r, 0, Math.PI*2); ctx.stroke();
          ctx.setLineDash([]);
          // pulse
          const pr = th.r * (0.7 + 0.3 * Math.sin(t*2));
          ctx.strokeStyle = 'rgba(216,99,74,0.7)';
          ctx.beginPath(); ctx.arc(th.x, th.y, pr, 0, Math.PI*2); ctx.stroke();
          // label
          ctx.fillStyle = '#d8634a';
          ctx.font = 'bold 11px JetBrains Mono';
          ctx.fillText(th.label, th.x - 18, th.y - th.r - 6);
          ctx.fillStyle = '#878175';
          ctx.font = '9px JetBrains Mono';
          ctx.fillText(th.freq, th.x - 16, th.y - th.r + 6);
        });
      }

      if (showJam) {
        const jammers = [
          { x: 0.30*W, y: 0.55*H, r: 90*sx,  label:'JAM-A1' },
          { x: 0.45*W, y: 0.40*H, r: 70*sx,  label:'JAM-G2' },
          { x: 0.18*W, y: 0.30*H, r: 60*sx,  label:'JAM-N3' },
        ];
        jammers.forEach(j => {
          const grd = ctx.createRadialGradient(j.x, j.y, 0, j.x, j.y, j.r);
          grd.addColorStop(0, 'rgba(122,168,116,0.18)');
          grd.addColorStop(1, 'rgba(122,168,116,0)');
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(j.x, j.y, j.r, 0, Math.PI*2); ctx.fill();
          // sweeping cone
          const sweepA = (t * 0.8 + j.x*0.001) % (Math.PI*2);
          ctx.fillStyle = 'rgba(155, 209, 131, 0.16)';
          ctx.beginPath(); ctx.moveTo(j.x, j.y);
          ctx.arc(j.x, j.y, j.r, sweepA, sweepA + Math.PI/4);
          ctx.closePath(); ctx.fill();

          ctx.strokeStyle = 'rgba(122,168,116,0.45)';
          ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.arc(j.x, j.y, j.r, 0, Math.PI*2); ctx.stroke();

          ctx.fillStyle = '#9bd183';
          ctx.font = 'bold 10px JetBrains Mono';
          ctx.fillText(j.label, j.x + 6, j.y + 4);
        });
      }

      // === Update + draw UAV swarm ===
      // Trail fade
      if (trailMode) {
        ctx.fillStyle = 'rgba(10,13,16,0.25)';
        // we already drew BG; trail just leaves blur
      }

      const filtered = missionFilter === 'ALL' ? swarm : swarm.filter(u => u.mission === missionFilter);
      filtered.forEach(u => {
        // group center attraction + slight orbit motion
        const sq = squads.find(s => s.id === u.squad);
        const dx = sq.cx - u.x, dy = sq.cy - u.y;
        u.heading += 0.005 * Math.sin(t*0.3 + u.nid*0.13);
        u.x += Math.cos(u.heading) * u.speed + dx*0.0008;
        u.y += Math.sin(u.heading) * u.speed + dy*0.0008;

        const sxp = u.x * sx, syp = u.y * sy;
        const isSelected = selectedSquad === u.squad;
        const sz = isSelected ? 2.4 : 1.6;
        ctx.fillStyle = u.link === 'LOST' ? '#5a564d' : (u.link === 'WARN' ? '#e5a24a' : u.color);
        ctx.fillRect(sxp - sz/2, syp - sz/2, sz, sz);
      });

      // Ordering lines (squad → leader → assets)
      if (showOrders) {
        squads.forEach(sq => {
          const ax = sq.cx * sx, ay = sq.cy * sy;
          // line to "command tower" at top center
          ctx.strokeStyle = 'rgba(229,162,74,0.18)';
          ctx.lineWidth = 0.5;
          ctx.setLineDash([3, 5]);
          ctx.beginPath();
          ctx.moveTo(W*0.5, 30);
          ctx.lineTo(ax, ay);
          ctx.stroke();
          ctx.setLineDash([]);
          // squad rally point
          ctx.fillStyle = sq.color;
          ctx.beginPath(); ctx.arc(ax, ay, 4, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = sq.color;
          ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.arc(ax, ay, 8, 0, Math.PI*2); ctx.stroke();
          ctx.fillStyle = '#e8e4dd';
          ctx.font = 'bold 10px JetBrains Mono';
          ctx.fillText(sq.id, ax + 12, ay + 3);
        });

        // Command center
        ctx.fillStyle = '#f0b44a';
        ctx.beginPath();
        ctx.arc(W*0.5, 30, 6, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = '#f0b44a';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(W*0.5, 30, 12 + Math.sin(t*3)*2, 0, Math.PI*2); ctx.stroke();
        ctx.fillStyle = '#0a0d10';
        ctx.font = 'bold 8px JetBrains Mono';
        ctx.fillText('CMD', W*0.5 - 8, 33);
      }

      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [active, showOrders, showJam, showThreats, selectedSquad, missionFilter, trailMode, swarm, squads]);

  // Resize canvas to parent (no devicePixelRatio scaling — matches drawn px)
  useEffEW(() => {
    const cv = canvasRef.current; if (!cv) return;
    const ro = new ResizeObserver(() => {
      const r = cv.parentElement.getBoundingClientRect();
      cv.width = Math.floor(r.width);
      cv.height = Math.floor(r.height);
    });
    ro.observe(cv.parentElement);
    return () => ro.disconnect();
  }, []);

  // Live counts — derived
  const counts = useMemoEW(() => {
    const byMission = {};
    let warn = 0, lost = 0;
    swarm.forEach(u => {
      byMission[u.mission] = (byMission[u.mission] || 0) + 1;
      if (u.link === 'WARN') warn++;
      if (u.link === 'LOST') lost++;
    });
    return { byMission, warn, lost, total: swarm.length };
  }, [swarm, tick]);

  useEffEW(() => {
    const i = setInterval(() => setTick(t => t+1), 1500);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="ew-sheet">
      <div className="ew-toolbar">
        <span className="ew-title">EW THEATER · 1000+ UAV SWARM</span>
        <div className="ew-counts">
          <span><b className="mono">{counts.total}</b> ASSETS</span>
          <span style={{color:'#e5a24a'}}><b className="mono">{counts.warn}</b> WARN</span>
          <span style={{color:'#d8634a'}}><b className="mono">{counts.lost}</b> LOST</span>
        </div>
        <div className="ew-spacer"/>
        <select className="ew-select" value={missionFilter} onChange={e=>setMissionFilter(e.target.value)}>
          <option value="ALL">ALL MISSIONS</option>
          <option value="RECON">RECON</option>
          <option value="EW JAM">EW JAM</option>
          <option value="STRIKE">STRIKE</option>
          <option value="SEAD">SEAD</option>
          <option value="DECOY">DECOY</option>
          <option value="ISR LOITER">ISR LOITER</option>
        </select>
        <button className={`ew-btn ${showOrders?'on':''}`}   onClick={()=>setShowOrders(v=>!v)}>ORDERS</button>
        <button className={`ew-btn ${showJam?'on':''}`}      onClick={()=>setShowJam(v=>!v)}>JAM ZONES</button>
        <button className={`ew-btn ${showThreats?'on':''}`}  onClick={()=>setShowThreats(v=>!v)}>THREATS</button>
        <button className={`ew-btn ${trailMode?'on':''}`}    onClick={()=>setTrailMode(v=>!v)}>TRAILS</button>
      </div>

      <div className="ew-body">
        <div className="ew-theater">
          <canvas ref={canvasRef} className="ew-canvas"/>
          <div className="ew-cmd-tower">
            <div className="hud-label">COMMAND</div>
            <div className="ew-cmd-name">CSG-9 · TOC</div>
            <div className="mono ew-cmd-coord">N 35°43′ · E 142°17′</div>
            <div className="mono ew-cmd-time">UPLINK · {String(tick % 60).padStart(2,'0')}.{String(tick % 1000).padStart(3,'0')}</div>
          </div>
        </div>

        <div className="ew-sidebar">
          <div className="hud-label">SQUADRONS</div>
          {squads.map(sq => (
            <div key={sq.id}
                 className={`ew-squad ${selectedSquad===sq.id?'sel':''}`}
                 onClick={() => setSelectedSquad(s => s === sq.id ? null : sq.id)}>
              <span className="ew-squad-dot" style={{background:sq.color}}/>
              <div className="ew-squad-meta">
                <div className="ew-squad-name">{sq.id}</div>
                <div className="ew-squad-mission mono">{sq.mission} · {sq.count}</div>
              </div>
              <div className="ew-squad-bars">
                <div className="ew-mini-bar"><div style={{width:`${85+Math.sin(tick*0.4 + sq.cx*0.01)*10}%`, background:sq.color}}/></div>
                <div className="ew-squad-stat mono">LINK 98%</div>
              </div>
            </div>
          ))}

          <div className="hud-label" style={{marginTop:14}}>RF SPECTRUM · 1–18 GHz</div>
          <RFSpectrum tick={tick}/>

          <div className="hud-label" style={{marginTop:14}}>LINK BUDGET · BAND ALLOCATION</div>
          <div className="ew-bands">
            {[
              ['L',  '1.5 GHz', 'C2 uplink',     65, '#6bb7d9'],
              ['S',  '2.4 GHz', 'Telemetry',     78, '#8bbf7a'],
              ['C',  '5.8 GHz', 'Video downlink',82, '#e5a24a'],
              ['X',  '10 GHz',  'Datalink',      45, '#c78fd1'],
              ['Ku', '14 GHz',  'Wideband ISR',  91, '#d8634a'],
              ['Ka', '24 GHz',  'Backhaul',      31, '#9bc0d8'],
            ].map(([b, f, role, util, c]) => (
              <div key={b} className="ew-band">
                <span className="ew-band-name mono" style={{color:c}}>{b}</span>
                <span className="ew-band-f mono">{f}</span>
                <div className="ew-band-bar"><div style={{width:`${util}%`, background:c}}/></div>
                <span className="ew-band-role">{role}</span>
                <span className="ew-band-pct mono">{util}%</span>
              </div>
            ))}
          </div>

          <div className="hud-label" style={{marginTop:14}}>EW EFFECT MATRIX</div>
          <div className="ew-matrix">
            <div className="ew-mh"></div>
            <div className="ew-mh">SA-21</div>
            <div className="ew-mh">HQ-9</div>
            <div className="ew-mh">S-400</div>
            {[
              ['BARRAGE', [3, 4, 2]],
              ['SPOT',    [4, 3, 4]],
              ['DECEPT',  [2, 2, 3]],
              ['CHAFF',   [1, 1, 2]],
              ['DRFM',    [4, 4, 4]],
            ].map(([name, vals]) => (
              <React.Fragment key={name}>
                <div className="ew-mh">{name}</div>
                {vals.map((v, i) => (
                  <div key={i} className={`ew-mc lvl-${v}`}>{v}</div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// =========== RF spectrum mini-graph ===========
function RFSpectrum({ tick }) {
  const cvRef = useRefEW(null);
  useEffEW(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = cv.width  = cv.clientWidth  * dpr;
    const H = cv.height = cv.clientHeight * dpr;
    ctx.scale(dpr, dpr);
    const Wd = cv.clientWidth, Hd = cv.clientHeight;
    ctx.fillStyle = '#0a0d10'; ctx.fillRect(0, 0, Wd, Hd);

    // grid
    ctx.strokeStyle = '#1c2024';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 6; i++) {
      const x = (i/5) * Wd;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, Hd); ctx.stroke();
    }
    // baseline noise
    ctx.strokeStyle = '#3a4048';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let x = 0; x < Wd; x++) {
      const noise = Math.sin(x*0.05 + tick*0.1) * 2 + Math.cos(x*0.13)*2.5 + Math.random()*2;
      const y = Hd * 0.85 - noise;
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // emitter peaks
    const peaks = [
      { f: 0.10, h: 0.55, w: 6,  c:'#6bb7d9', label:'C2'  },
      { f: 0.22, h: 0.45, w: 8,  c:'#8bbf7a', label:'TM'  },
      { f: 0.36, h: 0.65, w: 9,  c:'#e5a24a', label:'VIDEO'},
      { f: 0.48, h: 0.70, w: 4,  c:'#d8634a', label:'JAM' },
      { f: 0.58, h: 0.50, w: 7,  c:'#c78fd1', label:'X-DL'},
      { f: 0.72, h: 0.80, w: 3,  c:'#d8634a', label:'SA-21'},
      { f: 0.86, h: 0.40, w: 5,  c:'#9bc0d8', label:'KU'  },
    ];
    peaks.forEach(p => {
      const cx = p.f * Wd;
      const peakH = Hd * p.h * (0.85 + Math.sin(tick*0.3 + p.f*10)*0.08);
      const grd = ctx.createLinearGradient(0, Hd, 0, Hd - peakH);
      grd.addColorStop(0, p.c + '40');
      grd.addColorStop(1, p.c);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(cx - p.w, Hd * 0.85);
      ctx.lineTo(cx, Hd * 0.85 - peakH);
      ctx.lineTo(cx + p.w, Hd * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = p.c;
      ctx.font = '600 8px JetBrains Mono';
      ctx.fillText(p.label, cx - 10, Hd * 0.85 - peakH - 3);
    });

    // freq axis
    ctx.fillStyle = '#878175';
    ctx.font = '7px JetBrains Mono';
    ['1','3','6','10','14','18 GHz'].forEach((l, i) => {
      ctx.fillText(l, (i/5)*Wd + 2, Hd - 2);
    });
  }, [tick]);

  return <canvas ref={cvRef} className="ew-rf-canvas"/>;
}

// =========== Globe sheet wrapper (uses GlobePanel) ===========
function GlobeSheet({ active }) {
  return (
    <div className="globe-sheet">
      <GlobePanel panel={{}} mode="live" fullscreen/>
    </div>
  );
}

// =========== GPS sheet wrapper ===========
function GpsSheet({ active }) {
  return (
    <div className="gps-sheet">
      <div className="gps-sheet-grid">
        <div className="gps-sheet-main">
          <div className="hud-label" style={{padding:'8px 12px', borderBottom:'1px solid var(--line-1)'}}>GNSS LOS · SKYPLOT · LIVE</div>
          <GpsLosPanel panel={{}}/>
        </div>
        <div className="gps-sheet-side">
          <div className="hud-label">RECEIVER STATUS · u-blox ZED-F9P</div>
          <div className="rcv-grid">
            {[
              ['MODE',     'RTK FIX', 'ok'],
              ['LAT',      '37.5125° N', ''],
              ['LON',      '127.0257° E', ''],
              ['ALT',      '83.4 m', ''],
              ['HACC',     '0.014 m', 'ok'],
              ['VACC',     '0.022 m', 'ok'],
              ['HEADING',  '278.4°', ''],
              ['VEL N',    '+0.04 m/s', ''],
              ['VEL E',    '−0.01 m/s', ''],
              ['VEL D',    '+0.00 m/s', ''],
              ['CLK BIAS', '−12.4 ns', ''],
              ['CLK DRIFT','0.07 ns/s', ''],
            ].map(([k, v, s]) => (
              <div key={k} className="rcv-cell">
                <div className="rcv-k">{k}</div>
                <div className={`rcv-v mono ${s}`}>{v}</div>
              </div>
            ))}
          </div>

          <div className="hud-label" style={{marginTop:14}}>이력 · 경고</div>
          <div className="rcv-events">
            {[
              {t:'14:22:08', lvl:'ok',   m:'RTK FIX 획득 — CMR+ corrections from BASE-A1'},
              {t:'14:18:42', lvl:'warn', m:'PDOP 일시 > 2.4 — 고도각 마스크 적용 후 회복'},
              {t:'14:11:30', lvl:'info', m:'GLONASS R22 신호 회복 (멀티패스 해소)'},
              {t:'14:05:02', lvl:'warn', m:'L1 다중 경로 의심 — 빌딩 그림자 진입'},
              {t:'13:58:14', lvl:'ok',   m:'Galileo E36 가시 위성으로 추가 (총 17)'},
            ].map((e,i) => (
              <div key={i} className={`rcv-evt evt-${e.lvl}`}>
                <span className="mono evt-t">{e.t}</span>
                <span className="evt-m">{e.m}</span>
              </div>
            ))}
          </div>

          <div className="hud-label" style={{marginTop:14}}>마스크 · 환경 (수신기 시점)</div>
          <div className="mask-prof">
            <svg viewBox="0 0 360 60" preserveAspectRatio="none" style={{width:'100%',height:80}}>
              <rect x="0" y="0" width="360" height="60" fill="#0a0d10"/>
              {[...Array(8)].map((_,i)=>(
                <line key={i} x1={i*45} y1="0" x2={i*45} y2="60" stroke="#1c2024" strokeWidth="0.5"/>
              ))}
              <path d="M 0,60 L 0,42 L 30,38 L 50,28 L 75,32 L 110,18 L 140,22 L 175,14 L 210,28 L 245,40 L 285,32 L 320,42 L 360,40 L 360,60 Z" fill="rgba(216,99,74,0.18)" stroke="rgba(216,99,74,0.5)" strokeWidth="0.6"/>
              <text x="2" y="58" fill="#878175" fontSize="6" fontFamily="JetBrains Mono">N</text>
              <text x="92" y="58" fill="#878175" fontSize="6" fontFamily="JetBrains Mono">E</text>
              <text x="180" y="58" fill="#878175" fontSize="6" fontFamily="JetBrains Mono">S</text>
              <text x="268" y="58" fill="#878175" fontSize="6" fontFamily="JetBrains Mono">W</text>
              <text x="354" y="58" fill="#878175" fontSize="6" fontFamily="JetBrains Mono">N</text>
              <text x="2" y="8" fill="#5a564d" fontSize="5" fontFamily="JetBrains Mono">90° EL</text>
            </svg>
            <div className="mask-note mono">azimuth × elevation · terrain + structure mask</div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { EwSheet, GlobeSheet, GpsSheet });

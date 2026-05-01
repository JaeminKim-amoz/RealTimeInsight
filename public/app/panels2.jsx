// Map, Video, Attitude3D, Relation Graph, SimDIS bridge panels

// =========== Map panel (MapLibre real tiles) ===========
function MapPanel({ panel, mode }) {
  const mountRef = useRef(null);
  const mapRef = useRef(null);
  const trailRef = useRef([]);
  useBus();

  const [layers, setLayers] = useState({ tracks: true, events: true, aoi: true, sat: true });
  const [style, setStyle] = useState('sat'); // 'sat' | 'dark' | 'topo'

  // initialize map once
  useEffect(() => {
    if (!mountRef.current || !window.maplibregl) return;

    const styles = {
      sat: {
        version: 8,
        sources: {
          sat: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256, attribution: '© Esri World Imagery'
          }
        },
        layers: [{ id: 'sat', type: 'raster', source: 'sat' }]
      },
      dark: {
        version: 8,
        sources: {
          dark: {
            type: 'raster',
            tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
            tileSize: 256, attribution: '© CARTO © OSM'
          }
        },
        layers: [{ id: 'dark', type: 'raster', source: 'dark' }]
      },
      topo: {
        version: 8,
        sources: {
          topo: {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256, attribution: '© Esri Topo'
          }
        },
        layers: [{ id: 'topo', type: 'raster', source: 'topo' }]
      }
    };

    const map = new maplibregl.Map({
      container: mountRef.current,
      style: styles[style],
      center: [127.5432, 36.1234],
      zoom: 9,
      attributionControl: false,
    });
    mapRef.current = { map, styles };

    map.on('load', () => {
      // trail line
      map.addSource('trail', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }}});
      map.addLayer({ id: 'trail-glow', type: 'line', source: 'trail',
        paint: { 'line-color': '#e5a24a', 'line-width': 6, 'line-opacity': 0.25, 'line-blur': 4 }});
      map.addLayer({ id: 'trail-line', type: 'line', source: 'trail',
        paint: { 'line-color': '#f0b44a', 'line-width': 1.8 }});

      // AOI polygon
      map.addSource('aoi', { type: 'geojson', data: {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[
          [127.40, 36.05],[127.68, 36.04],[127.72, 36.24],[127.44, 36.26],[127.40, 36.05]
        ]]}
      }});
      map.addLayer({ id: 'aoi-fill', type: 'fill', source: 'aoi',
        paint: { 'fill-color': '#e5a24a', 'fill-opacity': 0.06 }});
      map.addLayer({ id: 'aoi-line', type: 'line', source: 'aoi',
        paint: { 'line-color': '#e5a24a', 'line-width': 1, 'line-dasharray': [3, 2], 'line-opacity': 0.7 }});

      // event markers
      map.addSource('events', { type: 'geojson', data: { type: 'FeatureCollection', features: [
        { type:'Feature', geometry: { type:'Point', coordinates: [127.49, 36.17] }, properties: { sev:'alarm' } },
        { type:'Feature', geometry: { type:'Point', coordinates: [127.62, 36.08] }, properties: { sev:'warn' } },
        { type:'Feature', geometry: { type:'Point', coordinates: [127.56, 36.21] }, properties: { sev:'info' } },
      ]}});
      map.addLayer({ id: 'events-layer', type: 'circle', source: 'events',
        paint: {
          'circle-radius': 5,
          'circle-color': ['match', ['get','sev'], 'alarm','#d8634a','warn','#e5a24a','info','#6b9bd1','#888'],
          'circle-stroke-color': '#1a1614', 'circle-stroke-width': 1.5,
        }});
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // hot-swap style
  useEffect(() => {
    const ctx = mapRef.current;
    if (!ctx) return;
    ctx.map.setStyle(ctx.styles[style]);
    // re-add sources+layers after style reload
    ctx.map.once('styledata', () => {
      if (!ctx.map.getSource('trail')) {
        ctx.map.addSource('trail', { type:'geojson', data:{ type:'Feature', geometry:{ type:'LineString', coordinates: trailRef.current }}});
        ctx.map.addLayer({ id: 'trail-glow', type: 'line', source: 'trail',
          paint: { 'line-color': '#e5a24a', 'line-width': 6, 'line-opacity': 0.25, 'line-blur': 4 }});
        ctx.map.addLayer({ id: 'trail-line', type: 'line', source: 'trail',
          paint: { 'line-color': '#f0b44a', 'line-width': 1.8 }});
      }
    });
  }, [style]);

  // push GPS samples → trail
  const rev = useBus();
  useEffect(() => {
    const ctx = mapRef.current;
    if (!ctx || !ctx.map.isStyleLoaded()) return;
    const lat = BUS.latest(3501);
    const lon = BUS.latest(3502);
    if (lat == null || lon == null) return;
    const last = trailRef.current[trailRef.current.length - 1];
    if (!last || Math.hypot(last[0]-lon, last[1]-lat) > 0.0008) {
      trailRef.current.push([lon, lat]);
      if (trailRef.current.length > 400) trailRef.current.shift();
      const src = ctx.map.getSource('trail');
      if (src) src.setData({ type:'Feature', geometry:{ type:'LineString', coordinates: trailRef.current }});
    }
  }, [rev]);

  const lat = BUS.latest(3501) ?? 36.1234;
  const lon = BUS.latest(3502) ?? 127.5432;
  const alt = BUS.latest(3503) ?? 3500;
  const hdg = BUS.latest(2212) ?? 0;

  const toggle = (k) => setLayers(l => ({ ...l, [k]: !l[k] }));

  return (
    <div className="map-body" style={{ position: 'relative' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }}/>

      {/* Ownship marker (css-positioned overlay) */}
      <div className="track-marker" style={{
        left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
      }}>
        <div className="chev" style={{ transform: `rotate(${hdg}deg)` }}/>
        <div className="label">OWNSHIP · {(Math.abs(BUS.latest(5001) ?? 0)/120).toFixed(0)}kt · {alt.toFixed(0)}m</div>
      </div>

      <div className="map-layers">
        <div className="ml-hd">Basemap</div>
        <div style={{ display:'flex', gap:4, marginBottom: 6 }}>
          {['sat','dark','topo'].map(s => (
            <button key={s}
              onClick={() => setStyle(s)}
              className={style===s?'on':''}
              style={{
                flex:1, padding:'2px 6px', fontSize:9, textTransform:'uppercase',
                background: style===s ? 'var(--amber-2)' : 'var(--bg-3)',
                color: style===s ? '#1a1614' : 'var(--fg-1)',
                border:'1px solid var(--line-1)', cursor:'pointer',
                fontFamily:'inherit', letterSpacing: 0.5,
              }}>{s}</button>
          ))}
        </div>
        <div className="ml-hd">Layers</div>
        {Object.entries(layers).map(([k,v]) => (
          <label key={k}>
            <input type="checkbox" checked={v} onChange={() => toggle(k)}/>
            <span>{k}</span>
          </label>
        ))}
      </div>

      <div className="map-compass">{Math.abs(hdg).toFixed(0)}°</div>
      <div className="map-scalebar">├──── 2 km ────┤</div>
      <div className="map-coords">
        {lat.toFixed(4)}°N · {lon.toFixed(4)}°E · {alt.toFixed(0)}m
      </div>
    </div>
  );
}

// =========== Video panel ===========
function VideoPanel({ panel, mode }) {
  const t = useTicker(mode === 'live');
  return (
    <div className="video-body">
      <div className="video-placeholder">
        <svg width="60%" height="60%" viewBox="0 0 200 120" style={{ opacity: 0.25 }}>
          <rect x="20" y="30" width="160" height="70" fill="none" stroke="#2a2a2a" strokeWidth="0.5"/>
          <path d="M 50 80 L 80 60 L 110 70 L 140 50 L 170 55" stroke="#3a3a3a" strokeWidth="1" fill="none"/>
          <circle cx="140" cy="50" r="2" fill="#4a4a4a"/>
        </svg>
      </div>
      <div className="video-noise"/>
      <div className="video-crosshair"/>
      <div className="video-hud">
        <div className="h-tl">
          <div className="h-line">CAM · FRONT EO</div>
          <div className="h-line">PID 256 · PROG 1</div>
          <div className="h-line">H.264 · MPEG-TS</div>
        </div>
        <div className="h-tr">
          <div className="h-line">{new Date().toISOString().split('T')[1].slice(0,11)}</div>
          <div className="h-line">T+182.340s</div>
          <div className="h-line">• REC</div>
        </div>
        <div className="h-bl">
          <div className="h-line">LAT  37.512'N</div>
          <div className="h-line">LON 127.041'E</div>
          <div className="h-line">ALT  3250m</div>
        </div>
        <div className="h-br">
          <div className="h-line">HDG 24°</div>
          <div className="h-line">SPD 247kt</div>
          <div className="h-line">ZOOM 2.4x</div>
        </div>
      </div>
      <div className="video-controls">
        <span>◀◀</span><span style={{ color: 'var(--amber-0)' }}>▶</span><span>▶▶</span>
        <div className="scrub">
          <div className="fill" style={{ width: `${((t * 2) % 100)}%` }}/>
          <div className="marker" style={{ left: '72%' }}/>
        </div>
        <span>182.340 / 254.000</span>
      </div>
    </div>
  );
}

// =========== 3D attitude panel — Three.js ===========
function Attitude3DPanel({ panel, mode }) {
  const mountRef = useRef(null);
  const threeRef = useRef(null);
// Same pattern for the attitude3D — drive from telemetry
  const rev = useBus();
  // Live attitude from bus
  const roll  = BUS.latest(2210) ?? 0;
  const pitch = BUS.latest(2211) ?? 0;
  const yaw   = BUS.latest(2212) ?? 0;
  const aoa   = 4.1 + Math.sin(BUS.currentTime * 0.5) * 0.4;
  const nz    = BUS.latest(2215) ?? 1.0;
  const mach  = 0.72;

  // Initialize Three.js scene once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !window.THREE) return;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(4.5, 2, 4.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const keyLight = new THREE.DirectionalLight(0xffd8a0, 1.1);
    keyLight.position.set(5, 6, 3);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x6080a0, 0.5);
    fillLight.position.set(-4, 2, -3);
    scene.add(fillLight);

    // Ground plane (earth) for reference
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40, 20, 20),
      new THREE.MeshBasicMaterial({
        color: 0x2a2420, wireframe: true, transparent: true, opacity: 0.25
      })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2.5;
    scene.add(ground);

    // Cardinal compass ring at horizon
    const ringGeo = new THREE.RingGeometry(3.5, 3.55, 64);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
      color: 0x5a4d3a, side: THREE.DoubleSide, transparent: true, opacity: 0.6
    }));
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);

    // Build aircraft — stylized low-poly fighter, not a cube
    const aircraft = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, metalness: 0.4, roughness: 0.45 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xe5a24a, metalness: 0.6, roughness: 0.3, emissive: 0x3a2810, emissiveIntensity: 0.4 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2420, metalness: 0.2, roughness: 0.7 });

    // Fuselage — elongated capsule-like shape via scaled cylinder + cones
    const fuselage = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.12, 1.8, 12),
      bodyMat
    );
    fuselage.rotation.z = Math.PI / 2;
    aircraft.add(fuselage);

    // Nose cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 12), bodyMat);
    nose.rotation.z = -Math.PI / 2;
    nose.position.x = 1.15;
    aircraft.add(nose);

    // Tail cone
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 12), darkMat);
    tail.rotation.z = Math.PI / 2;
    tail.position.x = -1.02;
    aircraft.add(tail);

    // Canopy
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x1a2838, metalness: 0.8, roughness: 0.15, emissive: 0x1a2838, emissiveIntensity: 0.2 })
    );
    canopy.position.set(0.3, 0.16, 0);
    canopy.scale.set(1.6, 1, 1);
    aircraft.add(canopy);

    // Main wings — delta, slightly swept
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0.3, 0);
    wingShape.lineTo(-0.5, 1.2);
    wingShape.lineTo(-0.7, 1.2);
    wingShape.lineTo(-0.2, 0);
    wingShape.lineTo(0.3, 0);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.04, bevelEnabled: false });
    const wingL = new THREE.Mesh(wingGeo, bodyMat);
    wingL.position.set(0, -0.02, 0);
    wingL.rotation.x = -Math.PI / 2;
    aircraft.add(wingL);
    const wingR = new THREE.Mesh(wingGeo, bodyMat);
    wingR.position.set(0, -0.02, 0);
    wingR.rotation.x = Math.PI / 2;
    aircraft.add(wingR);

    // Vertical tail
    const vtailShape = new THREE.Shape();
    vtailShape.moveTo(-0.9, 0);
    vtailShape.lineTo(-1.1, 0.55);
    vtailShape.lineTo(-0.7, 0.55);
    vtailShape.lineTo(-0.55, 0);
    vtailShape.lineTo(-0.9, 0);
    const vtailGeo = new THREE.ExtrudeGeometry(vtailShape, { depth: 0.03, bevelEnabled: false });
    const vtail = new THREE.Mesh(vtailGeo, bodyMat);
    vtail.position.set(0, 0, -0.015);
    aircraft.add(vtail);

    // Horizontal stabilizers
    const hshape = new THREE.Shape();
    hshape.moveTo(-0.85, 0);
    hshape.lineTo(-1.1, 0.45);
    hshape.lineTo(-0.95, 0.45);
    hshape.lineTo(-0.75, 0);
    hshape.lineTo(-0.85, 0);
    const hgeo = new THREE.ExtrudeGeometry(hshape, { depth: 0.03, bevelEnabled: false });
    const hstabL = new THREE.Mesh(hgeo, bodyMat);
    hstabL.rotation.x = -Math.PI / 2;
    aircraft.add(hstabL);
    const hstabR = new THREE.Mesh(hgeo, bodyMat);
    hstabR.rotation.x = Math.PI / 2;
    aircraft.add(hstabR);

    // Wing tip accent lights (amber)
    [[1.2, 1], [-1.2, 1], [1.2, -1], [-1.2, -1]].forEach(([x, zdir]) => {
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 6, 6),
        accentMat
      );
      light.position.set(x, 0, 0).add(new THREE.Vector3(0, 0, zdir * 0.02));
      // nudge to wingtip
      light.position.x = zdir > 0 ? 0.02 : -0.02;
      light.position.z = zdir > 0 ? 1.18 : -1.18;
      aircraft.add(light);
    });

    // Engine glow
    const engineGlow = new THREE.Mesh(
      new THREE.CircleGeometry(0.1, 16),
      new THREE.MeshBasicMaterial({ color: 0xff7a30, transparent: true, opacity: 0.8 })
    );
    engineGlow.position.set(-1.15, 0, 0);
    engineGlow.rotation.y = -Math.PI / 2;
    aircraft.add(engineGlow);

    scene.add(aircraft);

    // Horizon reference line
    const horizonMat = new THREE.LineBasicMaterial({ color: 0xe5a24a, transparent: true, opacity: 0.25 });
    const horizonPts = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      horizonPts.push(new THREE.Vector3(Math.cos(a) * 3.2, 0, Math.sin(a) * 3.2));
    }
    const horizonGeo = new THREE.BufferGeometry().setFromPoints(horizonPts);
    scene.add(new THREE.Line(horizonGeo, horizonMat));

    threeRef.current = { scene, camera, renderer, aircraft, mount };

    const resize = () => {
      const r = mount.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    let raf;
    const render = () => {
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // Drive aircraft attitude from telemetry
  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx || !ctx.aircraft) return;
    // Aircraft body frame: x=forward, y=up, z=right
    // Apply as intrinsic yaw → pitch → roll
    const DEG = Math.PI / 180;
    ctx.aircraft.rotation.set(0, 0, 0);
    ctx.aircraft.rotateY(-yaw * DEG);
    ctx.aircraft.rotateZ(pitch * DEG);
    ctx.aircraft.rotateX(roll * DEG);
  }, [roll, pitch, yaw]);

  return (
    <div className="attitude-body" style={{ position: 'relative' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }}/>

      {/* HUD reticle overlay */}
      <svg className="adi-hud" viewBox="0 0 300 240" preserveAspectRatio="xMidYMid meet"
           style={{ position: 'absolute', inset: 0, pointerEvents: 'none', width: '100%', height: '100%' }}>
        <g stroke="var(--amber-0)" strokeWidth="1" fill="none" opacity="0.7">
          <line x1="145" y1="120" x2="155" y2="120"/>
          <line x1="150" y1="115" x2="150" y2="125"/>
          <circle cx="150" cy="120" r="40" strokeDasharray="2 4" opacity="0.4"/>
        </g>
        {/* pitch ladder rungs — rotate with roll, slide with pitch */}
        <g transform={`translate(150 120) rotate(${-roll})`} stroke="var(--amber-0)" strokeWidth="0.8" opacity="0.55">
          {[-20,-10,10,20].map(p => {
            const y = -p * 1.8 + pitch * 1.8;
            return (
              <g key={p}>
                <line x1="-28" y1={y} x2="-12" y2={y}/>
                <line x1="12"  y1={y} x2="28"  y2={y}/>
                <text x="30" y={y+3} fontSize="7" fill="var(--amber-0)" fontFamily="JetBrains Mono">{p}</text>
                <text x="-38" y={y+3} fontSize="7" fill="var(--amber-0)" fontFamily="JetBrains Mono">{p}</text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="att-readout">
        <div><span className="label">ROLL </span>{roll.toFixed(1)}°</div>
        <div><span className="label">PITCH</span> {pitch.toFixed(1)}°</div>
        <div><span className="label">YAW  </span>{Math.abs(yaw).toFixed(0)}°</div>
      </div>
      <div className="att-readout" style={{ left: 'auto', right: 8 }}>
        <div><span className="label">MACH</span>   {mach.toFixed(2)}</div>
        <div><span className="label">AoA </span>   {aoa.toFixed(1)}°</div>
        <div><span className="label">Nz  </span>   {nz.toFixed(2)}g</div>
      </div>
    </div>
  );
}

// =========== Relation graph panel ===========
function RelationGraphPanel({ panel, layoutMode, onNodeClick, selectedAnomalyId }) {
  const wrap = useRef(null);
  const [size, setSize] = useState({ w: 400, h: 260 });
  const [expanded, setExpanded] = useState({ 'obs-1205': true });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { nodes, edges } = RELGRAPH;
  const cx = size.w / 2, cy = size.h / 2;

  // Compute positions by layout mode
  const positions = useMemo(() => {
    const pos = {};
    const nonRoot = nodes.filter(n => n.id !== RELGRAPH.root);
    if (layoutMode === 'radial') {
      pos[RELGRAPH.root] = { x: cx, y: cy };
      nonRoot.forEach((n, i) => {
        const a = (i / nonRoot.length) * Math.PI * 2 - Math.PI/2;
        const r = Math.min(size.w, size.h) * 0.36;
        pos[n.id] = { x: cx + Math.cos(a)*r, y: cy + Math.sin(a)*r };
      });
    } else if (layoutMode === 'timeline') {
      // sort by score descending, place on horizontal timeline
      const sorted = [...nodes].sort((a,b)=>(b.score||0)-(a.score||0));
      sorted.forEach((n, i) => {
        pos[n.id] = {
          x: 60 + (i / Math.max(1, sorted.length-1)) * (size.w - 120),
          y: cy + (i % 2 === 0 ? -30 : 30) + Math.sin(i * 1.3) * 20,
        };
      });
    } else {
      // force-ish: observation centered, others distributed by weight
      pos[RELGRAPH.root] = { x: cx, y: cy };
      const angles = {};
      nonRoot.forEach((n, i) => {
        const a = (i * 2.4) + 0.5;
        const edge = edges.find(e => (e.s === RELGRAPH.root && e.t === n.id) || (e.t === RELGRAPH.root && e.s === n.id));
        const w = edge ? edge.w : 0.3;
        const r = 60 + (1.0 - w) * (Math.min(size.w, size.h) * 0.35);
        pos[n.id] = { x: cx + Math.cos(a)*r, y: cy + Math.sin(a)*r };
      });
    }
    return pos;
  }, [layoutMode, size.w, size.h, nodes, edges]);

  const nodeColor = (kind) => ({
    observation: 'var(--amber-0)',
    channel: 'var(--s2)',
    alarm: 'var(--alarm)',
    'crc-cluster': 'var(--warn)',
    'video-event': 'var(--s5)',
    recommendation: 'var(--pinned)',
  }[kind] || 'var(--fg-1)');

  const edgeStyle = (e) => ({
    strokeDasharray: e.verified ? 'none' : '3,2',
    strokeOpacity: Math.max(0.25, e.w),
    strokeWidth: 0.8 + e.w * 1.8,
  });

  return (
    <div className="relgraph-body" ref={wrap}>
      <svg className="relgraph-svg" viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none">
        {/* Edges */}
        {edges.map((e, i) => {
          const a = positions[e.s], b = positions[e.t];
          if (!a || !b) return null;
          return (
            <g key={i}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    stroke="var(--amber-1)" {...edgeStyle(e)}/>
              <text x={(a.x+b.x)/2} y={(a.y+b.y)/2 - 2}
                    fontSize="8" fill="var(--fg-2)" fontFamily="JetBrains Mono"
                    textAnchor="middle">
                {e.why}
              </text>
            </g>
          );
        })}
        {/* Nodes */}
        {nodes.map((n) => {
          const p = positions[n.id];
          if (!p) return null;
          const isRoot = n.id === RELGRAPH.root;
          const r = isRoot ? 10 : 7;
          return (
            <g key={n.id} onClick={() => onNodeClick?.(n)} style={{ cursor: 'pointer' }}>
              <circle cx={p.x} cy={p.y} r={r+4}
                      fill={nodeColor(n.kind)} opacity={isRoot ? 0.25 : 0.15}/>
              <circle cx={p.x} cy={p.y} r={r}
                      fill="var(--bg-1)" stroke={nodeColor(n.kind)}
                      strokeWidth={isRoot ? 2 : 1.5}/>
              <text x={p.x} y={p.y + r + 11}
                    fontSize="10" fill="var(--fg-0)"
                    textAnchor="middle" fontFamily="IBM Plex Sans">
                {n.label}
              </text>
              {n.score != null && (
                <text x={p.x} y={p.y + r + 22}
                      fontSize="8.5" fill="var(--amber-0)"
                      textAnchor="middle" fontFamily="JetBrains Mono">
                  {(n.score * 100).toFixed(0)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="relgraph-legend">
        <div className="ln"><span className="edge-s" style={{ background:'var(--amber-1)' }}/> verified</div>
        <div className="ln"><span className="edge-s" style={{ borderTop: '1px dashed var(--amber-1)', height: 0 }}/> inferred</div>
      </div>
    </div>
  );
}

// =========== SimDIS bridge panel ===========
function SimdisBridgePanel({ panel }) {
  const [connected, setConnected] = useState(true);
  const tracks = [
    { id: 'OWNSHIP', name: 'Ownship T-50',    lat: 37.512, lon: 127.041, synced: true  },
    { id: 'TGT-07',  name: 'Target Drone',    lat: 37.531, lon: 127.082, synced: true  },
    { id: 'BLUE-02', name: 'Wingman F-16',    lat: 37.491, lon: 127.012, synced: false },
    { id: 'AWACS-1', name: 'E-737 Peace Eye', lat: 37.601, lon: 127.201, synced: false },
  ];
  return (
    <div className="simdis-body">
      <div className="simdis-status">
        <div className="sitem">
          <div className="slabel">Bridge State</div>
          <div className="sval">
            <span className={`led ${connected?'ok':'alarm'}`} style={{ marginRight:6, display:'inline-block', width:6, height:6, borderRadius:'50%' }}/>
            {connected ? 'CONNECTED' : 'DISCONNECTED'}
          </div>
        </div>
        <div className="sitem">
          <div className="slabel">Mode</div>
          <div className="sval">FILE-REPLAY</div>
        </div>
        <div className="sitem">
          <div className="slabel">Scenario</div>
          <div className="sval">lab-kadena-01.asi</div>
        </div>
        <div className="sitem">
          <div className="slabel">Time Sync</div>
          <div className="sval">locked · T+182.340</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
        <button className="tb-btn" style={{ flex: 1 }} onClick={() => setConnected(!connected)}>
          {connected ? 'Disconnect' : 'Connect'}
        </button>
        <button className="tb-btn" style={{ flex: 1 }}>Open in SimDIS</button>
        <button className="tb-btn" style={{ flex: 1 }}>Push Cursor</button>
      </div>
      <div style={{ fontSize: 9.5, color: 'var(--fg-3)', textTransform:'uppercase', letterSpacing: 1, margin: '6px 0 4px' }}>Track Sync</div>
      <table className="simdis-table">
        <thead><tr><th>ID</th><th>Name</th><th>Lat/Lon</th><th>Sync</th></tr></thead>
        <tbody>
          {tracks.map(t => (
            <tr key={t.id} className={t.synced ? 'on' : ''}>
              <td>{t.id}</td>
              <td>{t.name}</td>
              <td>{t.lat.toFixed(3)}, {t.lon.toFixed(3)}</td>
              <td>{t.synced ? '●' : '○'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

Object.assign(window, { MapPanel, VideoPanel, Attitude3DPanel, RelationGraphPanel, SimdisBridgePanel });

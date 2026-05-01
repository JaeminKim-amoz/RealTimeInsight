// Space sheet — 3D globe with satellites, threat domes, terrain on zoom

const { useEffect, useRef, useState, useMemo } = React;

// =========== Mock orbit / threat / sat data ===========
const SATELLITES = [
  // [name, classification, altitude_km, inclination_deg, raan_deg, hue_color]
  { id:'GPS-IIF-7',  cls:'GNSS',   alt:20180, inc: 55, raan:  10, color:0x6bb7d9, period: 718 },
  { id:'GPS-IIIA-3', cls:'GNSS',   alt:20180, inc: 55, raan:  72, color:0x6bb7d9, period: 718 },
  { id:'GPS-IIIA-5', cls:'GNSS',   alt:20180, inc: 55, raan: 144, color:0x6bb7d9, period: 718 },
  { id:'GLO-K2-12',  cls:'GNSS',   alt:19130, inc: 64, raan: 198, color:0x8bbf7a, period: 676 },
  { id:'GAL-FOC-22', cls:'GNSS',   alt:23222, inc: 56, raan: 252, color:0xe5a24a, period: 845 },
  { id:'IRIDIUM-115',cls:'COMM',   alt: 781, inc: 86, raan:  20, color:0xc78fd1, period: 100 },
  { id:'IRIDIUM-167',cls:'COMM',   alt: 781, inc: 86, raan:  92, color:0xc78fd1, period: 100 },
  { id:'STARLINK-3221',cls:'COMM', alt: 550, inc: 53, raan: 130, color:0x9ec5e8, period:  95 },
  { id:'STARLINK-4090',cls:'COMM', alt: 550, inc: 53, raan: 175, color:0x9ec5e8, period:  95 },
  { id:'STARLINK-4622',cls:'COMM', alt: 550, inc: 53, raan: 220, color:0x9ec5e8, period:  95 },
  { id:'KH-11-USA-290', cls:'EO',  alt: 264, inc: 97, raan: 318, color:0xf0b44a, period:  90 },
  { id:'LACROSSE-5', cls:'SAR',    alt: 718, inc: 57, raan:  45, color:0xf0b44a, period:  99 },
  { id:'TES-3',      cls:'EO',     alt: 605, inc: 97, raan: 280, color:0xf0b44a, period:  97 },
  { id:'INMARSAT-5', cls:'GEO',    alt:35786, inc:  0, raan:  64, color:0xd8634a, period:1436 },
  { id:'KOREASAT-6', cls:'GEO',    alt:35786, inc:  0, raan: 116, color:0xd8634a, period:1436 },
  { id:'GOES-18',    cls:'WX',     alt:35786, inc:  0, raan: 222, color:0x6bb7d9, period:1436 },
  { id:'TIANGONG',   cls:'CREW',   alt: 389, inc: 41, raan:  65, color:0xff7a30, period:  92 },
  { id:'ISS',        cls:'CREW',   alt: 410, inc: 51, raan: 158, color:0xffd166, period:  93 },
];

// Threat sites — surface lat/lon + RF detection radius (km) + frequency band
const THREAT_SITES = [
  { id:'SA-21-K1', name:'SA-21 Growler · Kaliningrad',     lat: 54.7, lon: 20.5,  range_km: 400, freq:'S-band 2.5–3.0 GHz', threat:'high', count: 4 },
  { id:'SA-20-MR', name:'SA-20 Gargoyle · Moscow ring',    lat: 55.7, lon: 37.6,  range_km: 200, freq:'C/X-band',          threat:'high', count: 8 },
  { id:'HQ-9-SH',  name:'HQ-9 · East China',               lat: 31.2, lon:121.5,  range_km: 250, freq:'L/S-band',          threat:'high', count: 6 },
  { id:'HQ-22-PY', name:'HQ-22 · Pyongyang sector',        lat: 39.0, lon:125.7,  range_km: 170, freq:'X-band',            threat:'medium', count: 3 },
  { id:'S-300-CR', name:'S-300 · Crimea',                  lat: 45.0, lon: 34.1,  range_km: 195, freq:'S-band',            threat:'medium', count: 2 },
  { id:'S-400-SY', name:'S-400 · Latakia',                 lat: 35.5, lon: 35.7,  range_km: 380, freq:'X/S-band',          threat:'high', count: 2 },
  { id:'BAVAR-IR', name:'Bavar-373 · Bandar Abbas',        lat: 27.2, lon: 56.3,  range_km: 200, freq:'S-band 3.1 GHz',    threat:'medium', count: 3 },
];

// Friendly EW assets (jam emitters)
const FRIENDLY_EW = [
  { id:'JAM-A1', name:'Aegis EW · CSG-9',     lat: 36.0, lon: 142.0, range_km: 280, freq:'L–Ku',   color: '#7aa874' },
  { id:'JAM-G2', name:'EA-18G Growler RZN-1', lat: 50.5, lon: 30.8,  range_km: 150, freq:'C–X',    color: '#7aa874' },
];

// Convert lat/lon (deg) + radius scalar to 3D position on unit sphere
function llToVec3(lat, lon, r=1) {
  const phi   = (90 - lat) * Math.PI/180;
  const theta = (lon + 180) * Math.PI/180;
  return [
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta),
  ];
}

// =========== Main globe panel — Three.js ===========
function GlobePanel({ panel, mode, fullscreen }) {
  const mountRef = useRef(null);
  const threeRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [showTexture, setShowTexture] = useState(true);
  const [showWire, setShowWire] = useState(false);
  const [showAtmo, setShowAtmo] = useState(true);
  const [showStars, setShowStars] = useState(true);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showThreats, setShowThreats] = useState(true);
  const [showFriendly, setShowFriendly] = useState(true);
  const [showTerrain, setShowTerrain] = useState(true);
  const [autoSpin, setAutoSpin] = useState(true);
  const [zoom, setZoom] = useState(2.6);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !window.THREE) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070b);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
    camera.position.set(0, 0.4, zoom);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    // Lights — sun + ambient
    const sun = new THREE.DirectionalLight(0xfff4dd, 1.5);
    sun.position.set(5, 1.5, 3);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0x4a5060, 0.4));

    // ====== Procedural Earth texture (used as fallback while image loads) ======
    const earthTex = makeEarthTexture(2048, 1024);
    const earthBumpTex = makeEarthBumpTexture(1024, 512);

    const earthGeo = new THREE.SphereGeometry(1, 96, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTex,
      bumpMap: earthBumpTex,
      bumpScale: 0.02,
      roughness: 0.85,
      metalness: 0.05,
      emissive: 0x0a1224,
      emissiveIntensity: 0.18,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earth);

    // Try loading high-res Blue Marble texture in background; replace if it loads
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    [
      'https://unpkg.com/three-globe@2.31.1/example/img/earth-night.jpg',
      'https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg',
    ].forEach((url, idx) => {
      loader.load(url, (tex) => {
        if (idx === 1) {
          // day texture preferred
          tex.colorSpace = THREE.SRGBColorSpace || tex.colorSpace;
          earth.material.map = tex;
          earth.material.needsUpdate = true;
        }
      }, undefined, () => {});
    });
    // Optional bump
    loader.load('https://unpkg.com/three-globe@2.31.1/example/img/earth-topology.png',
      (tex) => { earth.material.bumpMap = tex; earth.material.needsUpdate = true; },
      undefined, () => {});

    // Wireframe overlay
    const wireGeo = new THREE.SphereGeometry(1.001, 36, 24);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x4a6080, wireframe: true, transparent: true, opacity: 0.15 });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.visible = false;
    scene.add(wire);

    // Atmosphere glow — backside larger sphere with gradient shader-ish
    const atmoGeo = new THREE.SphereGeometry(1.06, 64, 32);
    const atmoMat = new THREE.ShaderMaterial({
      uniforms: { c: { value: 0.7 }, p: { value: 4.5 }, glowColor: { value: new THREE.Color(0x4a8fcf) } },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform vec3 glowColor;
        uniform float c;
        uniform float p;
        void main() {
          float intensity = pow(c - dot(vNormal, vec3(0.0, 0.0, 1.0)), p);
          gl_FragColor = vec4(glowColor, 1.0) * intensity;
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
    });
    const atmo = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmo);

    // ====== Stars ======
    const starGeo = new THREE.BufferGeometry();
    const starCount = 2400;
    const starPos = new Float32Array(starCount * 3);
    const starSize = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      // sphere shell
      const u = Math.random(), v = Math.random();
      const th = 2 * Math.PI * u, ph = Math.acos(2*v - 1);
      const r = 60 + Math.random() * 30;
      starPos[i*3]   = r * Math.sin(ph) * Math.cos(th);
      starPos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
      starPos[i*3+2] = r * Math.cos(ph);
      starSize[i] = Math.random() < 0.06 ? 2.4 : (Math.random() < 0.3 ? 1.6 : 0.9);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('size',     new THREE.BufferAttribute(starSize, 1));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, sizeAttenuation: true, transparent: true, opacity: 0.85 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // ====== Orbit rings + satellite markers ======
    const orbitGroup = new THREE.Group();
    const satGroup = new THREE.Group();
    scene.add(orbitGroup);
    scene.add(satGroup);

    const earthRadiusKm = 6371;
    const sats = SATELLITES.map((s, idx) => {
      const r = 1 + s.alt / earthRadiusKm * 0.9; // visual scale
      const inc = s.inc * Math.PI / 180;
      const raan = s.raan * Math.PI / 180;

      // Orbit ring
      const pts = [];
      for (let i = 0; i <= 96; i++) {
        const t = (i/96) * Math.PI * 2;
        // Orbit in its own plane
        let x = Math.cos(t) * r;
        let y = Math.sin(t) * r;
        let z = 0;
        // Inclination rotation around X
        const yi = y * Math.cos(inc) - z * Math.sin(inc);
        const zi = y * Math.sin(inc) + z * Math.cos(inc);
        // RAAN rotation around Y
        const xr = x * Math.cos(raan) + zi * Math.sin(raan);
        const zr = -x * Math.sin(raan) + zi * Math.cos(raan);
        pts.push(new THREE.Vector3(xr, yi, zr));
      }
      const ringGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const ringMat = new THREE.LineBasicMaterial({ color: s.color, transparent: true, opacity: 0.35 });
      const ring = new THREE.Line(ringGeo, ringMat);
      orbitGroup.add(ring);

      // Satellite marker
      const satMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 6),
        new THREE.MeshBasicMaterial({ color: s.color })
      );
      // Glow halo
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 8, 6),
        new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.25 })
      );
      satMesh.add(halo);
      satGroup.add(satMesh);

      return { ...s, r, inc, raan, mesh: satMesh, phase: Math.random() * Math.PI * 2 };
    });

    // ====== Threat domes ======
    const threatGroup = new THREE.Group();
    scene.add(threatGroup);
    THREAT_SITES.forEach(site => {
      const [x, y, z] = llToVec3(site.lat, site.lon, 1);
      const radiusOnSphere = site.range_km / 6371; // arc-length on unit sphere

      // Hemisphere (dome) at site, pointing outward
      const domeGeo = new THREE.SphereGeometry(radiusOnSphere, 32, 16, 0, Math.PI*2, 0, Math.PI/2);
      const baseColor = site.threat === 'high' ? 0xd8634a : 0xe5a24a;
      const domeMat = new THREE.MeshBasicMaterial({
        color: baseColor, transparent: true, opacity: 0.18,
        side: THREE.DoubleSide, depthWrite: false,
      });
      const dome = new THREE.Mesh(domeGeo, domeMat);
      // place at surface, orient outward
      const surface = new THREE.Vector3(x, y, z);
      dome.position.copy(surface);
      dome.lookAt(surface.clone().multiplyScalar(2));
      // Default sphere "up" (Y) needs to align to outward normal — rotate -90° X
      dome.rotateX(Math.PI/2);
      threatGroup.add(dome);

      // Wireframe outline of dome
      const wireD = new THREE.Mesh(
        new THREE.SphereGeometry(radiusOnSphere * 1.001, 24, 12, 0, Math.PI*2, 0, Math.PI/2),
        new THREE.MeshBasicMaterial({ color: baseColor, wireframe: true, transparent: true, opacity: 0.45, depthWrite: false })
      );
      wireD.position.copy(surface);
      wireD.lookAt(surface.clone().multiplyScalar(2));
      wireD.rotateX(Math.PI/2);
      threatGroup.add(wireD);

      // Site marker — pulsing point
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff5040 })
      );
      marker.position.copy(surface).multiplyScalar(1.005);
      threatGroup.add(marker);
    });

    // Friendly EW emitters (green domes)
    const friendlyGroup = new THREE.Group();
    scene.add(friendlyGroup);
    FRIENDLY_EW.forEach(site => {
      const [x, y, z] = llToVec3(site.lat, site.lon, 1);
      const r = site.range_km / 6371;
      const domeGeo = new THREE.SphereGeometry(r, 24, 12, 0, Math.PI*2, 0, Math.PI/2);
      const dome = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({
        color: 0x7aa874, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false,
      }));
      const surface = new THREE.Vector3(x, y, z);
      dome.position.copy(surface);
      dome.lookAt(surface.clone().multiplyScalar(2));
      dome.rotateX(Math.PI/2);
      friendlyGroup.add(dome);

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x9bd183 })
      );
      marker.position.copy(surface).multiplyScalar(1.005);
      friendlyGroup.add(marker);
    });

    threeRef.current = { scene, camera, renderer, mount, earth, wire, atmo, stars,
                         orbitGroup, satGroup, threatGroup, friendlyGroup, sats };

    // ===== Resize observer =====
    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w/h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();

    // ===== Mouse: drag rotate, wheel zoom =====
    const state = { dragging: false, lx: 0, ly: 0, ry: 0, rx: 0.2 };
    const onDown = (e) => { state.dragging = true; state.lx = e.clientX; state.ly = e.clientY; };
    const onUp = () => { state.dragging = false; };
    const onMove = (e) => {
      if (!state.dragging) return;
      state.ry += (e.clientX - state.lx) * 0.005;
      state.rx += (e.clientY - state.ly) * 0.005;
      state.rx = Math.max(-1.2, Math.min(1.2, state.rx));
      state.lx = e.clientX; state.ly = e.clientY;
    };
    const onWheel = (e) => {
      e.preventDefault();
      const z = camera.position.z + e.deltaY * 0.002;
      camera.position.z = Math.max(1.15, Math.min(6, z));
      setZoom(camera.position.z);
    };
    renderer.domElement.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // ===== Animate =====
    let raf, t0 = performance.now();
    const animate = () => {
      const now = performance.now();
      const dt = (now - t0) / 1000;
      t0 = now;

      const r = threeRef.current;
      if (autoSpin && !state.dragging) state.ry += dt * 0.05;

      r.earth.rotation.y    = state.ry;
      r.wire.rotation.y     = state.ry;
      r.orbitGroup.rotation.y  = state.ry;
      r.satGroup.rotation.y    = state.ry;
      r.threatGroup.rotation.y = state.ry;
      r.friendlyGroup.rotation.y = state.ry;
      r.earth.rotation.x = state.rx;
      r.wire.rotation.x = state.rx;
      r.orbitGroup.rotation.x = state.rx;
      r.satGroup.rotation.x = state.rx;
      r.threatGroup.rotation.x = state.rx;
      r.friendlyGroup.rotation.x = state.rx;

      // animate satellites along orbits
      r.sats.forEach(s => {
        s.phase += dt * (2 * Math.PI / s.period) * 30; // ~30x time
        const t = s.phase;
        let x = Math.cos(t) * s.r;
        let y = Math.sin(t) * s.r;
        let z = 0;
        const yi = y * Math.cos(s.inc) - z * Math.sin(s.inc);
        const zi = y * Math.sin(s.inc) + z * Math.cos(s.inc);
        const xr = x * Math.cos(s.raan) + zi * Math.sin(s.raan);
        const zr = -x * Math.sin(s.raan) + zi * Math.cos(s.raan);
        s.mesh.position.set(xr, yi, zr);
      });

      // pulse stars
      r.stars.material.opacity = 0.7 + Math.sin(now * 0.001) * 0.1;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('mousedown', onDown);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
      try { mount.removeChild(renderer.domElement); } catch (e) {}
      renderer.dispose();
    };
  }, []);

  // Apply layer toggles
  useEffect(() => {
    const r = threeRef.current; if (!r) return;
    r.earth.visible = showTexture;
    r.wire.visible = showWire;
    r.atmo.visible = showAtmo;
    r.stars.visible = showStars;
    r.orbitGroup.visible = showOrbits;
    r.satGroup.visible = showOrbits;
    r.threatGroup.visible = showThreats;
    r.friendlyGroup.visible = showFriendly;
    // Terrain bump scaling — boost when zoomed in
    if (r.earth.material.bumpScale !== undefined) {
      r.earth.material.bumpScale = showTerrain ? Math.max(0.02, (3 - zoom) * 0.06) : 0;
      r.earth.material.needsUpdate = true;
    }
  }, [showTexture, showWire, showAtmo, showStars, showOrbits, showThreats, showFriendly, showTerrain, zoom]);

  return (
    <div className="globe-wrap">
      <div className="globe-canvas" ref={mountRef}/>

      {/* HUD overlays */}
      <div className="globe-hud globe-hud-tl">
        <div className="hud-label">SPACE · ORBITAL VIEW</div>
        <div className="hud-row mono">SATS · {SATELLITES.length}</div>
        <div className="hud-row mono">THREAT SITES · <span style={{color:'#d8634a'}}>{THREAT_SITES.length}</span></div>
        <div className="hud-row mono">FRIENDLY EW · <span style={{color:'#9bd183'}}>{FRIENDLY_EW.length}</span></div>
        <div className="hud-row mono">ZOOM · {zoom.toFixed(2)}× · ALT {((zoom-1)*6371).toFixed(0)} km</div>
      </div>

      <div className="globe-hud globe-hud-tr">
        <div className="hud-label">LAYERS</div>
        {[
          ['지구 텍스처',   showTexture, setShowTexture],
          ['와이어프레임',   showWire,    setShowWire],
          ['대기 글로우',   showAtmo,    setShowAtmo],
          ['별 배경',      showStars,   setShowStars],
          ['궤도 + 위성',   showOrbits,  setShowOrbits],
          ['적 위협 반구',   showThreats, setShowThreats],
          ['우군 EW',     showFriendly,setShowFriendly],
          ['Terrain 음영', showTerrain, setShowTerrain],
          ['자동 회전',    autoSpin,    setAutoSpin],
        ].map(([label, v, set]) => (
          <label key={label} className="hud-toggle">
            <input type="checkbox" checked={v} onChange={e => set(e.target.checked)}/>
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="globe-hud globe-hud-bl">
        <div className="hud-label">위성 · LIVE</div>
        <div className="sat-table">
          {SATELLITES.slice(0, 8).map(s => (
            <div key={s.id} className="sat-row">
              <span className="sat-dot" style={{background:`#${s.color.toString(16).padStart(6,'0')}`}}/>
              <span className="sat-id">{s.id}</span>
              <span className="sat-cls">{s.cls}</span>
              <span className="sat-alt mono">{s.alt.toLocaleString()}km</span>
            </div>
          ))}
          <div className="sat-more">+ {SATELLITES.length - 8} more</div>
        </div>
      </div>

      <div className="globe-hud globe-hud-br">
        <div className="hud-label">THREAT REGISTRY</div>
        {THREAT_SITES.map(t => (
          <div key={t.id} className="threat-row">
            <span className={`threat-dot tier-${t.threat}`}/>
            <div className="threat-meta">
              <div className="threat-name">{t.name}</div>
              <div className="threat-sub mono">{t.freq} · {t.range_km}km · ×{t.count}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="globe-credits mono">
        DRAG · 회전 · WHEEL · 줌 · {showTerrain ? 'TERRAIN ON ZOOM' : 'TERRAIN OFF'}
      </div>
    </div>
  );
}

// =========== Procedural earth & bump textures ===========
// Simple but effective continent silhouette by sampling coarse mask + ocean shading
function makeEarthTexture(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  // ocean — flat deep blue
  ctx.fillStyle = '#0c1a2e';
  ctx.fillRect(0, 0, w, h);
  // subtle lat shading
  for (let y = 0; y < h; y += 2) {
    const lat = (0.5 - y/h) * 180;
    const a = 0.05 * Math.cos(lat * Math.PI/180);
    ctx.fillStyle = `rgba(20, 50, 90, ${a})`;
    ctx.fillRect(0, y, w, 2);
  }

  // Ice caps
  ctx.fillStyle = '#c4d2dc';
  ctx.fillRect(0, 0, w, h*0.045);
  ctx.fillRect(0, h*0.955, w, h*0.045);
  ctx.fillStyle = '#a8b8c4';
  ctx.fillRect(0, h*0.045, w, h*0.015);
  ctx.fillRect(0, h*0.94, w, h*0.015);

  // Continent blobs — defined as ellipse meta-balls in equirectangular
  const continents = [
    // North America
    { lon:-100, lat: 50, lr: 35, ar: 22 },
    { lon: -95, lat: 30, lr: 18, ar: 14 },
    { lon: -75, lat: 18, lr: 12, ar: 8 },
    // South America
    { lon: -65, lat:-15, lr: 16, ar: 18 },
    { lon: -68, lat:-35, lr: 9,  ar: 14 },
    // Europe
    { lon:  10, lat: 52, lr: 22, ar: 12 },
    { lon:  25, lat: 45, lr: 14, ar: 9 },
    // Africa
    { lon:  18, lat: 12, lr: 18, ar: 14 },
    { lon:  25, lat:-10, lr: 18, ar: 18 },
    { lon:  28, lat:-28, lr: 14, ar: 8 },
    // Middle East / India
    { lon:  45, lat: 25, lr: 12, ar: 10 },
    { lon:  78, lat: 22, lr: 11, ar: 12 },
    // Asia
    { lon:  85, lat: 55, lr: 50, ar: 18 },
    { lon: 105, lat: 35, lr: 25, ar: 14 },
    { lon: 130, lat: 50, lr: 20, ar: 14 },
    { lon: 135, lat: 35, lr: 12, ar: 10 },
    // SE Asia
    { lon: 110, lat:  5, lr: 14, ar: 8 },
    // Australia
    { lon: 135, lat:-25, lr: 22, ar: 12 },
    // Greenland
    { lon: -40, lat: 72, lr: 18, ar: 10 },
  ];

  const landColor = '#3a4a2e';
  const landDark  = '#2a3820';

  continents.forEach(c => {
    const cx = ((c.lon + 180) / 360) * w;
    const cy = ((90 - c.lat) / 180) * h;
    const rx = (c.lr / 360) * w;
    const ry = (c.ar / 180) * h;

    // ragged perimeter — many overlapping circles + base ellipse
    ctx.fillStyle = landColor;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2);
    ctx.fill();

    // ragged edge bumps (more controlled — same color, smaller, hugging perimeter)
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2 + (Math.random()-0.5)*0.3;
      const d = 0.7 + Math.random()*0.5;
      const px = cx + Math.cos(a) * rx * d;
      const py = cy + Math.sin(a) * ry * d;
      const pr = 3 + Math.random() * 7;
      ctx.fillStyle = Math.random() < 0.3 ? landDark : landColor;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI*2); ctx.fill();
    }
    // interior darker patches (forests/highlands)
    for (let i = 0; i < 20; i++) {
      const a = Math.random()*Math.PI*2;
      const d = Math.random()*0.7;
      const px = cx + Math.cos(a)*rx*d;
      const py = cy + Math.sin(a)*ry*d;
      ctx.fillStyle = 'rgba(34, 56, 28, 0.6)';
      ctx.beginPath(); ctx.arc(px, py, 4 + Math.random()*8, 0, Math.PI*2); ctx.fill();
    }
    // desert tint patches in hot latitudes
    if (Math.abs(c.lat) < 35) {
      for (let i = 0; i < 12; i++) {
        const a = Math.random()*Math.PI*2;
        const d = Math.random()*0.6;
        const px = cx + Math.cos(a)*rx*d;
        const py = cy + Math.sin(a)*ry*d;
        ctx.fillStyle = 'rgba(140, 110, 60, 0.35)';
        ctx.beginPath(); ctx.arc(px, py, 3 + Math.random()*7, 0, Math.PI*2); ctx.fill();
      }
    }
  });

  // City lights — sparse warm dots on continents
  ctx.fillStyle = 'rgba(255, 220, 140, 0.18)';
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * w;
    const y = h*0.18 + Math.random() * h*0.55;
    ctx.fillRect(x, y, 1, 1);
  }

  // Very faint cloud wisps
  ctx.globalAlpha = 0.04;
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 8 + Math.random() * 24;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace || tex.colorSpace;
  return tex;
}

function makeEarthBumpTexture(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  // Mountain ranges as bright streaks
  const ranges = [
    // [startLon, startLat, endLon, endLat, intensity]
    [-130, 60, -110, 30, 0.6],   // Rockies
    [-75, 10, -70, -45, 0.7],    // Andes
    [ 30, 35,  60, 30, 0.4],     // Caucasus/Zagros
    [ 70, 38,  95, 30, 0.9],     // Himalayas
    [100, 45, 130, 30, 0.5],     // China interior
    [ 25, 46,  10, 43, 0.4],     // Alps
    [140,-40, 145,-32, 0.3],     // Aus dividing
    [ 35, -5,  37,-15, 0.4],     // E. Africa rift
  ];
  ranges.forEach(([lon0, lat0, lon1, lat1, k]) => {
    const x0 = ((lon0+180)/360)*w, y0 = ((90-lat0)/180)*h;
    const x1 = ((lon1+180)/360)*w, y1 = ((90-lat1)/180)*h;
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i/steps;
      const x = x0 + (x1-x0)*t + (Math.random()-0.5)*20;
      const y = y0 + (y1-y0)*t + (Math.random()-0.5)*15;
      const r = 8 + Math.random() * 14;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(255,255,255,${k})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    }
  });
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}

// =========== GPS LOS / DOP panel ===========
function GpsLosPanel({ panel }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick(t => t+1), 1000);
    return () => clearInterval(i);
  }, []);

  // Compute live skyplot — simulate visible GNSS sats
  const sats = useMemo(() => {
    const list = [];
    const consts = [
      { sys:'GPS',  prn: ['G02','G05','G07','G12','G15','G24','G29','G31'], col:'#6bb7d9' },
      { sys:'GLO',  prn: ['R03','R09','R14','R22'],                          col:'#8bbf7a' },
      { sys:'GAL',  prn: ['E11','E19','E24','E30','E36'],                    col:'#e5a24a' },
      { sys:'BDS',  prn: ['C06','C11','C19','C28'],                          col:'#c78fd1' },
    ];
    let i = 0;
    consts.forEach(c => {
      c.prn.forEach(p => {
        // Slowly moving az/el — phase by index + tick
        const phase = (i*0.7) + tick*0.005;
        const az = ((Math.sin(phase) * 0.5 + 0.5) * 360 + i*23) % 360;
        const el = 10 + Math.abs(Math.sin(phase*1.3 + i)) * 70;
        const snr = 32 + Math.abs(Math.sin(phase*2 + i*0.3)) * 18;
        const used = el > 12 && snr > 35;
        list.push({ sys: c.sys, prn: p, az, el, snr, used, col: c.col });
        i++;
      });
    });
    return list;
  }, [tick]);

  // PDOP estimate (mock — based on count of used + their elevation distribution)
  const used = sats.filter(s => s.used);
  const pdop = used.length >= 4 ? Math.max(1.2, 8 / Math.sqrt(used.length)) : 99;
  const hdop = pdop * 0.7;
  const vdop = pdop * 0.78;
  const tdop = pdop * 0.42;
  const gdop = Math.sqrt(pdop*pdop + tdop*tdop);

  return (
    <div className="gps-panel">
      <div className="gps-skyplot">
        <svg viewBox="-110 -110 220 220">
          {/* horizon ring */}
          <circle cx="0" cy="0" r="100" fill="#0a0d10" stroke="#3a4048" strokeWidth="0.6"/>
          <circle cx="0" cy="0" r="66"  fill="none" stroke="#2a2e34" strokeWidth="0.4"/>
          <circle cx="0" cy="0" r="33"  fill="none" stroke="#2a2e34" strokeWidth="0.4"/>
          <line x1="-100" y1="0" x2="100" y2="0" stroke="#2a2e34" strokeWidth="0.4"/>
          <line x1="0" y1="-100" x2="0" y2="100" stroke="#2a2e34" strokeWidth="0.4"/>
          {/* compass labels */}
          <text x="0"   y="-104" fill="#878175" fontSize="6.5" textAnchor="middle" fontFamily="JetBrains Mono">N</text>
          <text x="106" y="2"    fill="#878175" fontSize="6.5" textAnchor="middle" fontFamily="JetBrains Mono">E</text>
          <text x="0"   y="110"  fill="#878175" fontSize="6.5" textAnchor="middle" fontFamily="JetBrains Mono">S</text>
          <text x="-106" y="2"   fill="#878175" fontSize="6.5" textAnchor="middle" fontFamily="JetBrains Mono">W</text>
          <text x="2" y="-67" fill="#5a564d" fontSize="5" fontFamily="JetBrains Mono">60°</text>
          <text x="2" y="-34" fill="#5a564d" fontSize="5" fontFamily="JetBrains Mono">30°</text>
          {/* mask zone — terrain mask example */}
          <path d="M -100,0 A 100,100 0 0,1 -85,-52 L -50,-30 L -30,-10 L 0,-25 L 30,-10 L 50,-25 L 85,-52 A 100,100 0 0,1 100,0 Z"
                fill="rgba(216,99,74,0.04)" stroke="rgba(216,99,74,0.15)" strokeWidth="0.4"
                style={{display:'none'}}/>
          {/* sats */}
          {sats.map(s => {
            // az 0=N, increasing clockwise; el 90=center, 0=horizon
            const r = (90 - s.el) * (100/90);
            const azr = (s.az - 90) * Math.PI/180;
            const x = Math.cos(azr) * r;
            const y = Math.sin(azr) * r;
            return (
              <g key={s.sys+s.prn}>
                <circle cx={x} cy={y} r={s.used ? 4 : 3} fill={s.used ? s.col : 'transparent'} stroke={s.col} strokeWidth="0.7" opacity={s.used ? 1 : 0.5}/>
                <text x={x} y={y+1.5} fill={s.used ? '#0a0d10' : s.col} fontSize="3.5" textAnchor="middle" fontFamily="JetBrains Mono" fontWeight="600">{s.prn.slice(1)}</text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="gps-side">
        <div className="dop-grid">
          {[
            ['PDOP', pdop, '< 2.0'],
            ['HDOP', hdop, '< 1.5'],
            ['VDOP', vdop, '< 2.0'],
            ['TDOP', tdop, '< 1.0'],
            ['GDOP', gdop, '< 2.5'],
          ].map(([name, v, target]) => (
            <div key={name} className={`dop-cell ${v < parseFloat(target.replace('< ','')) ? 'good' : 'warn'}`}>
              <div className="dop-name">{name}</div>
              <div className="dop-val mono">{v < 99 ? v.toFixed(2) : '—'}</div>
              <div className="dop-target mono">{target}</div>
            </div>
          ))}
        </div>

        <div className="gps-counts">
          <div><span className="gps-c-num mono" style={{color:'#7aa874'}}>{used.length}</span><span>USED</span></div>
          <div><span className="gps-c-num mono">{sats.length}</span><span>VIS</span></div>
          <div><span className="gps-c-num mono" style={{color:'#e5a24a'}}>{sats.filter(s=>!s.used).length}</span><span>MASKED</span></div>
        </div>

        <div className="hud-label">SNR · C/N0 (dBHz)</div>
        <div className="snr-bars">
          {sats.slice(0, 12).map(s => (
            <div key={s.prn+s.sys} className="snr-row">
              <span className="snr-id mono" style={{color:s.col}}>{s.prn}</span>
              <div className="snr-track"><div className="snr-fill" style={{width: `${(s.snr-20)*2.5}%`, background: s.col}}/></div>
              <span className="snr-val mono">{s.snr.toFixed(1)}</span>
            </div>
          ))}
        </div>

        <div className="hud-label">PDOP · 향후 30분 예측</div>
        <div className="pdop-forecast">
          <svg viewBox="0 0 240 50" preserveAspectRatio="none" style={{width:'100%',height:50}}>
            <defs>
              <linearGradient id="pdopg" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#e5a24a" stopOpacity="0.5"/>
                <stop offset="100%" stopColor="#e5a24a" stopOpacity="0"/>
              </linearGradient>
            </defs>
            {(() => {
              const pts = [];
              const fill = ['M 0 50'];
              for (let i = 0; i <= 60; i++) {
                const t = i / 60;
                const x = t * 240;
                const v = 1.5 + Math.sin(t*Math.PI*1.4 + tick*0.05) * 0.4 + Math.cos(t*9)*0.15;
                const y = 50 - (v / 4) * 50;
                pts.push(`${i===0?'M':'L'} ${x} ${y}`);
                fill.push(`L ${x} ${y}`);
              }
              fill.push('L 240 50 Z');
              return (
                <>
                  <path d={fill.join(' ')} fill="url(#pdopg)"/>
                  <path d={pts.join(' ')} fill="none" stroke="#e5a24a" strokeWidth="1.2"/>
                  <line x1="0" y1={50 - (2.0/4)*50} x2="240" y2={50 - (2.0/4)*50} stroke="#d8634a" strokeWidth="0.5" strokeDasharray="2,2"/>
                  <text x="2" y={50 - (2.0/4)*50 - 2} fill="#d8634a" fontSize="6" fontFamily="JetBrains Mono">2.0 limit</text>
                </>
              );
            })()}
          </svg>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { GlobePanel, GpsLosPanel, llToVec3, SATELLITES, THREAT_SITES });

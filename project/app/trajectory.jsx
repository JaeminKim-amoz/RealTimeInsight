// 3D Trajectory flythrough panel — Three.js terrain + sortie path in 3D.
// Driven by live GPS samples from BUS (channels 3501/3502/3503).

function Trajectory3DPanel({ panel, mode }) {
  const mountRef = useRef(null);
  const threeRef = useRef(null);
  const trailRef = useRef([]);

  const [cam, setCam] = useState('chase');   // chase | orbit | top

  // Initialize scene once
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !window.THREE) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d0b0a);
    scene.fog = new THREE.Fog(0x0d0b0a, 40, 140);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    // Lighting
    scene.add(new THREE.AmbientLight(0x3a3026, 0.6));
    const sun = new THREE.DirectionalLight(0xffd8a0, 0.9);
    sun.position.set(40, 60, 20);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x4a6a8a, 0.5);
    rim.position.set(-40, 30, -20);
    scene.add(rim);

    // Procedural terrain — heightfield via sinusoids, wireframe amber tint
    const TERRAIN_SIZE = 160, SEGS = 80;
    const terrainGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, SEGS, SEGS);
    terrainGeo.rotateX(-Math.PI / 2);
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h =
        Math.sin(x * 0.08) * Math.cos(z * 0.07) * 5 +
        Math.sin(x * 0.22 + 1.3) * 2 +
        Math.cos(z * 0.18 - 0.6) * 2.5 +
        Math.sin((x + z) * 0.04) * 4;
      pos.setY(i, h);
    }
    terrainGeo.computeVertexNormals();

    // terrain solid fill
    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x2a2520, roughness: 0.95, metalness: 0.0,
      flatShading: true,
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    scene.add(terrain);

    // terrain wireframe overlay (amber)
    const wireGeo = new THREE.WireframeGeometry(terrainGeo);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x6a4f2a, transparent: true, opacity: 0.35 });
    scene.add(new THREE.LineSegments(wireGeo, wireMat));

    // Grid on terrain (horizontal reference)
    const grid = new THREE.GridHelper(TERRAIN_SIZE, 20, 0x3a2e1a, 0x2a2418);
    grid.position.y = -8;
    scene.add(grid);

    // Trail line (will be updated dynamically)
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 800), 3));
    const trailMat = new THREE.LineBasicMaterial({ color: 0xf0b44a, linewidth: 2, transparent: true, opacity: 0.9 });
    const trail = new THREE.Line(trailGeo, trailMat);
    trail.frustumCulled = false;
    scene.add(trail);

    // Trail glow (thick, low-opacity)
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 800), 3));
    const glowMat = new THREE.LineBasicMaterial({ color: 0xe5a24a, transparent: true, opacity: 0.25 });
    const glow = new THREE.Line(glowGeo, glowMat);
    glow.frustumCulled = false;
    scene.add(glow);

    // Altitude "drop-lines" from trail to ground (visual reference)
    const dropGeo = new THREE.BufferGeometry();
    dropGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 800 * 2), 3));
    const dropMat = new THREE.LineBasicMaterial({ color: 0xe5a24a, transparent: true, opacity: 0.15 });
    const dropLines = new THREE.LineSegments(dropGeo, dropMat);
    dropLines.frustumCulled = false;
    scene.add(dropLines);

    // Aircraft proxy (small diamond + engine glow)
    const craft = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.ConeGeometry(0.4, 1.6, 6),
      new THREE.MeshStandardMaterial({ color: 0xe5a24a, emissive: 0x4a3010, emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.3 })
    );
    body.rotation.z = -Math.PI / 2;
    craft.add(body);
    const wings = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.08, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x8a7a5a })
    );
    craft.add(wings);
    const trail3 = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff7a30, transparent: true, opacity: 0.8 })
    );
    trail3.position.x = -0.9;
    craft.add(trail3);
    scene.add(craft);

    // Waypoints markers — fixed stars along a planned route
    const waypoints = [
      [  10,  10,  20], [ -15,  14, -10], [  20,  18, -30], [ -25,  22,  35], [   5,  26,  48]
    ];
    waypoints.forEach((wp) => {
      const m = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.5, 0),
        new THREE.MeshBasicMaterial({ color: 0x6b9bd1, wireframe: true })
      );
      m.position.set(wp[0], wp[1], wp[2]);
      scene.add(m);
      // drop pin to ground
      const pin = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(wp[0], wp[1], wp[2]),
          new THREE.Vector3(wp[0], -8, wp[2])
        ]),
        new THREE.LineBasicMaterial({ color: 0x6b9bd1, transparent: true, opacity: 0.4 })
      );
      scene.add(pin);
    });

    threeRef.current = {
      scene, camera, renderer, mount, terrain, grid,
      trail, trailGeo, glow, glowGeo, dropLines, dropGeo,
      craft, TERRAIN_SIZE,
      orbitPhase: 0,
    };

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

  const rev = useBus();

  // Update trail + camera from bus GPS
  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx) return;

    // Pull last GPS snapshot into local 3D coordinates
    const snapLat = BUS.snapshot(3501, 400);
    const snapLon = BUS.snapshot(3502, 400);
    const snapAlt = BUS.snapshot(3503, 400);
    if (snapLat.len === 0) return;

    const refLat = 36.1234, refLon = 127.5432;
    // convert lat/lon → local meters-ish (rough equirect) → scene units
    const SCENE_SCALE = 300;  // degrees → scene units
    const ALT_SCALE = 0.012;  // m → scene units

    const n = snapLat.len;
    const posArr = ctx.trailGeo.attributes.position.array;
    const glowArr = ctx.glowGeo.attributes.position.array;
    const dropArr = ctx.dropLines.geometry.attributes.position.array;

    let last = null;
    for (let i = 0; i < n; i++) {
      const x = (snapLon.vals[i] - refLon) * SCENE_SCALE;
      const y = (snapAlt.vals[i] - 3500) * ALT_SCALE;
      const z = -(snapLat.vals[i] - refLat) * SCENE_SCALE;
      posArr[i*3+0] = x; posArr[i*3+1] = y; posArr[i*3+2] = z;
      glowArr[i*3+0] = x; glowArr[i*3+1] = y; glowArr[i*3+2] = z;
      // drop line
      dropArr[i*6+0] = x; dropArr[i*6+1] = y;  dropArr[i*6+2] = z;
      dropArr[i*6+3] = x; dropArr[i*6+4] = -8; dropArr[i*6+5] = z;
      last = [x, y, z];
    }
    // zero out unused
    for (let i = n; i < 800; i++) {
      posArr[i*3]=posArr[i*3+1]=posArr[i*3+2]=0;
      glowArr[i*3]=glowArr[i*3+1]=glowArr[i*3+2]=0;
      dropArr[i*6]=dropArr[i*6+1]=dropArr[i*6+2]=0;
      dropArr[i*6+3]=dropArr[i*6+4]=dropArr[i*6+5]=0;
    }
    ctx.trailGeo.setDrawRange(0, n);
    ctx.glowGeo.setDrawRange(0, n);
    ctx.dropLines.geometry.setDrawRange(0, n * 2);
    ctx.trailGeo.attributes.position.needsUpdate = true;
    ctx.glowGeo.attributes.position.needsUpdate = true;
    ctx.dropLines.geometry.attributes.position.needsUpdate = true;

    if (last) {
      ctx.craft.position.set(last[0], last[1], last[2]);
      // orient craft along last segment
      if (n > 1) {
        const px = posArr[(n-2)*3], py = posArr[(n-2)*3+1], pz = posArr[(n-2)*3+2];
        const dir = new THREE.Vector3(last[0]-px, last[1]-py, last[2]-pz);
        if (dir.lengthSq() > 0.0001) {
          const target = new THREE.Vector3(last[0]+dir.x*5, last[1]+dir.y*5, last[2]+dir.z*5);
          ctx.craft.lookAt(target);
          ctx.craft.rotateY(Math.PI/2); // cone's axis was rotated initially
        }
      }
    }

    // Camera behavior
    if (last) {
      if (cam === 'chase') {
        const dir = n > 1
          ? new THREE.Vector3(
              last[0] - posArr[(n-2)*3],
              last[1] - posArr[(n-2)*3+1],
              last[2] - posArr[(n-2)*3+2]
            ).normalize()
          : new THREE.Vector3(0, 0, -1);
        ctx.camera.position.set(
          last[0] - dir.x * 14,
          last[1] + 6,
          last[2] - dir.z * 14
        );
        ctx.camera.lookAt(last[0], last[1], last[2]);
      } else if (cam === 'orbit') {
        ctx.orbitPhase += 0.003;
        const R = 42;
        ctx.camera.position.set(
          Math.cos(ctx.orbitPhase) * R,
          24,
          Math.sin(ctx.orbitPhase) * R
        );
        ctx.camera.lookAt(0, 4, 0);
      } else if (cam === 'top') {
        ctx.camera.position.set(0, 80, 0.1);
        ctx.camera.lookAt(0, 0, 0);
      }
    }
  }, [rev, cam]);

  const lat = BUS.latest(3501) ?? 0;
  const lon = BUS.latest(3502) ?? 0;
  const alt = BUS.latest(3503) ?? 0;
  const hdg = BUS.latest(2212) ?? 0;

  return (
    <div className="traj-body" style={{ position: 'relative', width:'100%', height:'100%', overflow:'hidden' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }}/>

      {/* Camera mode selector */}
      <div style={{
        position:'absolute', top: 8, right: 8, display: 'flex', gap: 2,
        background: 'rgba(20, 17, 15, 0.85)', padding: 2, border: '1px solid var(--line-1)',
      }}>
        {['chase','orbit','top'].map(m => (
          <button key={m}
            onClick={() => setCam(m)}
            style={{
              padding: '3px 8px',
              background: cam===m ? 'var(--amber-2)' : 'transparent',
              color: cam===m ? '#1a1614' : 'var(--fg-1)',
              border: 'none', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.6,
              fontFamily: 'inherit', cursor: 'pointer',
            }}>{m}</button>
        ))}
      </div>

      {/* Readouts */}
      <div className="att-readout" style={{ top:8, left:8, fontSize: 9.5 }}>
        <div><span className="label">LAT  </span>{lat.toFixed(4)}°</div>
        <div><span className="label">LON  </span>{lon.toFixed(4)}°</div>
        <div><span className="label">ALT  </span>{alt.toFixed(0)} m</div>
        <div><span className="label">HDG  </span>{Math.abs(hdg).toFixed(0)}°</div>
      </div>

      <div style={{
        position:'absolute', bottom: 8, left: 8,
        fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 1,
      }}>
        TERRAIN · PROCEDURAL · 160×160 UNITS · WAYPOINTS 5
      </div>
    </div>
  );
}

Object.assign(window, { Trajectory3DPanel });

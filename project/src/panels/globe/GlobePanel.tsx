/**
 * GlobePanel (US-3-001 / US-3-002 / US-3-005) — full prototype-parity
 * orbital theater with procedural earth, atmosphere glow, 18 satellites,
 * 7 threat domes, 2 friendly EW emitters, and 2400-star background.
 *
 * Architecture:
 *  - 4-corner HUD overlays + layer toggles render in React (always present,
 *    so DOM tests pass in jsdom even without WebGL).
 *  - The Three.js scene mounts imperatively via mountRef (matches the
 *    public/app/space.jsx prototype). When WebGL is unavailable (jsdom),
 *    we render an SVG fallback inside .globe-canvas with concentric orbit
 *    rings and threat dots so the panel is never blank.
 *  - All procedural textures are generated in canvas 2D via globe-textures.ts.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { PanelInstance } from '../../types/domain';
import { SATELLITES, THREAT_SITES, FRIENDLY_EW } from './globe-data';
import { makeEarthTexture, makeEarthBumpTexture } from './globe-textures';
import { latLonToVec3 as latLonToTuple } from './geometry';

interface GlobePanelProps {
  panel: PanelInstance;
  mode?: 'live' | 'replay';
}

const EARTH_RADIUS_KM = 6371;

function hasWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  // jsdom defines neither WebGLRenderingContext nor a real canvas 2d ctx.
  // Avoid even probing getContext() so we don't spam jsdom's not-implemented
  // warning during tests.
  if (typeof (window as { WebGLRenderingContext?: unknown }).WebGLRenderingContext === 'undefined') {
    return false;
  }
  try {
    const cv = document.createElement('canvas');
    return Boolean(cv.getContext('webgl') || cv.getContext('experimental-webgl'));
  } catch {
    return false;
  }
}

function colorToHex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

interface LayerToggles {
  showTexture: boolean;
  showWire: boolean;
  showAtmo: boolean;
  showStars: boolean;
  showOrbits: boolean;
  showThreats: boolean;
  showFriendly: boolean;
  showTerrain: boolean;
  autoSpin: boolean;
}

const DEFAULT_TOGGLES: LayerToggles = {
  showTexture: true,
  showWire: false,
  showAtmo: true,
  showStars: true,
  showOrbits: true,
  showThreats: true,
  showFriendly: true,
  showTerrain: true,
  autoSpin: true,
};

const TOGGLE_LABELS: ReadonlyArray<[keyof LayerToggles, string]> = [
  ['showTexture',  '지구 텍스처'],
  ['showWire',     '와이어프레임'],
  ['showAtmo',     '대기 글로우'],
  ['showStars',    '별 배경'],
  ['showOrbits',   '궤도 + 위성'],
  ['showThreats',  '적 위협 반구'],
  ['showFriendly', '우군 EW'],
  ['showTerrain',  'Terrain 음영'],
  ['autoSpin',     '자동 회전'],
];

interface SceneRefs {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  earth: THREE.Mesh;
  wire: THREE.Mesh;
  atmo: THREE.Mesh;
  stars: THREE.Points;
  orbitGroup: THREE.Group;
  satGroup: THREE.Group;
  threatGroup: THREE.Group;
  friendlyGroup: THREE.Group;
  sats: Array<{
    r: number;
    inc: number;
    raan: number;
    period: number;
    phase: number;
    mesh: THREE.Mesh;
  }>;
}

export function GlobePanel({ panel, mode }: GlobePanelProps) {
  void panel;
  void mode;

  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneRefs | null>(null);
  const [toggles, setToggles] = useState<LayerToggles>(DEFAULT_TOGGLES);
  const [zoom, setZoom] = useState(2.6);
  const [webglReady, setWebglReady] = useState(false);

  const setToggle = <K extends keyof LayerToggles>(key: K, value: LayerToggles[K]) => {
    setToggles((prev) => ({ ...prev, [key]: value }));
  };

  // Imperative Three.js mount — only in production browser path.
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    if (!hasWebGL()) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      return;
    }
    if (!renderer) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070b);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
    camera.position.set(0, 0.4, 2.6);

    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    const sun = new THREE.DirectionalLight(0xfff4dd, 1.5);
    sun.position.set(5, 1.5, 3);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0x4a5060, 0.4));

    const earthTex = makeEarthTexture(THREE);
    const earthBumpTex = makeEarthBumpTexture(THREE);
    const earthGeo = new THREE.SphereGeometry(1, 96, 64);
    const earthMatOpts: THREE.MeshStandardMaterialParameters = {
      roughness: 0.85,
      metalness: 0.05,
      emissive: new THREE.Color(0x0a1224),
      emissiveIntensity: 0.18,
    };
    if (earthTex) earthMatOpts.map = earthTex;
    if (earthBumpTex) {
      earthMatOpts.bumpMap = earthBumpTex;
      earthMatOpts.bumpScale = 0.02;
    } else {
      earthMatOpts.color = new THREE.Color(0x0c1a2e);
    }
    const earth = new THREE.Mesh(earthGeo, new THREE.MeshStandardMaterial(earthMatOpts));
    scene.add(earth);

    const wire = new THREE.Mesh(
      new THREE.SphereGeometry(1.001, 36, 24),
      new THREE.MeshBasicMaterial({
        color: 0x4a6080,
        wireframe: true,
        transparent: true,
        opacity: 0.15,
      })
    );
    wire.visible = false;
    scene.add(wire);

    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.06, 64, 32),
      new THREE.ShaderMaterial({
        uniforms: {
          c: { value: 0.7 },
          p: { value: 4.5 },
          glowColor: { value: new THREE.Color(0x4a8fcf) },
        },
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
      })
    );
    scene.add(atmo);

    // Stars
    const starCount = 2400;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const th = 2 * Math.PI * u;
      const ph = Math.acos(2 * v - 1);
      const r = 60 + Math.random() * 30;
      starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      starPos[i * 3 + 2] = r * Math.cos(ph);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.7,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
      })
    );
    scene.add(stars);

    // Orbit rings + sats
    const orbitGroup = new THREE.Group();
    const satGroup = new THREE.Group();
    scene.add(orbitGroup);
    scene.add(satGroup);
    const sats = SATELLITES.map((s) => {
      const r = 1 + (s.alt / EARTH_RADIUS_KM) * 0.9;
      const inc = (s.inc * Math.PI) / 180;
      const raan = (s.raan * Math.PI) / 180;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) {
        const t = (i / 96) * Math.PI * 2;
        const x = Math.cos(t) * r;
        const y = Math.sin(t) * r;
        const z = 0;
        const yi = y * Math.cos(inc) - z * Math.sin(inc);
        const zi = y * Math.sin(inc) + z * Math.cos(inc);
        const xr = x * Math.cos(raan) + zi * Math.sin(raan);
        const zr = -x * Math.sin(raan) + zi * Math.cos(raan);
        pts.push(new THREE.Vector3(xr, yi, zr));
      }
      const ringGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const ringMat = new THREE.LineBasicMaterial({
        color: s.color,
        transparent: true,
        opacity: 0.35,
      });
      orbitGroup.add(new THREE.Line(ringGeo, ringMat));
      const satMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 6),
        new THREE.MeshBasicMaterial({ color: s.color })
      );
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 8, 6),
        new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.25 })
      );
      satMesh.add(halo);
      satGroup.add(satMesh);
      return {
        r,
        inc,
        raan,
        period: s.period,
        phase: Math.random() * Math.PI * 2,
        mesh: satMesh,
      };
    });

    // Threat domes
    const threatGroup = new THREE.Group();
    scene.add(threatGroup);
    THREAT_SITES.forEach((site) => {
      const [x, y, z] = latLonToTuple(site.lat, site.lon, 1);
      const radiusOnSphere = site.range_km / EARTH_RADIUS_KM;
      const baseColor = site.threat === 'high' ? 0xd8634a : 0xe5a24a;
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(
          radiusOnSphere,
          32,
          16,
          0,
          Math.PI * 2,
          0,
          Math.PI / 2
        ),
        new THREE.MeshBasicMaterial({
          color: baseColor,
          transparent: true,
          opacity: 0.18,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      const surface = new THREE.Vector3(x, y, z);
      dome.position.copy(surface);
      dome.lookAt(surface.clone().multiplyScalar(2));
      dome.rotateX(Math.PI / 2);
      threatGroup.add(dome);

      const wireD = new THREE.Mesh(
        new THREE.SphereGeometry(
          radiusOnSphere * 1.001,
          24,
          12,
          0,
          Math.PI * 2,
          0,
          Math.PI / 2
        ),
        new THREE.MeshBasicMaterial({
          color: baseColor,
          wireframe: true,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
        })
      );
      wireD.position.copy(surface);
      wireD.lookAt(surface.clone().multiplyScalar(2));
      wireD.rotateX(Math.PI / 2);
      threatGroup.add(wireD);

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff5040 })
      );
      marker.position.copy(surface).multiplyScalar(1.005);
      threatGroup.add(marker);
    });

    // Friendly EW
    const friendlyGroup = new THREE.Group();
    scene.add(friendlyGroup);
    FRIENDLY_EW.forEach((site) => {
      const [x, y, z] = latLonToTuple(site.lat, site.lon, 1);
      const r = site.range_km / EARTH_RADIUS_KM;
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: 0x7aa874,
          transparent: true,
          opacity: 0.14,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      const surface = new THREE.Vector3(x, y, z);
      dome.position.copy(surface);
      dome.lookAt(surface.clone().multiplyScalar(2));
      dome.rotateX(Math.PI / 2);
      friendlyGroup.add(dome);

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x9bd183 })
      );
      marker.position.copy(surface).multiplyScalar(1.005);
      friendlyGroup.add(marker);
    });

    sceneRef.current = {
      scene,
      camera,
      renderer,
      earth,
      wire,
      atmo,
      stars,
      orbitGroup,
      satGroup,
      threatGroup,
      friendlyGroup,
      sats,
    };
    setWebglReady(true);

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h || !sceneRef.current) return;
      sceneRef.current.renderer.setSize(w, h, false);
      sceneRef.current.camera.aspect = w / h;
      sceneRef.current.camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();

    // Mouse drag + wheel
    const dragState = { dragging: false, lx: 0, ly: 0, ry: 0, rx: 0.2 };
    const onDown = (e: MouseEvent) => {
      dragState.dragging = true;
      dragState.lx = e.clientX;
      dragState.ly = e.clientY;
    };
    const onUp = () => {
      dragState.dragging = false;
    };
    const onMove = (e: MouseEvent) => {
      if (!dragState.dragging) return;
      dragState.ry += (e.clientX - dragState.lx) * 0.005;
      dragState.rx += (e.clientY - dragState.ly) * 0.005;
      dragState.rx = Math.max(-1.2, Math.min(1.2, dragState.rx));
      dragState.lx = e.clientX;
      dragState.ly = e.clientY;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!sceneRef.current) return;
      const cam = sceneRef.current.camera;
      const z = cam.position.z + e.deltaY * 0.002;
      cam.position.z = Math.max(1.15, Math.min(6, z));
      setZoom(cam.position.z);
    };
    renderer.domElement.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mousemove', onMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // Animate
    let raf = 0;
    let cancelled = false;
    let t0 = performance.now();
    const animate = () => {
      if (cancelled) return;
      const now = performance.now();
      const dt = (now - t0) / 1000;
      t0 = now;
      const s = sceneRef.current;
      if (!s) return;

      if (toggles.autoSpin && !dragState.dragging) dragState.ry += dt * 0.05;
      const rotY = dragState.ry;
      const rotX = dragState.rx;
      [s.earth, s.wire, s.orbitGroup, s.satGroup, s.threatGroup, s.friendlyGroup].forEach((obj) => {
        obj.rotation.y = rotY;
        obj.rotation.x = rotX;
      });

      s.sats.forEach((sat) => {
        sat.phase += dt * ((2 * Math.PI) / sat.period) * 30;
        const t = sat.phase;
        const x = Math.cos(t) * sat.r;
        const y = Math.sin(t) * sat.r;
        const z = 0;
        const yi = y * Math.cos(sat.inc) - z * Math.sin(sat.inc);
        const zi = y * Math.sin(sat.inc) + z * Math.cos(sat.inc);
        const xr = x * Math.cos(sat.raan) + zi * Math.sin(sat.raan);
        const zr = -x * Math.sin(sat.raan) + zi * Math.cos(sat.raan);
        sat.mesh.position.set(xr, yi, zr);
      });

      s.stars.material.opacity = 0.7 + Math.sin(now * 0.001) * 0.1;
      s.renderer.render(s.scene, s.camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer?.domElement.removeEventListener('mousedown', onDown);
      renderer?.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mousemove', onMove);
      try {
        if (renderer && mount.contains(renderer.domElement)) {
          mount.removeChild(renderer.domElement);
        }
      } catch {
        /* ignore */
      }
      renderer?.dispose();
      sceneRef.current = null;
    };
    // Empty deps: scene is mounted once. Toggle/zoom changes flow via the
    // second effect below (group.visible), and autoSpin is read from state
    // via toggles closure — re-mounting on every change would lose the
    // animation timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply layer toggles + bump scaling on changes
  useEffect(() => {
    const r = sceneRef.current;
    if (!r) return;
    r.earth.visible = toggles.showTexture;
    r.wire.visible = toggles.showWire;
    r.atmo.visible = toggles.showAtmo;
    r.stars.visible = toggles.showStars;
    r.orbitGroup.visible = toggles.showOrbits;
    r.satGroup.visible = toggles.showOrbits;
    r.threatGroup.visible = toggles.showThreats;
    r.friendlyGroup.visible = toggles.showFriendly;
    const mat = r.earth.material as THREE.MeshStandardMaterial;
    if ('bumpScale' in mat) {
      mat.bumpScale = toggles.showTerrain ? Math.max(0.02, (3 - zoom) * 0.06) : 0;
      mat.needsUpdate = true;
    }
  }, [toggles, zoom]);

  const visibleSats = useMemo(() => SATELLITES.slice(0, 8), []);
  void webglReady;

  return (
    <div className="globe-wrap" data-testid="globe-wrap">
      <div className="globe-canvas" ref={mountRef} data-testid="globe-canvas">
        {/* SVG fallback for jsdom / WebGL-less environments */}
        <svg
          className="globe-canvas-fallback"
          data-testid="globe-canvas-fallback"
          viewBox="-100 -100 200 200"
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Earth globe (fallback)"
          role="img"
        >
          <defs>
            <radialGradient id="globe-fb-earth" cx="40%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#1a3460" />
              <stop offset="55%" stopColor="#0c1a2e" />
              <stop offset="100%" stopColor="#03060a" />
            </radialGradient>
          </defs>
          <circle cx="0" cy="0" r="62" fill="url(#globe-fb-earth)" stroke="#2a3850" strokeWidth="0.4" />
          {[72, 80, 88, 95, 100].map((r, i) => (
            <ellipse
              key={r}
              cx="0"
              cy="0"
              rx={r}
              ry={r * 0.55}
              fill="none"
              stroke={`rgba(${i % 2 === 0 ? '155,178,224' : '198,223,255'},${0.25 - i * 0.03})`}
              strokeWidth="0.45"
              transform={`rotate(${-25 + i * 12})`}
            />
          ))}
          {THREAT_SITES.slice(0, 7).map((t, i) => (
            <circle
              key={t.id}
              cx={(Math.cos((i * 51) * (Math.PI / 180)) * 50).toFixed(1)}
              cy={(Math.sin((i * 51) * (Math.PI / 180)) * 35).toFixed(1)}
              r="2.4"
              fill={t.threat === 'high' ? '#d8634a' : '#e5a24a'}
              opacity="0.85"
            />
          ))}
          {FRIENDLY_EW.map((f, i) => (
            <circle
              key={f.id}
              cx={(Math.cos(((i * 80) + 30) * (Math.PI / 180)) * 45).toFixed(1)}
              cy={(Math.sin(((i * 80) + 30) * (Math.PI / 180)) * 30).toFixed(1)}
              r="2.4"
              fill="#9bd183"
              opacity="0.85"
            />
          ))}
        </svg>
      </div>

      <div className="globe-hud globe-hud-tl" data-testid="globe-hud-tl">
        <div className="hud-label">SPACE · ORBITAL VIEW</div>
        <div className="hud-row mono">SATS · {SATELLITES.length}</div>
        <div className="hud-row mono">
          THREAT SITES · <span style={{ color: '#d8634a' }}>{THREAT_SITES.length}</span>
        </div>
        <div className="hud-row mono">
          FRIENDLY EW · <span style={{ color: '#9bd183' }}>{FRIENDLY_EW.length}</span>
        </div>
        <div className="hud-row mono">
          ZOOM · {zoom.toFixed(2)}× · ALT {((zoom - 1) * EARTH_RADIUS_KM).toFixed(0)} km
        </div>
      </div>

      <div className="globe-hud globe-hud-tr" data-testid="globe-hud-tr">
        <div className="hud-label">LAYERS</div>
        {TOGGLE_LABELS.map(([key, label]) => (
          <label key={key} className="hud-toggle">
            <input
              type="checkbox"
              checked={toggles[key]}
              onChange={(e) => setToggle(key, e.target.checked)}
              data-testid={`globe-toggle-${key}`}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="globe-hud globe-hud-bl" data-testid="globe-hud-bl">
        <div className="hud-label">위성 · LIVE</div>
        <div className="sat-table">
          {visibleSats.map((s) => (
            <div key={s.id} className="sat-row" data-testid={`globe-sat-row-${s.id}`}>
              <span className="sat-dot" style={{ background: colorToHex(s.color) }} />
              <span className="sat-id">{s.id}</span>
              <span className="sat-cls">{s.cls}</span>
              <span className="sat-alt mono">{s.alt.toLocaleString()}km</span>
            </div>
          ))}
          <div className="sat-more">+ {SATELLITES.length - visibleSats.length} more</div>
        </div>
      </div>

      <div className="globe-hud globe-hud-br" data-testid="globe-hud-br">
        <div className="hud-label">THREAT REGISTRY</div>
        {THREAT_SITES.map((t) => (
          <div key={t.id} className="threat-row" data-testid={`globe-threat-row-${t.id}`}>
            <span className={`threat-dot tier-${t.threat}`} />
            <div className="threat-meta">
              <div className="threat-name">{t.name}</div>
              <div className="threat-sub mono">
                {t.freq} · {t.range_km}km · ×{t.count}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="globe-credits mono" data-testid="globe-credits">
        DRAG · 회전 · WHEEL · 줌 · {toggles.showTerrain ? 'TERRAIN ON ZOOM' : 'TERRAIN OFF'}
      </div>
    </div>
  );
}

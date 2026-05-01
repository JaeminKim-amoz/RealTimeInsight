/**
 * Procedural earth + bump textures (US-3-001).
 *
 * Mirrors public/app/space.jsx makeEarthTexture / makeEarthBumpTexture so the
 * globe in production has continents, ice caps, city lights, and bumpy
 * mountain ranges without needing any external image asset.
 *
 * Both functions accept a Three module reference so we can lazy-load three
 * only when WebGL is available (jsdom doesn't have real canvas + webgl).
 */

import type * as THREEType from 'three';

interface Continent {
  lon: number;
  lat: number;
  /** longitude radius in degrees */
  lr: number;
  /** latitude radius in degrees */
  ar: number;
}

const CONTINENTS: ReadonlyArray<Continent> = [
  { lon: -100, lat:  50, lr: 35, ar: 22 },
  { lon:  -95, lat:  30, lr: 18, ar: 14 },
  { lon:  -75, lat:  18, lr: 12, ar:  8 },
  { lon:  -65, lat: -15, lr: 16, ar: 18 },
  { lon:  -68, lat: -35, lr:  9, ar: 14 },
  { lon:   10, lat:  52, lr: 22, ar: 12 },
  { lon:   25, lat:  45, lr: 14, ar:  9 },
  { lon:   18, lat:  12, lr: 18, ar: 14 },
  { lon:   25, lat: -10, lr: 18, ar: 18 },
  { lon:   28, lat: -28, lr: 14, ar:  8 },
  { lon:   45, lat:  25, lr: 12, ar: 10 },
  { lon:   78, lat:  22, lr: 11, ar: 12 },
  { lon:   85, lat:  55, lr: 50, ar: 18 },
  { lon:  105, lat:  35, lr: 25, ar: 14 },
  { lon:  130, lat:  50, lr: 20, ar: 14 },
  { lon:  135, lat:  35, lr: 12, ar: 10 },
  { lon:  110, lat:   5, lr: 14, ar:  8 },
  { lon:  135, lat: -25, lr: 22, ar: 12 },
  { lon:  -40, lat:  72, lr: 18, ar: 10 },
];

const MOUNTAIN_RANGES: ReadonlyArray<[number, number, number, number, number]> = [
  [-130, 60, -110, 30, 0.6],
  [ -75, 10,  -70, -45, 0.7],
  [  30, 35,   60,  30, 0.4],
  [  70, 38,   95,  30, 0.9],
  [ 100, 45,  130,  30, 0.5],
  [  25, 46,   10,  43, 0.4],
  [ 140, -40, 145, -32, 0.3],
  [  35,  -5,  37, -15, 0.4],
];

/**
 * Build a procedural day-side earth texture: deep-blue ocean + ice caps
 * + 19 continent meta-blobs + 300 city-light dots + faint cloud wisps.
 *
 * Returns null when the canvas 2d context is unavailable (e.g. jsdom
 * without the `canvas` package installed).
 */
export function makeEarthTexture(
  THREE: typeof THREEType,
  w = 2048,
  h = 1024
): THREEType.CanvasTexture | null {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#0c1a2e';
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += 2) {
    const lat = (0.5 - y / h) * 180;
    const a = 0.05 * Math.cos((lat * Math.PI) / 180);
    ctx.fillStyle = `rgba(20, 50, 90, ${a})`;
    ctx.fillRect(0, y, w, 2);
  }

  ctx.fillStyle = '#c4d2dc';
  ctx.fillRect(0, 0, w, h * 0.045);
  ctx.fillRect(0, h * 0.955, w, h * 0.045);
  ctx.fillStyle = '#a8b8c4';
  ctx.fillRect(0, h * 0.045, w, h * 0.015);
  ctx.fillRect(0, h * 0.94, w, h * 0.015);

  const landColor = '#3a4a2e';
  const landDark = '#2a3820';

  for (const c of CONTINENTS) {
    const cx = ((c.lon + 180) / 360) * w;
    const cy = ((90 - c.lat) / 180) * h;
    const rx = (c.lr / 360) * w;
    const ry = (c.ar / 180) * h;

    ctx.fillStyle = landColor;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const d = 0.7 + Math.random() * 0.5;
      const px = cx + Math.cos(a) * rx * d;
      const py = cy + Math.sin(a) * ry * d;
      const pr = 3 + Math.random() * 7;
      ctx.fillStyle = Math.random() < 0.3 ? landDark : landColor;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * 0.7;
      const px = cx + Math.cos(a) * rx * d;
      const py = cy + Math.sin(a) * ry * d;
      ctx.fillStyle = 'rgba(34, 56, 28, 0.6)';
      ctx.beginPath();
      ctx.arc(px, py, 4 + Math.random() * 8, 0, Math.PI * 2);
      ctx.fill();
    }
    if (Math.abs(c.lat) < 35) {
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * 0.6;
        const px = cx + Math.cos(a) * rx * d;
        const py = cy + Math.sin(a) * ry * d;
        ctx.fillStyle = 'rgba(140, 110, 60, 0.35)';
        ctx.beginPath();
        ctx.arc(px, py, 3 + Math.random() * 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.fillStyle = 'rgba(255, 220, 140, 0.18)';
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * w;
    const y = h * 0.18 + Math.random() * h * 0.55;
    ctx.fillRect(x, y, 1, 1);
  }

  ctx.globalAlpha = 0.04;
  for (let i = 0; i < 600; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 8 + Math.random() * 24;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace =
    (THREE as { SRGBColorSpace?: string }).SRGBColorSpace ?? tex.colorSpace;
  return tex;
}

/**
 * Build a procedural bump-map texture with mountain ranges as bright
 * radial-gradient streaks. Returns null when 2d context is unavailable.
 */
export function makeEarthBumpTexture(
  THREE: typeof THREEType,
  w = 1024,
  h = 512
): THREEType.CanvasTexture | null {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);

  for (const [lon0, lat0, lon1, lat1, k] of MOUNTAIN_RANGES) {
    const x0 = ((lon0 + 180) / 360) * w;
    const y0 = ((90 - lat0) / 180) * h;
    const x1 = ((lon1 + 180) / 360) * w;
    const y1 = ((90 - lat1) / 180) * h;
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t + (Math.random() - 0.5) * 20;
      const y = y0 + (y1 - y0) * t + (Math.random() - 0.5) * 15;
      const r = 8 + Math.random() * 14;
      const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, `rgba(255,255,255,${k})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return new THREE.CanvasTexture(cv);
}

/** Total continent count for tests. */
export const CONTINENT_COUNT = CONTINENTS.length;
/** Total mountain-range count for tests. */
export const MOUNTAIN_RANGE_COUNT = MOUNTAIN_RANGES.length;

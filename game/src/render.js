// Coral Coast Run — the renderer: a pseudo-3D chase view over the
// archipelago. Sky, sun and sea first, then a projected terrain grid,
// the runway strip, the target rings and the clouds, all under a
// camera that rides behind the aircraft.

import { RUNWAY } from './config.js';
import { clamp, lerp, mulberry32, smoothstep } from './random.js';
import { runwayEnds, terrainHeight } from './world.js';

const FOV_HALF = (35 * Math.PI) / 180; // vertical half field of view

// The clouds drift slowly across the sky, seeded so every run matches.
const cloudRand = mulberry32(20261126);
const CLOUDS = [];
for (let i = 0; i < 16; i++) {
  CLOUDS.push({
    x: (cloudRand() - 0.5) * 9000,
    y: 520 + cloudRand() * 420,
    z: (cloudRand() - 0.5) * 9000,
    r: 100 + cloudRand() * 120,
    drift: 2 + cloudRand() * 4,
  });
}

// Gradient sprites: a radial glow or a vignette is painted once to an
// offscreen canvas at its exact on-screen size and blitted 1:1, which
// is a fast copy. A scaled drawImage, or a full-screen gradient fill,
// is far too slow in software rendering — and the sky and sea are
// painted as flat bands instead, for the same reason.
const _sprites = new Map();

function radialSprite(key, stops, size) {
  let s = _sprites.get(key);
  if (s) return s;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  for (const [t, col] of stops) grad.addColorStop(t, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  _sprites.set(key, c);
  return c;
}

function rgba(rgb, a) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

// Sample a vertical gradient's stops at fraction f (0..1) -> [r,g,b].
function sampleStops(stops, f) {
  let a = stops[0];
  let b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (f >= stops[i][0] && f <= stops[i + 1][0]) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const t = b[0] === a[0] ? 0 : (f - a[0]) / (b[0] - a[0]);
  const ca = hexRgb(a[1]);
  const cb = hexRgb(b[1]);
  return [
    Math.round(lerp(ca[0], cb[0], t)),
    Math.round(lerp(ca[1], cb[1], t)),
    Math.round(lerp(ca[2], cb[2], t)),
  ];
}

// Paint a vertical gradient as flat bands: solid fills are the fastest
// thing a software rasteriser does, and 40 bands look smooth.
function fillBands(ctx, x, y, w, h, stops, bands) {
  if (h <= 0) return;
  const bh = h / bands;
  for (let i = 0; i < bands; i++) {
    const f = (i + 0.5) / bands;
    const c = sampleStops(stops, f);
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    ctx.fillRect(x, y + i * bh, w, bh + 0.5);
  }
}
export function buildCamera(plane) {
  const fwdX = Math.sin(plane.heading);
  const fwdZ = Math.cos(plane.heading);
  return {
    x: plane.x - fwdX * 15,
    y: plane.y + 5.5 - Math.sin(plane.pitch) * 4,
    z: plane.z - fwdZ * 15,
    heading: plane.heading,
    pitch: plane.pitch * 0.55 + 0.015,
    roll: plane.roll * 0.55,
  };
}

// A projector: world point -> screen point (null when behind the camera).
function makeProjector(W, H, cam) {
  const f = (H / 2) / Math.tan(FOV_HALF);
  const sh = Math.sin(cam.heading);
  const ch = Math.cos(cam.heading);
  const sp = Math.sin(cam.pitch);
  const cp = Math.cos(cam.pitch);
  return function project(x, y, z) {
    const dx = x - cam.x;
    const dy = y - cam.y;
    const dz = z - cam.z;
    const depth = dx * sh * cp + dy * sp + dz * ch * cp;
    if (depth < 2) return null;
    const right = dx * ch - dz * sh;
    const up = dx * -sh * sp + dy * cp + dz * -ch * sp;
    return { x: W / 2 + (right * f) / depth, y: H / 2 - (up * f) / depth, depth, f };
  };
}

// Nine height bands, close enough in colour that the ground reads as
// rolling fields and hills instead of flat blocks with hard edges.
const LAND_BASE = [
  [217, 192, 138], // sand
  [179, 176, 110], // sand into grass
  [127, 179, 94], // light grass
  [93, 162, 74], // grass
  [111, 154, 85], // grass into scrub
  [122, 138, 90], // scrub
  [138, 127, 104], // light rock
  [138, 122, 99], // rock
  [232, 238, 242], // snow caps
];
const LAND_EDGES = [4, 14, 30, 50, 66, 84, 98, 115];
const _colCache = new Map();

function hexRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// Mix a base RGB colour toward fog, with a shade multiplier, cached.
function shadedFogged(base, s, fog, fogT) {
  const sQ = Math.round(s * 20);
  const fQ = Math.round(fogT * 20);
  const key = (((base[0] * 256 + base[1]) * 256 + base[2]) * 512 + sQ * 32 + fQ) * 1000000
    + fog[0] * 10000 + fog[1] * 100 + fog[2];
  let hit = _colCache.get(key);
  if (hit === undefined) {
    const t = fQ / 20;
    const r = Math.round(lerp(base[0] * (sQ / 20), fog[0], t));
    const g = Math.round(lerp(base[1] * (sQ / 20), fog[1], t));
    const b = Math.round(lerp(base[2] * (sQ / 20), fog[2], t));
    hit = `rgb(${r},${g},${b})`;
    if (_colCache.size > 4000) _colCache.clear();
    _colCache.set(key, hit);
  }
  return hit;
}

function landBand(h) {
  for (let i = 0; i < LAND_EDGES.length; i++) {
    if (h < LAND_EDGES[i]) return i;
  }
  return LAND_BASE.length - 1;
}

// The whole scene, in order: sky, sun, sea, terrain, runway, rings,
// clouds, the aircraft's shadow on the ground below.
export function renderScene(ctx, W, H, view) {
  const { cam, plane, course, palette, rings, nextRing, time } = view;
  const project = makeProjector(W, H, cam);
  const horizonY = H / 2 - Math.tan(cam.pitch) * ((H / 2) / Math.tan(FOV_HALF));
  const pal = {
    fog: hexRgb(palette.fog),
    seaDeep: hexRgb(palette.seaDeep),
    seaShallow: hexRgb(palette.seaShallow),
    sparkle: [191, 232, 255],
  };

  // Sky: flat bands following the course's gradient over the whole
  // frame. The sea is drawn over the lower part, tilted with the bank,
  // so painting the sky all the way down leaves no dark seam where
  // the two meet.
  fillBands(ctx, 0, 0, W, H, [
    [0, palette.skyTop],
    [0.62, palette.skyMid],
    [1, palette.skyLow],
  ], 48);

  // Sun: a glow sprite painted once at its exact size, blitted 1:1.
  const sunX = palette.sunX * W;
  const sunY = palette.sunY * H;
  const sunRgb = hexRgb(palette.sun);
  const glowSprite = radialSprite(`glow-${course.id}`, [
    [0, rgba(sunRgb, 1)],
    [0.25, rgba(sunRgb, 0.8)],
    [1, rgba(sunRgb, 0)],
  ], 380);
  ctx.drawImage(glowSprite, sunX - 190, sunY - 190);
  ctx.fillStyle = palette.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
  ctx.fill();

  // The world layer tilts with the bank; the HUD stays level.
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-cam.roll);
  ctx.translate(-W / 2, -H / 2);

  // Sea: flat bands from the horizon down, with a sun glint band.
  fillBands(ctx, -W, horizonY, W * 3, H - horizonY + W, [
    [0, palette.seaShallow],
    [0.35, palette.seaDeep],
    [1, '#06283f'],
  ], 24);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = palette.sun;
  const glintW = 130;
  for (let i = 0; i < 9; i++) {
    const y = horizonY + 14 + i * i * 3.2;
    const w = glintW * (0.4 + i * 0.22) * (0.8 + 0.2 * Math.sin(time * 1.3 + i * 2.1));
    ctx.fillRect(sunX - w / 2, y, w, 3);
  }
  ctx.restore();

  renderTerrain(ctx, W, H, view, project, horizonY, pal);
  renderRunway(ctx, view, project);
  renderRings(ctx, view, project);
  renderClouds(ctx, view, project);

  // The aircraft's shadow on the ground or sea below it.
  const ground = terrainHeight(plane.x, plane.z);
  const shadow = project(plane.x, ground + 1.5, plane.z);
  if (shadow && plane.y - ground > 4) {
    const alt = plane.y - ground;
    const s = clamp(90 / alt, 0.15, 1);
    ctx.fillStyle = `rgba(4,20,32,${0.34 * s})`;
    ctx.beginPath();
    ctx.ellipse(shadow.x, shadow.y, 30 * s * (shadow.f / shadow.depth) / 12, 10 * s * (shadow.f / shadow.depth) / 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // A soft vignette so the frame feels like a lens, not a spreadsheet.
  // Painted once per screen size to a full-res offscreen canvas — the
  // radial gradient itself is only ever rasterised that once — and
  // blitted 1:1 afterwards, which is a fast copy.
  let vigSprite = _sprites.get(`vig-${W}x${H}`);
  if (!vigSprite) {
    vigSprite = document.createElement('canvas');
    vigSprite.width = W;
    vigSprite.height = H;
    const vg = vigSprite.getContext('2d');
    const grad = vg.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
    grad.addColorStop(0, 'rgba(4,16,28,0)');
    grad.addColorStop(1, 'rgba(4,16,28,0.28)');
    vg.fillStyle = grad;
    vg.fillRect(0, 0, W, H);
    _sprites.set(`vig-${W}x${H}`, vigSprite);
  }
  ctx.drawImage(vigSprite, 0, 0);
}

// The terrain grid: rows run away from the camera, columns across it.
// Far rows are drawn first so near ground covers them. Quads fully
// outside the viewport are skipped before any colour work.
function renderTerrain(ctx, W, H, view, project, horizonY, pal) {
  const { cam, time } = view;
  const rows = 18;
  const cols = 20;
  const tanH = (W / H) * Math.tan(FOV_HALF);
  const fwdX = Math.sin(cam.heading);
  const fwdZ = Math.cos(cam.heading);
  const rightX = Math.cos(cam.heading);
  const rightZ = -Math.sin(cam.heading);

  // Depths grow geometrically so near ground gets the detail.
  const depths = [];
  for (let i = 0; i <= rows; i++) depths.push(28 * Math.pow(1500 / 28, i / rows));

  // Sample every vertex once, far row first.
  const grid = [];
  for (let r = 0; r <= rows; r++) {
    const d = depths[r];
    const half = d * tanH * 1.18;
    const row = [];
    for (let c = 0; c <= cols; c++) {
      const lat = -half + (2 * half * c) / cols;
      const wx = cam.x + fwdX * d + rightX * lat;
      const wz = cam.z + fwdZ * d + rightZ * lat;
      const h = terrainHeight(wx, wz);
      const p = project(wx, h <= 0.4 ? 0 : h, wz);
      row.push({ p, h, wx, wz, d });
    }
    grid.push(row);
  }

  for (let r = rows - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      const a = grid[r][c];
      const b = grid[r][c + 1];
      const cc = grid[r + 1][c];
      const dd = grid[r + 1][c + 1];
      if (!a.p || !b.p || !cc.p || !dd.p) continue;
      // Skip quads that cannot be seen at all.
      const minX = Math.min(a.p.x, b.p.x, cc.p.x, dd.p.x);
      const maxX = Math.max(a.p.x, b.p.x, cc.p.x, dd.p.x);
      const minY = Math.min(a.p.y, b.p.y, cc.p.y, dd.p.y);
      const maxY = Math.max(a.p.y, b.p.y, cc.p.y, dd.p.y);
      if (maxX < -40 || minX > W + 40 || maxY < -40 || minY > H + 40) continue;
      const midH = (a.h + b.h + cc.h + dd.h) / 4;
      const fogT = clamp((a.d - 120) / 1250, 0, 0.82);
      let fill;
      if (midH <= 0.4) {
        // Sea: shallow turquoise near the shore, deep blue further out,
        // with a sparkle where the sun catches a wave.
        const sparkle = Math.sin(a.wx * 0.11 + time * 2) * Math.sin(a.wz * 0.13 - time * 1.7);
        if (sparkle > 0.985) {
          fill = shadedFogged(pal.sparkle, 1, pal.fog, fogT);
        } else {
          const shallow = clamp(1 - a.d / 950, 0, 1) * 0.5 + (sparkle > 0.965 ? 0.5 : 0);
          fill = shadedFogged(shallow > 0.55 ? pal.seaShallow : pal.seaDeep, 1, pal.fog, fogT);
        }
      } else {
        const slope = Math.abs(cc.h - a.h) / 60;
        // A slow, gentle variation so the ground reads as fields and
        // hills, not a checkerboard.
        const shade = Math.sin(a.wx * 0.005 + a.wz * 0.0042);
        const s = clamp(0.88 + slope * 0.25 + shade * 0.06, 0.7, 1.1);
        fill = shadedFogged(LAND_BASE[landBand(midH)], s, pal.fog, fogT);
      }
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(a.p.x, a.p.y);
      ctx.lineTo(b.p.x, b.p.y);
      ctx.lineTo(dd.p.x, dd.p.y);
      ctx.lineTo(cc.p.x, cc.p.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// The runway: asphalt quads along the strip, white dashes down the
// middle, threshold bars at both ends, amber edge lights.
function renderRunway(ctx, view, project) {
  const { palette } = view;
  const ends = runwayEnds();
  const segs = 20;
  const half = RUNWAY.width / 2;
  // Along the strip is the heading's forward vector; across is its
  // perpendicular, so the drawn strip lines up with the flight path.
  const alongX = Math.sin(RUNWAY.heading);
  const alongZ = Math.cos(RUNWAY.heading);
  const perpX = Math.cos(RUNWAY.heading);
  const perpZ = -Math.sin(RUNWAY.heading);

  const edge = (t, side) => {
    const x = ends.start.x + alongX * RUNWAY.length * t + perpX * half * side;
    const z = ends.start.z + alongZ * RUNWAY.length * t + perpZ * half * side;
    return project(x, 9.4, z);
  };

  for (let i = 0; i < segs; i++) {
    const t0 = i / segs;
    const t1 = (i + 1) / segs;
    const a = edge(t0, -1);
    const b = edge(t0, 1);
    const c = edge(t1, 1);
    const d = edge(t1, -1);
    if (!a || !b || !c || !d) continue;
    ctx.fillStyle = i % 2 === 0 ? '#33383f' : '#363b43';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
    // Centreline dash on every other segment.
    if (i % 2 === 0) {
      const m0 = edge(t0 + 0.02, -0.06);
      const m1 = edge(t0 + 0.02, 0.06);
      const m2 = edge(t1 - 0.02, 0.06);
      const m3 = edge(t1 - 0.02, -0.06);
      if (m0 && m1 && m2 && m3) {
        ctx.fillStyle = '#e8ecf0';
        ctx.beginPath();
        ctx.moveTo(m0.x, m0.y);
        ctx.lineTo(m1.x, m1.y);
        ctx.lineTo(m2.x, m2.y);
        ctx.lineTo(m3.x, m3.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Threshold bars at both ends.
    if (i === 0 || i === segs - 1) {
      for (let k = -2; k <= 2; k++) {
        if (k === 0) continue;
        const b0 = edge(i === 0 ? 0.012 : 0.988, k * 0.16 - 0.05);
        const b1 = edge(i === 0 ? 0.012 : 0.988, k * 0.16 + 0.05);
        const b2 = edge(i === 0 ? 0.045 : 0.955, k * 0.16 + 0.05);
        const b3 = edge(i === 0 ? 0.045 : 0.955, k * 0.16 - 0.05);
        if (b0 && b1 && b2 && b3) {
          ctx.fillStyle = '#f2f5f7';
          ctx.beginPath();
          ctx.moveTo(b0.x, b0.y);
          ctx.lineTo(b1.x, b1.y);
          ctx.lineTo(b2.x, b2.y);
          ctx.lineTo(b3.x, b3.y);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }
  // Amber edge lights, every 76 metres.
  ctx.fillStyle = '#ffb347';
  for (let i = 0; i <= 10; i++) {
    for (const side of [-1, 1]) {
      const p = edge(i / 10, side * 1.04);
      if (p && p.depth < 1600) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, clamp(260 / p.depth, 1, 4), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  void palette;
}

// Target rings: the next one gold and glowing, flown ones green and
// faded, the rest cyan-white. Far rings draw first.
function renderRings(ctx, view, project) {
  const { rings, nextRing, time } = view;
  const order = rings
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const pa = project(a.r.x, a.r.y, a.r.z);
      const pb = project(b.r.x, b.r.y, b.r.z);
      return (pb ? pb.depth : 0) - (pa ? pa.depth : 0);
    });
  for (const { r, i } of order) {
    const p = project(r.x, r.y, r.z);
    if (!p || p.depth < 6 || p.depth > 2400) continue;
    const rad = (r.r * p.f) / p.depth;
    if (rad < 2) continue;
    const done = i < nextRing;
    const isNext = i === nextRing;
    const pulse = isNext ? 0.75 + 0.25 * Math.sin(time * 5) : 1;
    const col = done ? '#37d67a' : isNext ? '#ffc93c' : '#7fe7f2';
    ctx.globalAlpha = done ? 0.45 : 0.95 * pulse;
    // Glow.
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(2, rad * 0.3);
    ctx.globalAlpha *= 0.35;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
    ctx.stroke();
    // The band itself.
    ctx.globalAlpha = done ? 0.45 : 0.95 * pulse;
    ctx.lineWidth = Math.max(2, rad * 0.13);
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
    ctx.stroke();
    // The hole reads as sky through the ring.
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#06121e';
    ctx.beginPath();
    ctx.arc(p.x, p.y, rad * 0.86, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // A small beacon on top of the next ring.
    if (isNext) {
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath();
      ctx.arc(p.x, p.y - rad * 1.12, Math.max(2, rad * 0.09), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Clouds as soft billboards, drifting with the wind.
function renderClouds(ctx, view, project) {
  const { palette, time } = view;
  for (const c of CLOUDS) {
    const x = c.x + time * c.drift;
    const p = project(x, c.y, c.z);
    if (!p || p.depth < 8 || p.depth > 6000) continue;
    const s = (c.r * p.f) / p.depth;
    if (s < 4) continue;
    ctx.globalAlpha = clamp(0.8 - p.depth / 7000, 0.25, 0.8);
    ctx.fillStyle = palette.cloud;
    for (let k = 0; k < 5; k++) {
      const ox = (k - 2) * s * 0.55;
      const oy = Math.sin(k * 2.7) * s * 0.14;
      ctx.beginPath();
      ctx.ellipse(p.x + ox, p.y + oy, s * (0.62 - Math.abs(k - 2) * 0.09), s * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

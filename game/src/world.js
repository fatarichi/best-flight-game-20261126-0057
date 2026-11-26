// Coral Coast Run — the world: one archipelago on open sea.
// A heightmap of island bumps and a mountain ridge, a flattened runway
// strip on the home island, and the ring routes the courses fly.

import { RUNWAY, TUNING } from './config.js';
import { clamp, smoothstep } from './random.js';

// Each island is a gaussian bump: centre, radius, height, and a ridge
// factor that stretches it into mountains.
const ISLANDS = [
  { x: 0, z: 0, r: 1450, h: 95, ridge: 1.0 }, // home island, runway + peaks
  { x: 2400, z: -900, r: 800, h: 58, ridge: 0.7 },
  { x: -2300, z: -1300, r: 750, h: 64, ridge: 0.9 },
  { x: 2100, z: 1400, r: 650, h: 44, ridge: 0.5 },
  { x: -1900, z: 1600, r: 600, h: 38, ridge: 0.4 },
  { x: 600, z: -2100, r: 520, h: 30, ridge: 0.5 },
  { x: -600, z: 2300, r: 480, h: 26, ridge: 0.4 },
  { x: 3200, z: 300, r: 420, h: 22, ridge: 0.3 },
  { x: -3100, z: 400, r: 400, h: 24, ridge: 0.4 },
];

// Ridged noise for mountain detail: a few sines at different scales.
function ridgeNoise(x, z) {
  const a = Math.sin(x * 0.0041 + z * 0.0027) * 0.5
    + Math.sin(x * 0.0013 - z * 0.0031 + 1.7) * 0.3
    + Math.sin((x + z) * 0.009 + 4.2) * 0.2;
  return Math.max(0, a);
}

// Raw island height at a point, before the runway is flattened in.
function rawHeight(x, z) {
  let h = 0;
  for (const isl of ISLANDS) {
    const dx = x - isl.x;
    const dz = z - isl.z;
    const d2 = (dx * dx + dz * dz) / (isl.r * isl.r);
    if (d2 > 4) continue;
    const fall = Math.exp(-d2 * 1.6);
    const ridge = 1 + isl.ridge * ridgeNoise(x, z);
    h += isl.h * fall * ridge;
  }
  return h;
}

// Runway-local coordinates of a world point: along the strip in metres
// from its centre (negative = behind the threshold) and across it.
// The strip's axis is the heading's forward vector (sin h, cos h).
function runwayCoords(x, z) {
  const dx = x - RUNWAY.x;
  const dz = z - RUNWAY.z;
  const sh = Math.sin(RUNWAY.heading);
  const ch = Math.cos(RUNWAY.heading);
  return {
    along: dx * sh + dz * ch,
    across: dx * ch - dz * sh,
  };
}

// The runway sits on a flat pad: blend the terrain toward the runway
// elevation inside a rounded rectangle around the strip.
function runwayBlend(x, z) {
  const p = runwayCoords(x, z);
  const a = 1 - smoothstep((Math.abs(p.along) - RUNWAY.length * 0.5) / 220);
  const b = 1 - smoothstep((Math.abs(p.across) - RUNWAY.width * 0.5) / 170);
  return Math.max(0, a * b);
}

// Height of the ground (or 0 for the sea) at world position x, z.
export function terrainHeight(x, z) {
  const h = rawHeight(x, z);
  const blend = clamp(runwayBlend(x, z) + approachBlend(x, z), 0, 1);
  const flat = TUNING.runwayElevation;
  const mixed = h * (1 - blend) + flat * blend;
  return mixed < 0.4 ? 0 : mixed;
}

// The approach corridors: a flat valley cut through the hills on both
// ends of the strip, so a landing approach comes in over a gentle
// coastal plain instead of a cliff face. Full blend near the threshold,
// fading out about a kilometre beyond it and at the corridor's edges.
function approachBlend(x, z) {
  const p = runwayCoords(x, z);
  const out = Math.abs(p.along) - RUNWAY.length / 2;
  if (out < 0) return 0;
  const a = 1 - smoothstep((out - 250) / 900);
  const b = 1 - smoothstep((Math.abs(p.across) - 110) / 120);
  return Math.max(0, a * b);
}

// True when the point is over open water.
export function isWater(x, z) {
  return terrainHeight(x, z) <= 0.4;
}

// Runway-local coordinates of a world point: along the strip in metres
// from its centre (negative = behind the threshold) and across it.
export function runwayLocal(x, z) {
  return runwayCoords(x, z);
}

// True when the point is above the paved strip.
export function overRunway(x, z) {
  const p = runwayLocal(x, z);
  return Math.abs(p.along) <= RUNWAY.length / 2 && Math.abs(p.across) <= RUNWAY.width / 2;
}

// The strip's two ends in world coordinates, for drawing and landing checks.
export function runwayEnds() {
  const sh = Math.sin(RUNWAY.heading);
  const ch = Math.cos(RUNWAY.heading);
  const half = RUNWAY.length / 2;
  return {
    start: { x: RUNWAY.x - sh * half, z: RUNWAY.z - ch * half },
    end: { x: RUNWAY.x + sh * half, z: RUNWAY.z + ch * half },
  };
}

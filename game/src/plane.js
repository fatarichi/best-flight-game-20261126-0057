// Coral Coast Run — the flight model: throttle, pitch, roll and the
// damage and fuel that turn a sortie into decisions. Arcade physics:
// the plane chases its throttle's target speed, banks to turn, climbs
// with pitch, and sinks when it flies too slowly to stay up.

import { TUNING } from './config.js';
import { clamp } from './random.js';
import { overRunway, runwayLocal, terrainHeight } from './world.js';

export function createPlane(course) {
  return {
    x: course.start.x,
    y: course.start.y,
    z: course.start.z,
    heading: course.start.heading,
    pitch: 0,
    roll: 0,
    speed: course.start.speed,
    throttle: course.start.throttle,
    fuel: 100,
    damage: 0,
    gearDown: false,
    verticalSpeed: 0,
    ringsPassed: 0,
    score: 0,
    time: 0,
    state: 'flying', // flying | landed | crashed | ditched
    stateNote: '',
  };
}

// One physics step. `ctl` is { pitch, roll, throttle, brake } in [-1, 1]
// (throttle is a delta: +1 raises it, -1 lowers it). Returns an event
// string when something notable happened this step, else ''.
export function updatePlane(p, ctl, dt) {
  if (p.state !== 'flying') return '';
  p.time += dt;

  // Throttle: the lever moves while the key is held, then stays put.
  if (p.fuel > 0) {
    p.throttle = clamp(p.throttle + ctl.throttle * dt * 0.55, 0, 1);
  } else {
    p.throttle = Math.max(0, p.throttle - dt * 0.5);
  }

  // Speed chases the throttle's target; the brake drags it down faster.
  const target = TUNING.minSpeed + p.throttle * (TUNING.maxSpeed - TUNING.minSpeed);
  const rate = p.speed < target ? TUNING.accel : (ctl.brake ? TUNING.brakeDecel : 5);
  p.speed += clamp(target - p.speed, -rate * dt, rate * dt);

  // Bank toward the commanded roll; the turn follows the bank.
  const wantRoll = ctl.roll * TUNING.maxRoll * (0.35 + 0.65 * clamp(p.speed / 60, 0, 1));
  p.roll += clamp(wantRoll - p.roll, -TUNING.rollRate * dt, TUNING.rollRate * dt);
  p.heading += Math.sin(p.roll) * p.speed * TUNING.turnFactor * dt;
  p.heading = (p.heading + Math.PI * 2) % (Math.PI * 2);

  // Pitch toward the commanded pitch; authority fades near the stall.
  const authority = clamp((p.speed - 12) / 30, 0.15, 1);
  const wantPitch = ctl.pitch * TUNING.maxPitch * authority;
  p.pitch += clamp(wantPitch - p.pitch, -TUNING.pitchRate * dt, TUNING.pitchRate * dt);

  // Climb with pitch; sink when slow. A stalled wing drops the nose.
  const stalled = p.speed < TUNING.stallSpeed;
  let vy = Math.sin(p.pitch) * p.speed;
  if (stalled) {
    vy -= (TUNING.stallSpeed - p.speed) * 0.55;
    p.pitch += (0 - p.pitch) * dt * 0.4; // the nose drops on its own
  }
  p.verticalSpeed = vy;
  p.y += vy * dt;

  // Move forward along the heading.
  const forward = Math.cos(p.pitch) * p.speed;
  p.x += Math.sin(p.heading) * forward * dt;
  p.z += Math.cos(p.heading) * forward * dt;

  // Fuel burns with the throttle; empty means a glide, then a field.
  if (p.fuel > 0) p.fuel = Math.max(0, p.fuel - p.throttle * TUNING.fuelBurn * dt);

  // Ground and water contact.
  const ground = terrainHeight(p.x, p.z);
  const clearance = p.y - ground;
  if (clearance <= 1.5) {
    return touchDown(p, ground, vy);
  }
  if (p.y < 2) {
    p.state = 'ditched';
    p.stateNote = 'Ditched in the sea — the sortie is over.';
    return 'crash';
  }
  return stalled ? 'stall' : '';
}

// What happens when the wheels (or the belly) meet the ground.
function touchDown(p, ground, vy) {
  const onStrip = overRunway(p.x, p.z);
  const local = runwayLocal(p.x, p.z);
  // The strip can be landed from either end: measure the heading
  // against the strip's own axis, both ways round.
  const headDiff = Math.min(
    Math.abs(angleDiff(p.heading, 1.22)),
    Math.abs(angleDiff(p.heading, 1.22 + Math.PI)),
  );
  const gentle = vy > TUNING.crashDescent;
  const aligned = headDiff < 0.38;
  const slow = p.speed < TUNING.gearSpeedLimit;

  if (onStrip && gentle && aligned && slow) {
    p.y = ground + 1.5;
    p.state = 'landed';
    const quality = landingQuality(p, vy, headDiff);
    p.stateNote = quality.label;
    p.score += TUNING.landingScore + quality.bonus;
    return 'landed';
  }
  if (onStrip && gentle && aligned && !slow) {
    // Too fast: a long, rough landing that still counts.
    p.damage = Math.min(100, p.damage + 30);
    p.y = ground + 1.5;
    p.state = 'landed';
    p.stateNote = 'Rough landing — too fast, the gear took a beating.';
    p.score += TUNING.landingScore;
    return 'landed';
  }
  if (onStrip && !gentle && vy > TUNING.crashDescent * 1.6) {
    p.damage = Math.min(100, p.damage + 45);
    p.y = ground + 1.5;
    p.state = 'landed';
    p.stateNote = 'Hard landing — the airframe took damage, but you walked away.';
    p.score += TUNING.landingScore;
    return 'landed';
  }
  p.state = ground <= 0.4 ? 'ditched' : 'crashed';
  p.stateNote = ground <= 0.4
    ? 'Into the sea — the sortie is over.'
    : 'Terrain strike — the sortie is over.';
  return 'crash';
}

// Smallest absolute difference between two headings, in radians.
function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Landing quality: a gentle, centred, well-aligned touchdown pays best.
function landingQuality(p, vy, headDiff) {
  const local = runwayLocal(p.x, p.z);
  const centre = 1 - Math.min(1, Math.abs(local.across) / 15);
  const soft = 1 - Math.min(1, Math.abs(vy) / 4.5);
  const straight = 1 - Math.min(1, headDiff / 0.38);
  const q = centre * 0.35 + soft * 0.4 + straight * 0.25;
  const bonus = Math.round(q * TUNING.maxLandingBonus);
  if (q > 0.85) return { label: 'Greased it — a textbook landing.', bonus };
  if (q > 0.6) return { label: 'Good landing — solid and steady.', bonus };
  return { label: 'Down in one piece — a landing is a landing.', bonus };
}

// Ring pass: the plane crossed the ring's plane inside its radius.
export function ringPassed(plane, ring, prevSide) {
  const dx = plane.x - ring.x;
  const dy = plane.y - ring.y;
  const dz = plane.z - ring.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  // The ring faces the course flow; approximate its plane normal from the
  // direction to the next ring — here we use the radial distance only,
  // gated by the crossing of the ring's centre plane (z of the ring).
  const side = Math.sign(dz) || 1;
  const crossed = prevSide !== 0 && side !== prevSide;
  return { passed: crossed && dist < ring.r, side, dist };
}

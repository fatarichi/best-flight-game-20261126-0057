// Coral Coast Run — screenshot staging: ?shot=cover|rings|landing|menu
// drops the aircraft into a composed, good-looking moment and holds
// it there, so a screenshot is a real render of the game's own code.

import { COURSES } from './config.js';
import { clamp } from './random.js';

// Returns { courseIndex, stage } — the staged state is applied to the
// game by main.js. `stage` is 'menu' | 'fly' and the plane is placed
// by stagePlane below.
export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  const courseIndex = clamp(parseInt(q.get('course') ?? '0', 10) || 0, 0, COURSES.length - 1);
  return { shot, courseIndex };
}

// Place the plane for a named shot. The sim is paused straight after
// staging, so the frame stays exactly as composed.
export function stagePlane(shot, plane, course) {
  const rings = course.rings;
  if (shot === 'rings') {
    // Just behind ring 3, lined up on it, the next ring gold ahead.
    const r = rings[2];
    const prev = rings[1];
    const dx = r.x - prev.x;
    const dz = r.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    plane.x = r.x - (dx / len) * 210;
    plane.z = r.z - (dz / len) * 210;
    plane.y = r.y - 25;
    // Aim a touch off the ring so the whole ring stays visible
    // beside the jet instead of hiding behind it.
    plane.heading = Math.atan2(dx, dz) + 0.14;
    plane.pitch = 0;
    plane.roll = 0.06;
    plane.speed = 62;
    plane.throttle = 0.66;
    plane.ringsPassed = 2;
  } else if (shot === 'landing') {
    // Short final: gear down, lined up on the strip, the threshold
    // close ahead so the whole strip reads in the frame.
    const h = 1.22;
    plane.x = -Math.sin(h) * 550;
    plane.z = -Math.cos(h) * 550;
    plane.y = 48;
    // A touch of crab angle, so the strip reads beside the jet
    // instead of hiding directly behind it.
    plane.heading = h + 0.12;
    plane.pitch = -0.05;
    plane.roll = 0;
    plane.speed = 44;
    plane.throttle = 0.3;
    plane.gearDown = true;
    plane.ringsPassed = rings.length;
  } else {
    // Cover: on the approach to ring 3, close enough that the ring
    // reads big and gold ahead of the nose, the plane a touch below
    // it so the ring sits in the sky, and the home island with its
    // runway in the distance beyond it.
    const r = rings[2];
    const prev = rings[1];
    const dx = r.x - prev.x;
    const dz = r.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    plane.x = r.x - (dx / len) * 380;
    plane.z = r.z - (dz / len) * 380;
    plane.y = r.y - 40;
    // Aim a touch off the ring so it sits up and to the side of the
    // jet, fully visible, instead of hiding behind it.
    plane.heading = Math.atan2(dx, dz) + 0.18;
    plane.pitch = -0.02;
    plane.roll = 0.1;
    plane.speed = 60;
    plane.throttle = 0.64;
    plane.ringsPassed = 2;
  }
  plane.state = 'flying';
  plane.fuel = 88;
  plane.damage = 0;
  plane.score = plane.ringsPassed * 1000;
  plane.time = plane.ringsPassed * 24;
  plane.verticalSpeed = 0;
}

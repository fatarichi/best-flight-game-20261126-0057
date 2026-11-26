// Coral Coast Run — the game itself: the loop, the state machine
// (menu, flying, paused, debrief), ring detection, scoring and the
// best scores. Everything else is a module with one clear job.

import { COURSES, TUNING } from './config.js';
import { clamp } from './random.js';
import { createPlane, updatePlane } from './plane.js';
import { buildCamera, renderScene } from './render.js';
import { drawAircraft } from './aircraft.js';
import { drawDebrief, drawHud, drawMenu } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { parseShot, stagePlane } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = createInput(canvas);
const audio = createAudio();

let W = 1280;
let H = 720;
let dpr = 1;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// The ring's facing: each ring looks along the course, toward the
// next ring, so a pass means crossing its plane inside its radius.
function ringNormal(rings, i) {
  const a = rings[Math.max(0, i - 1)];
  const b = rings[Math.min(rings.length - 1, i + 1)];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  return { x: dx / len, y: dy / len, z: dz / len };
}

const game = {
  state: 'menu', // menu | flying | paused | over
  courseIndex: 0,
  course: COURSES[0],
  plane: null,
  ringNormals: [],
  prevDot: 0,
  messages: [],
  time: 0,
  shot: null,
  best: loadBest(),
};

function loadBest() {
  const best = {};
  try {
    for (const c of COURSES) {
      const v = localStorage.getItem(`ccr-best-${c.id}`);
      if (v !== null) best[c.id] = parseInt(v, 10);
    }
  } catch {
    // Private mode: no best scores, no problem.
  }
  return best;
}

function saveBest() {
  try {
    const id = game.course.id;
    const cur = game.best[id];
    if (cur === undefined || game.plane.score > cur) {
      game.best[id] = game.plane.score;
      localStorage.setItem(`ccr-best-${id}`, String(game.plane.score));
    }
  } catch {
    // Private mode: skip.
  }
}

function startCourse(index) {
  game.courseIndex = index;
  game.course = COURSES[index];
  game.plane = createPlane(game.course);
  game.ringNormals = game.course.rings.map((_, i) => ringNormal(game.course.rings, i));
  game.prevDot = dotToRing(0);
  game.messages = [{ text: `${game.course.name} — fly the rings, then land`, until: 5, big: true }];
  game.state = 'flying';
  game.time = 0;
  audio.unlock();
}

function dotToRing(i) {
  const p = game.plane;
  const r = game.course.rings[i];
  const n = game.ringNormals[i];
  return (p.x - r.x) * n.x + (p.y - r.y) * n.y + (p.z - r.z) * n.z;
}

function toast(text, seconds = 2.2, color = '#ffffff', big = false) {
  game.messages.push({ text, until: game.time + seconds, color, big });
}

function checkRings() {
  const p = game.plane;
  const i = p.ringsPassed;
  if (i >= game.course.rings.length) return;
  const r = game.course.rings[i];
  const d = dotToRing(i);
  const dist = Math.hypot(p.x - r.x, p.y - r.y, p.z - r.z);
  const crossed = game.prevDot < 0 && d >= 0;
  if (crossed && dist < r.r) {
    p.ringsPassed += 1;
    p.score += TUNING.ringScore;
    p.fuel = Math.min(100, p.fuel + TUNING.fuelRingBonus);
    audio.chime();
    toast(`RING ${p.ringsPassed}/${game.course.rings.length}  +${TUNING.ringScore}   +${TUNING.fuelRingBonus}% FUEL`, 2.4, '#ffc93c', true);
    if (p.ringsPassed === game.course.rings.length) {
      toast('ALL RINGS — LAND ON THE RUNWAY', 4, '#37d67a', true);
    }
  }
  game.prevDot = d;
}

function update(dt) {
  const ctl = input.read();
  if (ctl.mute) audio.toggle();

  if (game.state === 'menu') {
    game.time += dt; // the menu backdrop drifts over the island
    if (ctl.digit >= 0) game.courseIndex = ctl.digit;
    if (ctl.confirm || ctl.clicked) startCourse(game.courseIndex);
    return;
  }

  if (game.state === 'over') {
    game.time += dt; // the world keeps drifting behind the debrief
    if (ctl.confirm || ctl.clicked) startCourse(game.courseIndex);
    if (ctl.escape) game.state = 'menu';
    return;
  }

  if (game.state === 'paused') {
    if (ctl.pause || ctl.escape) game.state = 'flying';
    return;
  }

  // Flying.
  if (ctl.pause) {
    game.state = 'paused';
    return;
  }
  if (ctl.escape) {
    game.state = 'menu';
    return;
  }
  if (ctl.gear) {
    game.plane.gearDown = !game.plane.gearDown;
    toast(game.plane.gearDown ? 'GEAR DOWN' : 'GEAR UP', 1.2, '#8cd2ff');
  }

  game.time += dt;
  const p = game.plane;
  const event = updatePlane(p, ctl, dt);
  checkRings();
  audio.update(p, true);

  if (event === 'landed') {
    audio.thud();
    saveBest();
    game.state = 'over';
  } else if (event === 'crash') {
    audio.thud();
    saveBest();
    game.state = 'over';
  }
}

function render() {
  const p = game.plane;
  const course = game.course;
  ctx.clearRect(0, 0, W, H);

  if (game.state === 'menu') {
    // A slow drift over the home island behind the menu.
    const t = game.time;
    const cam = {
      x: Math.sin(t * 0.02) * 900,
      y: 420,
      z: -1600 + Math.cos(t * 0.02) * 600,
      heading: 0.5,
      pitch: 0.02,
      roll: 0,
    };
    renderScene(ctx, W, H, {
      cam, plane: { x: 0, y: 420, z: 0, throttle: 0 }, course,
      palette: course.palette, rings: course.rings, nextRing: 0, time: t,
    });
    drawMenu(ctx, W, H, COURSES, game.courseIndex, game.best);
    return;
  }

  const cam = buildCamera(p);
  // A projector for HUD elements that need to find a ring on screen.
  const f = (H / 2) / Math.tan((35 * Math.PI) / 180);
  const sh = Math.sin(cam.heading);
  const ch = Math.cos(cam.heading);
  const sp = Math.sin(cam.pitch);
  const cp = Math.cos(cam.pitch);
  const project = (x, y, z) => {
    const dx = x - cam.x;
    const dy = y - cam.y;
    const dz = z - cam.z;
    const depth = dx * sh * cp + dy * sp + dz * ch * cp;
    if (depth < 2) return null;
    const right = dx * ch - dz * sh;
    const up = dx * -sh * sp + dy * cp + dz * -ch * sp;
    return { x: W / 2 + (right * f) / depth, y: H / 2 - (up * f) / depth, depth, f };
  };

  const view = {
    cam, plane: p, course, palette: course.palette,
    rings: course.rings, nextRing: p.ringsPassed, time: game.time, project,
    messages: game.messages,
  };
  renderScene(ctx, W, H, view);

  // The jet, centre-frame, banking with the roll.
  const size = clamp(W * 0.17, 130, 230);
  drawAircraft(ctx, W / 2, H * 0.56, size, p.roll, p.throttle, game.time);

  // Speed streaks when the air is really moving.
  if (p.speed > 74 && game.state === 'flying') {
    const a = clamp((p.speed - 74) / 40, 0, 0.5);
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 + game.time * 0.4;
      const r0 = H * 0.42;
      const r1 = r0 + 26 + (i % 3) * 14;
      ctx.beginPath();
      ctx.moveTo(W / 2 + Math.cos(ang) * r0, H / 2 + Math.sin(ang) * r0);
      ctx.lineTo(W / 2 + Math.cos(ang) * r1, H / 2 + Math.sin(ang) * r1);
      ctx.stroke();
    }
  }

  drawHud(ctx, W, H, view);

  if (game.state === 'paused') {
    ctx.fillStyle = 'rgba(4,14,26,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.font = `44px ${'"Segoe UI", Arial, sans-serif'}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('PAUSED', W / 2, H / 2 - 10);
    ctx.font = '16px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#bfe3ff';
    ctx.fillText('P — resume      ESC — menu', W / 2, H / 2 + 24);
  }

  if (game.state === 'over') {
    drawDebrief(ctx, W, H, p, course, {
      rings: course.rings.length,
      best: game.best[course.id] ?? null,
    });
  }
}

// The main loop: fixed physics steps, one render per frame.
let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (game.shot) {
    // Staged screenshot: one composed frame, then hold it.
    render();
    window.__shotReady = true;
    return;
  }
  acc += dt;
  while (acc >= 1 / 60) {
    update(1 / 60);
    acc -= 1 / 60;
  }
  render();
  requestAnimationFrame(frame);
}

// --- Screenshot staging ---------------------------------------------------
const shot = parseShot();
if (shot) {
  // Staged shots are clean frames: no control hint bar.
  const hint = document.getElementById('hint');
  if (hint) hint.style.display = 'none';
  game.shot = shot;
  if (shot.shot === 'menu') {
    game.state = 'menu';
    game.time = 14;
  } else {
    startCourse(shot.courseIndex);
    stagePlane(shot.shot, game.plane, game.course);
    if (game.plane.ringsPassed < game.course.rings.length) {
      game.prevDot = dotToRing(game.plane.ringsPassed);
    } else {
      game.prevDot = 0; // all rings done — nothing left to cross
    }
    game.time = 12;
    // A toast would cover the frame; keep staged shots clean.
    game.messages = [];
  }
  // One frame is enough; the screenshot tool waits for __shotReady.
  requestAnimationFrame(frame);
} else {
  requestAnimationFrame(frame);
}

// A hook for scripted play-testing: drive the game from the console.
window.__game = {
  game,
  startCourse,
  courses: COURSES,
  TUNING,
};

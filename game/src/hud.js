// Coral Coast Run — the HUD and the screens around the flight:
// instruments, compass, attitude ball, gauges, minimap, messages,
// the course menu and the debrief after a landing or a crash.

import { clamp, lerp } from './random.js';

const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
const MONO = '"SF Mono", "Cascadia Mono", Consolas, monospace';

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(6,18,30,${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,210,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function label(ctx, text, x, y, size, color, font = FONT, align = 'left') {
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

// --- The in-flight instruments -------------------------------------------

export function drawHud(ctx, W, H, view) {
  const { plane, course, rings, nextRing, messages, time } = view;
  const pad = 16;

  // Top-left: altitude, speed, heading.
  panel(ctx, pad, pad, 208, 78);
  label(ctx, 'ALT', pad + 12, pad + 18, 11, '#8cd2ff');
  label(ctx, `${Math.max(0, Math.round(plane.y))} m`, pad + 12, pad + 42, 22, '#ffffff', MONO);
  label(ctx, 'SPD', pad + 112, pad + 18, 11, '#8cd2ff');
  label(ctx, `${Math.round(plane.speed * 3.6)}`, pad + 112, pad + 42, 22, '#ffffff', MONO);
  label(ctx, 'km/h', pad + 158, pad + 42, 11, '#8cd2ff');
  label(ctx, 'HDG', pad + 12, pad + 68, 11, '#8cd2ff');
  label(ctx, `${String(Math.round(((plane.heading * 180) / Math.PI) % 360 + 360) % 360).padStart(3, '0')}°`, pad + 52, pad + 68, 14, '#ffe9a8', MONO);
  label(ctx, plane.gearDown ? 'GEAR DOWN' : 'GEAR UP', pad + 118, pad + 68, 11, plane.gearDown ? '#37d67a' : '#8cd2ff');

  drawCompass(ctx, W, plane.heading);
  drawAttitude(ctx, W, plane);

  // Top-right: throttle, fuel, damage — name on the left, bar on the right.
  const gx = W - pad - 190;
  panel(ctx, gx, pad, 190, 78);
  gauge(ctx, gx + 12, pad + 16, 126, 10, plane.throttle, '#ffc93c', 'THR');
  gauge(ctx, gx + 12, pad + 38, 126, 10, plane.fuel / 100, plane.fuel < 25 ? '#ff5a4d' : '#37d67a', 'FUEL');
  gauge(ctx, gx + 12, pad + 60, 126, 10, plane.damage / 100, '#ff8a5c', 'DMG');

  // Bottom-left: the sortie and the next ring.
  panel(ctx, pad, H - pad - 66, 290, 66);
  label(ctx, course.name.toUpperCase(), pad + 12, H - pad - 42, 13, '#ffffff');
  label(ctx, `RINGS ${plane.ringsPassed}/${rings.length}`, pad + 12, H - pad - 18, 15, '#ffe9a8', MONO);
  if (nextRing < rings.length) {
    const r = rings[nextRing];
    const d = Math.hypot(r.x - plane.x, r.y - plane.y, r.z - plane.z);
    label(ctx, `NEXT ${Math.round(d)} m`, pad + 150, H - pad - 18, 13, '#7fe7f2', MONO);
  } else {
    label(ctx, 'ALL RINGS — LAND!', pad + 150, H - pad - 18, 13, '#37d67a', MONO);
  }

  drawMinimap(ctx, W, H, view);
  drawOffscreenArrow(ctx, W, H, view);
  drawToasts(ctx, W, H, messages, time);
  drawWarnings(ctx, W, H, view);
}

function gauge(ctx, x, y, w, h, frac, color, name) {
  label(ctx, name, x, y + h - 1, 10, '#cfe9ff');
  const bx = x + 40;
  const bw = w - 40;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.roundRect(bx, y, bw, h, 4);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(bx, y, Math.max(2, bw * clamp(frac, 0, 1)), h, 4);
  ctx.fill();
}

function drawCompass(ctx, W, headingDeg) {
  const cx = W / 2;
  const y = 30;
  const half = 130;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - half, y - 16, half * 2, 30);
  ctx.clip();
  const deg = ((headingDeg * 180) / Math.PI % 360 + 360) % 360;
  for (let d = -180; d <= 180; d += 10) {
    const a = ((deg + d) % 360 + 360) % 360;
    const x = cx + d * 1.15;
    const major = a % 45 === 0;
    const mid = a % 15 === 0;
    ctx.strokeStyle = major ? '#ffffff' : 'rgba(200,230,255,0.5)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.lineTo(x, y + (major ? -4 : mid ? 0 : 4));
    ctx.stroke();
    if (major) {
      const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
      label(ctx, names[a] ?? String(a), x, y - 8, 11, '#ffffff', MONO, 'center');
    }
  }
  ctx.restore();
  // Centre caret.
  ctx.fillStyle = '#ffc93c';
  ctx.beginPath();
  ctx.moveTo(cx - 6, y + 12);
  ctx.lineTo(cx + 6, y + 12);
  ctx.lineTo(cx, y + 19);
  ctx.closePath();
  ctx.fill();
}

function drawAttitude(ctx, W, plane) {
  const cx = W / 2;
  const cy = 96;
  const r = 34;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll);
  const pitchPx = clamp(plane.pitch, -0.6, 0.6) * 70;
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-r - 2, -r - 2 - pitchPx, r * 2 + 4, r + 2 + pitchPx);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(-r - 2, pitchPx, r * 2 + 4, r + 2 - pitchPx + 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, -pitchPx);
  ctx.lineTo(r, -pitchPx);
  ctx.stroke();
  ctx.restore();
  // Fixed wings marker and rim.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffc93c';
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy);
  ctx.lineTo(cx + 5, cy);
  ctx.lineTo(cx, cy + 5);
  ctx.closePath();
  ctx.fill();
}

function drawMinimap(ctx, W, H, view) {
  const { plane, rings, nextRing } = view;
  const mw = 168;
  const mh = 118;
  const x0 = W - 16 - mw;
  const y0 = H - 16 - mh;
  panel(ctx, x0, y0, mw, mh, 0.5);
  const scale = mw / 6400;
  const toMap = (x, z) => [x0 + mw / 2 + x * scale, y0 + mh / 2 + z * scale];
  // Schematic islands.
  ctx.fillStyle = 'rgba(120,200,150,0.5)';
  for (const [ix, iz, ir] of [[0, 0, 1450], [2400, -900, 800], [-2300, -1300, 750], [2100, 1400, 650], [-1900, 1600, 600]]) {
    const [mx, my] = toMap(ix, iz);
    ctx.beginPath();
    ctx.ellipse(mx, my, ir * scale, ir * scale * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Runway.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  const [rx1, ry1] = toMap(-Math.sin(1.22) * 380, -Math.cos(1.22) * 380);
  const [rx2, ry2] = toMap(Math.sin(1.22) * 380, Math.cos(1.22) * 380);
  ctx.beginPath();
  ctx.moveTo(rx1, ry1);
  ctx.lineTo(rx2, ry2);
  ctx.stroke();
  // Rings.
  rings.forEach((r, i) => {
    const [mx, my] = toMap(r.x, r.z);
    ctx.fillStyle = i < nextRing ? '#37d67a' : i === nextRing ? '#ffc93c' : 'rgba(127,231,242,0.8)';
    ctx.beginPath();
    ctx.arc(mx, my, i === nextRing ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
  });
  // The aircraft.
  const [px, py] = toMap(plane.x, plane.z);
  ctx.save();
  ctx.translate(px, py);
  // The nose starts pointing up the map (-z); rotate it onto the heading.
  ctx.rotate(Math.PI - plane.heading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(4, 5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawOffscreenArrow(ctx, W, H, view) {
  const { plane, rings, nextRing, project } = view;
  if (nextRing >= rings.length || !project) return;
  const r = rings[nextRing];
  const p = project(r.x, r.y, r.z);
  if (!p) return;
  const onScreen = p.x > 40 && p.x < W - 40 && p.y > 40 && p.y < H - 40 && p.depth > 0;
  if (onScreen) return;
  const cx = W / 2;
  const cy = H / 2 - 40;
  const ang = Math.atan2(p.y - cy, p.x - cx);
  const ax = cx + Math.cos(ang) * 190;
  const ay = cy + Math.sin(ang) * 130;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffc93c';
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-10, -9);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawToasts(ctx, W, H, messages, time) {
  let y = H * 0.24;
  for (const m of messages) {
    const left = m.until - time;
    if (left <= 0) continue;
    ctx.globalAlpha = clamp(left / 0.6, 0, 1);
    label(ctx, m.text, W / 2, y, m.big ? 26 : 19, m.color ?? '#ffffff', m.big ? FONT : MONO, 'center');
    ctx.globalAlpha = 1;
    y += m.big ? 36 : 28;
  }
}

function drawWarnings(ctx, W, H, view) {
  const { plane } = view;
  const warns = [];
  if (plane.speed < 27 && plane.state === 'flying') warns.push(['STALL — PUSH THE NOSE DOWN', '#ff5a4d']);
  if (plane.fuel < 25 && plane.fuel > 0) warns.push(['LOW FUEL — FLY THE RINGS', '#ffb347']);
  if (plane.fuel <= 0) warns.push(['FUEL EMPTY — GLIDING', '#ff5a4d']);
  if (plane.verticalSpeed < -6 && plane.y < 120) warns.push(['PULL UP', '#ff5a4d']);
  if (!plane.gearDown && plane.y < 90 && plane.state === 'flying') warns.push(['GEAR UP — PRESS G TO LOWER', '#8cd2ff']);
  warns.forEach(([text, color], i) => {
    const blink = 0.65 + 0.35 * Math.sin(view.time * 6);
    ctx.globalAlpha = blink;
    label(ctx, text, W / 2, H * 0.62 + i * 26, 18, color, MONO, 'center');
    ctx.globalAlpha = 1;
  });
}

// --- Menu and debrief -----------------------------------------------------

export function drawMenu(ctx, W, H, courses, selected, best) {
  ctx.fillStyle = 'rgba(4,14,26,0.55)';
  ctx.fillRect(0, 0, W, H);
  label(ctx, 'CORAL COAST RUN', W / 2, H * 0.2, 52, '#ffffff', FONT, 'center');
  label(ctx, 'A chase-view flight game — rings, fuel, and one runway home', W / 2, H * 0.2 + 34, 17, '#bfe3ff', FONT, 'center');

  const cw = 300;
  const ch = 150;
  const gap = 24;
  const x0 = W / 2 - (cw * 3 + gap * 2) / 2;
  const y0 = H * 0.32;
  courses.forEach((c, i) => {
    const x = x0 + i * (cw + gap);
    const sel = i === selected;
    ctx.fillStyle = sel ? 'rgba(20,60,96,0.92)' : 'rgba(8,26,44,0.85)';
    ctx.beginPath();
    ctx.roundRect(x, y0, cw, ch, 12);
    ctx.fill();
    ctx.strokeStyle = sel ? '#ffc93c' : 'rgba(140,210,255,0.4)';
    ctx.lineWidth = sel ? 3 : 1;
    ctx.stroke();
    label(ctx, c.name.toUpperCase(), x + 18, y0 + 34, 20, '#ffffff');
    label(ctx, c.sub, x + 18, y0 + 60, 13, '#bfe3ff');
    label(ctx, `Difficulty: ${c.difficulty}`, x + 18, y0 + 86, 13, '#ffe9a8');
    const b = best[c.id];
    label(ctx, b ? `Best score: ${b.toLocaleString()}` : 'Not flown yet', x + 18, y0 + 114, 13, b ? '#37d67a' : '#8cd2ff');
    if (sel) label(ctx, '▶ SELECTED — PRESS ENTER', x + 18, y0 + ch - 16, 12, '#ffc93c');
  });

  const cy = y0 + ch + 52;
  label(ctx, 'FLY IT', W / 2, cy, 18, '#ffffff', FONT, 'center');
  const lines = [
    'W / S — pitch up and down      A / D — bank and turn',
    'R / F — throttle up and down      SPACE — airbrake',
    'G — landing gear      M — sound      P — pause',
    'Mouse — steer toward the cursor      Click — start',
    'Fly every ring, mind the fuel, and land on the runway.',
  ];
  lines.forEach((l, i) => label(ctx, l, W / 2, cy + 28 + i * 22, 14, '#cfe9ff', FONT, 'center'));
  label(ctx, '1 / 2 / 3 — pick a course      ENTER — fly', W / 2, cy + 28 + lines.length * 22 + 12, 14, '#ffe9a8', MONO, 'center');
}

export function drawDebrief(ctx, W, H, plane, course, stats) {
  ctx.fillStyle = 'rgba(4,14,26,0.62)';
  ctx.fillRect(0, 0, W, H);
  const landed = plane.state === 'landed';
  label(ctx, landed ? 'SORTIE COMPLETE' : 'SORTIE OVER', W / 2, H * 0.26, 44, landed ? '#37d67a' : '#ff5a4d', FONT, 'center');
  label(ctx, plane.stateNote, W / 2, H * 0.26 + 36, 17, '#ffffff', FONT, 'center');
  label(ctx, course.name, W / 2, H * 0.26 + 62, 15, '#bfe3ff', FONT, 'center');

  const rows = [
    ['Rings flown', `${plane.ringsPassed} / ${stats.rings}`],
    ['Score', plane.score.toLocaleString()],
    ['Time', `${Math.floor(plane.time / 60)}:${String(Math.floor(plane.time % 60)).padStart(2, '0')}`],
    ['Fuel left', `${Math.round(plane.fuel)}%`],
    ['Damage', `${Math.round(plane.damage)}%`],
  ];
  if (stats.best !== null) rows.push(['Best on this course', stats.best.toLocaleString()]);
  const y0 = H * 0.4;
  rows.forEach(([k, v], i) => {
    label(ctx, k, W / 2 - 130, y0 + i * 30, 16, '#8cd2ff');
    label(ctx, v, W / 2 + 130, y0 + i * 30, 16, '#ffffff', MONO, 'right');
  });
  label(ctx, 'ENTER — fly again      M — menu', W / 2, y0 + rows.length * 30 + 30, 15, '#ffe9a8', MONO, 'center');
}

export { lerp };

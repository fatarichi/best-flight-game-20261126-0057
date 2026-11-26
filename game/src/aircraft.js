// Coral Coast Run — the aircraft, drawn in screen space as a chase
// view: a sleek twin-tail jet seen from behind and above, banking
// with the roll, its canopy catching the light and its exhaust
// glowing with the throttle.

import { clamp } from './random.js';

// Draw the jet centred on (cx, cy), nose pointing up-screen.
// roll tilts it; throttle drives the exhaust flame; size is in pixels.
export function drawAircraft(ctx, cx, cy, size, roll, throttle, time) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(roll);
  ctx.scale(size / 100, size / 100);

  // Exhaust glow, flickering with the throttle.
  const flame = 10 + throttle * 26 * (0.85 + 0.15 * Math.sin(time * 31));
  const grad = ctx.createLinearGradient(0, 34, 0, 34 + flame);
  grad.addColorStop(0, 'rgba(255,214,120,0.95)');
  grad.addColorStop(0.5, 'rgba(255,122,40,0.75)');
  grad.addColorStop(1, 'rgba(255,80,20,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-7, 32);
  ctx.lineTo(0, 34 + flame);
  ctx.lineTo(7, 32);
  ctx.closePath();
  ctx.fill();

  // Main wings, swept back, with a darker underside edge.
  ctx.fillStyle = '#8fa3b5';
  ctx.beginPath();
  ctx.moveTo(-8, -6);
  ctx.lineTo(-62, 26);
  ctx.lineTo(-58, 33);
  ctx.lineTo(-6, 12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(8, -6);
  ctx.lineTo(62, 26);
  ctx.lineTo(58, 33);
  ctx.lineTo(6, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5d7080';
  ctx.beginPath();
  ctx.moveTo(-62, 26);
  ctx.lineTo(-58, 33);
  ctx.lineTo(-6, 12);
  ctx.lineTo(-10, 8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(62, 26);
  ctx.lineTo(58, 33);
  ctx.lineTo(6, 12);
  ctx.lineTo(10, 8);
  ctx.closePath();
  ctx.fill();

  // Tailplanes and twin tail fins.
  ctx.fillStyle = '#7d93a8';
  ctx.beginPath();
  ctx.moveTo(-6, 22);
  ctx.lineTo(-26, 38);
  ctx.lineTo(-22, 42);
  ctx.lineTo(-2, 30);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(6, 22);
  ctx.lineTo(26, 38);
  ctx.lineTo(22, 42);
  ctx.lineTo(2, 30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#aebfce';
  ctx.beginPath();
  ctx.moveTo(-9, 18);
  ctx.lineTo(-16, -2);
  ctx.lineTo(-10, -4);
  ctx.lineTo(-3, 16);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(9, 18);
  ctx.lineTo(16, -2);
  ctx.lineTo(10, -4);
  ctx.lineTo(3, 16);
  ctx.closePath();
  ctx.fill();

  // Fuselage: a tapered body, light on top, darker below.
  const body = ctx.createLinearGradient(0, -52, 0, 40);
  body.addColorStop(0, '#e8eef4');
  body.addColorStop(0.55, '#c3d2de');
  body.addColorStop(1, '#7d93a8');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, -54);
  ctx.bezierCurveTo(7, -40, 9, -12, 8, 14);
  ctx.bezierCurveTo(8, 28, 5, 38, 0, 40);
  ctx.bezierCurveTo(-5, 38, -8, 28, -8, 14);
  ctx.bezierCurveTo(-9, -12, -7, -40, 0, -54);
  ctx.closePath();
  ctx.fill();

  // Canopy: a glass bubble catching the sky.
  const glass = ctx.createLinearGradient(0, -46, 0, -18);
  glass.addColorStop(0, '#bfe6ff');
  glass.addColorStop(0.5, '#5aa7d6');
  glass.addColorStop(1, '#1d4d6e');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.moveTo(0, -48);
  ctx.bezierCurveTo(5, -40, 5.5, -26, 3.5, -16);
  ctx.bezierCurveTo(1.5, -12, -1.5, -12, -3.5, -16);
  ctx.bezierCurveTo(-5.5, -26, -5, -40, 0, -48);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-3, -44);
  ctx.quadraticCurveTo(0, -34, 2, -24);
  ctx.stroke();

  // Wingtip navigation lights: red left, green right.
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.arc(-60, 29, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#37e07a';
  ctx.beginPath();
  ctx.arc(60, 29, 2.6, 0, Math.PI * 2);
  ctx.fill();

  // Panel line down the spine.
  ctx.strokeStyle = 'rgba(40,60,80,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(0, 36);
  ctx.stroke();

  ctx.restore();

  // A faint heat shimmer ring behind the exhaust, throttle permitting.
  if (throttle > 0.25) {
    ctx.save();
    ctx.globalAlpha = clamp((throttle - 0.25) * 0.5, 0, 0.4);
    ctx.strokeStyle = '#ffd678';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy + size * 0.42, size * 0.1 * (1 + 0.08 * Math.sin(time * 23)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

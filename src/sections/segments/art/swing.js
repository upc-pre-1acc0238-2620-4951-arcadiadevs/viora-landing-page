import { easeInOut, palette, roundRect, span } from '@/effects/art/canvas.js';

const LOOP = 8;
const GAP = 36;
const BASE = 212;
const MEAN = 62;
const SWING = 34;
const SPEED = 16;

/**
 * One year too much, the next too little: harvest bars march across the
 * circle, ON year / OFF year, then the swing settles into even seasons —
 * Viora smoothing out the alternate bearing — with an olive riding the line.
 */
export function drawSwing(ctx, seconds) {
  const t = (seconds % LOOP) / LOOP;
  const cx = 150;
  const cy = 150;
  const radius = 124;
  const calm = easeInOut(span(t, 0.3, 0.62)) * (1 - easeInOut(span(t, 0.86, 1)));
  const amplitude = SWING * (1 - calm) * (1 + Math.sin(seconds * 1.7) * 0.08);

  ctx.fillStyle = palette.forest;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
  ctx.clip();

  // Faint year guides.
  ctx.strokeStyle = 'rgb(243 240 234 / 10%)';
  ctx.lineWidth = 1;
  for (let y = BASE - 20; y > 70; y -= 26) {
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(280, y);
    ctx.stroke();
  }

  // Bars scroll left; parity follows each bar, so a year keeps its ON/OFF.
  const shift = (seconds * SPEED) % (GAP * 2);
  const first = -2;
  const tops = [];
  for (let slot = first; slot < 10; slot += 1) {
    const x = 18 + slot * GAP - shift;
    const year = slot + Math.floor((seconds * SPEED) / (GAP * 2)) * 2;
    const on = year % 2 === 0;
    const height = MEAN + (on ? amplitude : -amplitude);
    tops.push([x, BASE - height]);
    ctx.fillStyle = on ? palette.harvest : `rgb(232 185 35 / ${0.45 + calm * 0.55})`;
    roundRect(ctx, x - 10, BASE - height, 20, height, 6);
    ctx.fill();
  }

  // The line through the bar tops, smoothed with midpoint curves.
  const line = new Path2D();
  line.moveTo(tops[0][0], tops[0][1] - 12);
  for (let i = 1; i < tops.length - 1; i += 1) {
    const [x, y] = tops[i];
    const [nx, ny] = tops[i + 1];
    line.quadraticCurveTo(x, y - 12, (x + nx) / 2, (y + ny) / 2 - 12);
  }
  ctx.strokeStyle = palette.cream;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.stroke(line);

  // The olive rides the line at the centre of the circle.
  const along = tops.findIndex(([x]) => x > cx);
  const [ax, ay] = tops[along - 1];
  const [bx, by] = tops[along];
  const local = (cx - ax) / (bx - ax);
  const oliveY = ay + (by - ay) * (0.5 - Math.cos(local * Math.PI) / 2) - 22;
  ctx.save();
  ctx.translate(cx, oliveY);
  ctx.rotate(Math.atan2(by - ay, bx - ax) * 0.5 - 0.3);
  ctx.fillStyle = palette.olive;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgb(255 255 255 / 45%)';
  ctx.beginPath();
  ctx.ellipse(-4, -3, 3.4, 2, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = palette.forestDeep;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, -5);
  ctx.quadraticCurveTo(12, -11, 16, -12);
  ctx.stroke();
  ctx.restore();

  // Ground.
  ctx.fillStyle = palette.cream;
  ctx.fillRect(20, BASE, 260, 2);
  ctx.restore();
}

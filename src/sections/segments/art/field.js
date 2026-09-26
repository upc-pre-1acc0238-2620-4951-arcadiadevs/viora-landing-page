import {
  easeInOut,
  easeOut,
  easeOutBack,
  palette,
  polar,
  roundRect,
  span,
} from '@/effects/art/canvas.js';

const EVERY = 1.25; // seconds between reports
const FLIGHT = 0.85; // seconds a report travels to the screen
const ROW = 17;
const RINGS = [80, 102];
/** Plots out in the field: ring, starting angle and orbit speed. */
const PLOTS = [
  [0, 0.2, 0.16],
  [1, 1.4, -0.11],
  [0, 2.6, 0.16],
  [1, 3.7, -0.11],
  [0, 4.6, 0.16],
  [1, 5.6, -0.11],
];

const plotAt = (index, seconds) => {
  const [ring, start, speed] = PLOTS[index];
  const angle = start + seconds * speed;
  return [150 + Math.cos(angle) * RINGS[ring], 150 + Math.sin(angle) * RINGS[ring]];
};

const pin = (ctx, x, y, bounce) => {
  ctx.save();
  ctx.translate(x, y - bounce * 6);
  ctx.fillStyle = palette.forest;
  ctx.beginPath();
  ctx.arc(0, -9, 8, Math.PI * 0.85, Math.PI * 2.15);
  ctx.lineTo(0, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = palette.harvest;
  ctx.beginPath();
  ctx.arc(0, -9, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/**
 * You can't be at every plot: plots orbit the grower on dashed rings, like
 * notes you'd have had to go and collect. Each one sends its reading in on
 * its own, and the screen in the middle fills up, row by row, on time.
 */
export function drawField(ctx, seconds) {
  const cx = 150;
  const cy = 150;

  // Four-lobed cushion.
  ctx.fillStyle = palette.harvest;
  polar(ctx, cx, cy, (a) => 116 * (1 + 0.09 * Math.cos(4 * (a - Math.PI / 4))), 0);
  ctx.fill();

  // Dashed orbits, drifting.
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = 'rgb(46 74 58 / 40%)';
  [56, ...RINGS].forEach((radius, index) => {
    ctx.setLineDash([3, 5]);
    ctx.lineDashOffset = seconds * (index % 2 ? -8 : 8);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  const report = Math.floor(seconds / EVERY);
  const phase = seconds % EVERY;
  const flight = span(phase, 0, FLIGHT);
  const sender = report % PLOTS.length;

  // Plots; the sender hops as it reports.
  PLOTS.forEach((_, index) => {
    const [x, y] = plotAt(index, seconds);
    const hop = index === sender ? Math.sin(span(phase, 0, 0.35) * Math.PI) : 0;
    pin(ctx, x, y, hop);
  });

  // Screen in the middle.
  const width = 70;
  const height = 96;
  const left = cx - width / 2;
  const top = cy - height / 2;
  ctx.save();
  ctx.shadowColor = 'rgb(90 60 0 / 30%)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = palette.paper;
  roundRect(ctx, left, top, width, height, 12);
  ctx.fill();
  ctx.restore();

  // Rows: the newest slides in at the top once its report lands.
  const landed = easeOut(span(phase, FLIGHT, FLIGHT + 0.3));
  ctx.save();
  roundRect(ctx, left + 5, top + 16, width - 10, height - 22, 6);
  ctx.clip();
  for (let row = -1; row < 5; row += 1) {
    const y = top + 20 + (row + landed) * ROW;
    const fresh = row === -1;
    ctx.globalAlpha = fresh ? landed : 1;
    ctx.fillStyle = palette.forest;
    ctx.beginPath();
    ctx.arc(left + 13, y + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgb(46 74 58 / 30%)';
    const seed = (report - row) % 3;
    roundRect(ctx, left + 21, y + 3, 26 + seed * 6, 5, 2.5);
    ctx.fill();
    if (fresh || row === 0) {
      // A check marks the latest reading.
      const check = fresh ? easeOutBack(span(phase, FLIGHT + 0.1, FLIGHT + 0.35)) : 1;
      ctx.strokeStyle = palette.terracotta;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha *= check;
      ctx.beginPath();
      ctx.moveTo(left + width - 18, y + 6);
      ctx.lineTo(left + width - 15, y + 9);
      ctx.lineTo(left + width - 10, y + 3);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.fillStyle = palette.forestDeep;
  roundRect(ctx, cx - 9, top + 6, 18, 4, 2);
  ctx.fill();

  // The report in flight: a curved hop from the plot into the screen.
  if (phase < FLIGHT) {
    const [sx, sy] = plotAt(sender, seconds);
    const k = easeInOut(flight);
    const mx = (sx + cx) / 2 + (sy - cy) * 0.35;
    const my = (sy + cy) / 2 - (sx - cx) * 0.35;
    const x = (1 - k) ** 2 * sx + 2 * (1 - k) * k * mx + k * k * cx;
    const y = (1 - k) ** 2 * (sy - 9) + 2 * (1 - k) * k * my + k * k * (top + 26);
    ctx.globalAlpha = 1 - span(flight, 0.85, 1);
    ctx.fillStyle = palette.terracotta;
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.paper;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

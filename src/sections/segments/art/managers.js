import { easeOut, palette, polar, roundRect } from '@/effects/art/canvas.js';

const SWEEP = 3.6; // seconds per radar turn
const CELL = 19;
const GUTTER = 5;
const GRID = 5;
/** Sector map: the grid minus a few corners, so it reads as fields, not a table. */
const HOLES = new Set(['0,0', '4,0', '4,4', '0,3', '3,4']);

const riskColor = (risk) =>
  risk < 0.4 ? palette.forest : risk < 0.72 ? palette.harvest : palette.terracotta;

/** Deterministic 0–1 noise per plot and pass, so every loop replays the same map. */
const noise = (a, b) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Technical managers: a starburst turns behind the members' sector map. A
 * radar sweep re-reads each plot's alternate-bearing risk as it passes and
 * the intake forecast below settles with it.
 */
export function drawManagers(ctx, seconds) {
  const cx = 150;
  const cy = 150;

  ctx.fillStyle = palette.terracotta;
  polar(
    ctx,
    cx,
    cy,
    (a) => {
      const wave = Math.cos(12 * a);
      return 112 * (1 + 0.1 * Math.sign(wave) * Math.abs(wave) ** 0.7);
    },
    -seconds * 0.1,
    240,
  );
  ctx.fill();

  const size = GRID * CELL + (GRID - 1) * GUTTER;
  const left = cx - size / 2;
  const top = cy - size / 2 - 10;

  ctx.save();
  ctx.shadowColor = 'rgb(60 20 5 / 30%)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = palette.paper;
  roundRect(ctx, left - 12, top - 12, size + 24, size + 44, 16);
  ctx.fill();
  ctx.restore();

  const phase = (seconds / SWEEP) % 1;
  const sweep = phase * Math.PI * 2 - Math.PI / 2;
  const turns = Math.floor(seconds / SWEEP);
  let lowRisk = 0;
  let plots = 0;

  for (let row = 0; row < GRID; row += 1) {
    for (let col = 0; col < GRID; col += 1) {
      if (HOLES.has(`${col},${row}`)) continue;
      const x = left + col * (CELL + GUTTER);
      const y = top + row * (CELL + GUTTER);
      const px = x + CELL / 2 - cx;
      const py = y + CELL / 2 - (top + size / 2);
      // Where this plot sits around the beam's turn (0–1), and the time since it passed.
      const place = ((((Math.atan2(py, px) + Math.PI / 2) / (Math.PI * 2)) % 1) + 1) % 1;
      const passes = turns + (phase >= place ? 1 : 0);
      const since = ((((phase - place) % 1) + 1) % 1) * SWEEP;
      const key = row * GRID + col;
      const now = noise(key, passes);
      const before = noise(key, passes - 1);
      const settle = easeOut(Math.min(since / 1.2, 1));
      const risk = before + (now - before) * settle;
      if (risk < 0.4) lowRisk += 1;
      plots += 1;

      const ping = Math.max(0, 1 - since / 0.5);
      const grow = 1 + ping * 0.18;
      ctx.fillStyle = riskColor(risk);
      roundRect(
        ctx,
        x + (CELL * (1 - grow)) / 2,
        y + (CELL * (1 - grow)) / 2,
        CELL * grow,
        CELL * grow,
        5,
      );
      ctx.fill();
    }
  }

  // Radar beam over the map.
  const mapCenterY = top + size / 2;
  ctx.save();
  roundRect(ctx, left - 6, top - 6, size + 12, size + 12, 12);
  ctx.clip();
  const beam = ctx.createConicGradient(sweep - 0.9, cx, mapCenterY);
  beam.addColorStop(0, 'rgb(31 44 38 / 0%)');
  beam.addColorStop(0.14, 'rgb(31 44 38 / 22%)');
  beam.addColorStop(0.1433, 'rgb(31 44 38 / 0%)');
  ctx.fillStyle = beam;
  ctx.fillRect(left - 6, top - 6, size + 12, size + 12);
  ctx.strokeStyle = 'rgb(31 44 38 / 55%)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, mapCenterY);
  ctx.lineTo(cx + Math.cos(sweep) * 120, mapCenterY + Math.sin(sweep) * 120);
  ctx.stroke();
  ctx.restore();

  // Intake forecast: follows the share of low-risk plots.
  const barY = top + size + 14;
  ctx.fillStyle = 'rgb(46 74 58 / 14%)';
  roundRect(ctx, left, barY, size, 8, 4);
  ctx.fill();
  ctx.fillStyle = palette.forest;
  roundRect(ctx, left, barY, size * (0.35 + 0.6 * (lowRisk / plots)), 8, 4);
  ctx.fill();
}

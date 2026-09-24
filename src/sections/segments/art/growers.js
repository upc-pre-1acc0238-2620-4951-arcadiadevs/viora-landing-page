import { easeInOut, easeOut, easeOutBack, palette, polar, roundRect, span } from './canvas.js';

const LOOP = 7.5;
/** Tree loads, as bar heights; the middle one is overloaded and gets thinned. */
const LOADS = [24, 44, 18];
const THIN_TO = 30;

const snowflake = (ctx, x, y, size, turn) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.strokeStyle = palette.forest;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (let arm = 0; arm < 3; arm += 1) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(-size, 0);
    ctx.lineTo(size, 0);
    for (const side of [-1, 1]) {
      ctx.moveTo(side * size * 0.55, 0);
      ctx.lineTo(side * size * 0.85, -size * 0.28);
      ctx.moveTo(side * size * 0.55, 0);
      ctx.lineTo(side * size * 0.85, size * 0.28);
    }
    ctx.stroke();
  }
  ctx.restore();
};

/** Signal bars with a slash: no coverage in the grove. */
const noSignal = (ctx, x, y, alpha) => {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = palette.forest;
  [4, 7, 10, 13].forEach((height, index) => {
    roundRect(ctx, x + index * 4.5, y - height, 3, height, 1);
    ctx.fill();
  });
  ctx.strokeStyle = palette.terracotta;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 2, y + 1);
  ctx.lineTo(x + 17, y - 15);
  ctx.stroke();
  ctx.globalAlpha = 1;
};

/**
 * Olive growers: a scalloped seal turns slowly behind a phone. On screen the
 * chill gauge fills, each tree's load grows, the thinning line trims the
 * overloaded tree back — and it all saves with no signal.
 */
export function drawGrowers(ctx, seconds) {
  const t = (seconds % LOOP) / LOOP;
  const cx = 150;
  const cy = 150;
  const fade = 1 - span(t, 0.93, 1);

  // Seal: eight soft lobes, breathing a touch as it turns.
  const breathe = 1 + Math.sin(seconds * 1.3) * 0.012;
  ctx.fillStyle = palette.forest;
  polar(ctx, cx, cy, (a) => 118 * breathe * (1 + 0.075 * Math.cos(8 * a)), seconds * 0.12);
  ctx.fill();

  // Phone, lifting a little on each loop.
  const lift = easeOutBack(span(t, 0, 0.12));
  ctx.save();
  ctx.translate(cx, cy + (1 - lift) * 14);
  ctx.globalAlpha = 0.25 + 0.75 * lift;
  ctx.shadowColor = 'rgb(20 30 25 / 35%)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = palette.paper;
  roundRect(ctx, -54, -90, 108, 180, 20);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = palette.forestDeep;
  roundRect(ctx, -14, -83, 28, 6, 3);
  ctx.fill();
  ctx.globalAlpha = fade;

  noSignal(ctx, -40, -62, 1);

  // Saved offline: a check pops in once the plan is set.
  const saved = easeOutBack(span(t, 0.78, 0.86));
  if (saved > 0) {
    ctx.save();
    ctx.translate(33, -67);
    ctx.scale(saved, saved);
    ctx.fillStyle = palette.forest;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.paper;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-3.5, 0.5);
    ctx.lineTo(-1, 3);
    ctx.lineTo(4, -2.5);
    ctx.stroke();
    ctx.restore();
  }

  // Chill gauge.
  const gy = -22;
  const fill = easeInOut(span(t, 0.08, 0.45)) * 0.82;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgb(46 74 58 / 14%)';
  ctx.beginPath();
  ctx.arc(0, gy, 30, 0, Math.PI * 2);
  ctx.stroke();
  if (fill > 0.001) {
    ctx.strokeStyle = palette.harvest;
    ctx.beginPath();
    ctx.arc(0, gy, 30, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2);
    ctx.stroke();
  }
  snowflake(ctx, 0, gy, 12, seconds * 0.4);

  // Tree loads, then the thinning line.
  const base = 70;
  const thinning = span(t, 0.62, 0.74);
  const threshold = base - THIN_TO;
  LOADS.forEach((load, index) => {
    const x = -30 + index * 30;
    const grow = easeOutBack(span(t, 0.36 + index * 0.07, 0.52 + index * 0.07));
    const cut = load > THIN_TO ? easeInOut(span(t, 0.7, 0.8)) : 0;
    const height = Math.max(0, load * grow - (load - THIN_TO) * cut);
    ctx.fillStyle = palette.forest;
    roundRect(ctx, x - 7, base - height, 14, height, 4);
    ctx.fill();
    // The trimmed top flashes terracotta before it drops away.
    if (load > THIN_TO && thinning > 0 && cut < 1) {
      const excess = (load - THIN_TO) * (1 - cut);
      ctx.globalAlpha = fade * (1 - cut) * easeOut(thinning);
      ctx.fillStyle = palette.terracotta;
      roundRect(ctx, x - 7, base - THIN_TO - excess - cut * 16, 14, excess, 4);
      ctx.fill();
      ctx.globalAlpha = fade;
    }
    // Olive canopy dot on each tree.
    ctx.fillStyle = palette.olive;
    ctx.beginPath();
    ctx.arc(x, base - height - 5, 4 * grow, 0, Math.PI * 2);
    ctx.fill();
  });
  if (thinning > 0) {
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -seconds * 12;
    ctx.strokeStyle = palette.terracotta;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = fade * easeOut(thinning);
    ctx.beginPath();
    ctx.moveTo(-44, threshold);
    ctx.lineTo(-44 + 88 * easeInOut(thinning), threshold);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgb(46 74 58 / 22%)';
  roundRect(ctx, -44, base + 2, 88, 2, 1);
  ctx.fill();
  ctx.restore();
}

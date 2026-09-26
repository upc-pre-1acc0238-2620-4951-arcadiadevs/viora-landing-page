import { easeOut, easeOutBack, span } from '@/effects/art/canvas.js';
import { dots, H, tints, W } from './stage.js';

const LOOP = 7;
const TREES = 5;
const RADIUS = 58;

/**
 * Made for the field: a row of overlapping trees, sampled one by one while
 * offline (dashed rings, clay fill). Once the last one is logged, the signal
 * comes back and a sync wave turns the whole row forest green.
 */
export function drawField(ctx, seconds) {
  dots(ctx, 0);
  const t = (seconds % LOOP) / LOOP;
  const gap = (W - 2 * RADIUS - 24) / (TREES - 1);
  const cy = H / 2 + 6;
  const sync = span(t, 0.72, 0.9);
  const reset = span(t, 0.94, 1);

  for (let i = 0; i < TREES; i += 1) {
    const cx = 12 + RADIUS + i * gap;
    const sampled = easeOutBack(span(t, 0.08 + i * 0.11, 0.18 + i * 0.11)) * (1 - reset);
    const wave = easeOut(span(sync, i * 0.12, i * 0.12 + 0.45)) * (1 - reset);
    const bob = Math.sin(seconds * 2 + i * 0.9) * 3;

    ctx.fillStyle = tints.clay[1 + (i % 2)];
    ctx.beginPath();
    ctx.arc(cx, cy + bob, RADIUS, 0, Math.PI * 2);
    ctx.fill();

    if (sampled > 0) {
      ctx.fillStyle = wave > 0.5 ? tints.forest[3 + (i % 2)] : tints.clay[3 + (i % 2)];
      ctx.beginPath();
      ctx.arc(cx, cy + bob, RADIUS * 0.62 * Math.min(sampled, 1.15), 0, Math.PI * 2);
      ctx.fill();
    }

    // Offline: each tree waits in a dashed ring until the sync wave reaches it.
    if (wave < 0.5) {
      ctx.setLineDash([5, 6]);
      ctx.lineDashOffset = -seconds * 14;
      ctx.strokeStyle = tints.clay[4];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy + bob, RADIUS + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = tints.forest[4];
      ctx.lineWidth = 3;
      ctx.globalAlpha = 1 - (wave - 0.5) * 2;
      ctx.beginPath();
      ctx.arc(cx, cy + bob, RADIUS + 8 + (wave - 0.5) * 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

import { dots, H, tints, W, wrap } from './stage.js';

const PLANES = 12;
const SPEED = 0.55; // planes per second along the diagonal

/**
 * Agronomic science: a cascade of planes marches down the diagonal, each one
 * a model layer (chill, alternate bearing, ENSO). A slow sine runs through
 * the cascade like the El Niño swing, so the stack breathes as it builds.
 */
export function drawScience(ctx, seconds) {
  dots(ctx, 0);
  const flow = seconds * SPEED;
  const planes = [];
  for (let i = 0; i < PLANES; i += 1) {
    const s = wrap(i + flow, PLANES) / PLANES; // 0 = top-left, 1 = bottom-right
    planes.push({ s, i });
  }
  planes.sort((a, b) => a.s - b.s);
  planes.forEach(({ s, i }) => {
    const wave = Math.sin(seconds * 1.4 - s * 7) * 16;
    const x = -40 + s * (W - 60) + wave * 0.6;
    const y = -44 + s * (H - 40) - wave;
    const w = 150 - s * 18;
    const h = 120 - s * 14;
    // New planes slide in from the corner; the last ones thin out as they leave.
    const alpha = Math.min(1, s * 10, (1 - s) * 9);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = tints.forest[i % 5];
    ctx.fillRect(x, y, w, h);
  });
  ctx.globalAlpha = 1;
}

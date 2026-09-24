import { dots, H, tints, W, wrap } from './stage.js';

const RINGS = 9;
const SPEED = 0.45; // rings per second
const NODES = [
  [0.14, 0.2],
  [0.86, 0.24],
  [0.82, 0.82],
  [0.18, 0.8],
];

const diamond = (ctx, cx, cy, r) => {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
};

/**
 * With your cooperative: the grower's data sits at the centre and ripples
 * out in concentric diamonds; the cooperative, its advisor and the other
 * members light up as each ripple reaches them — same data, no waiting.
 */
export function drawCoop(ctx, seconds) {
  dots(ctx, 1);
  const cx = W / 2;
  const cy = H / 2;
  const step = 34;
  const flow = seconds * SPEED;

  // Largest first so the inner rings paint over.
  for (let k = RINGS - 1; k >= 0; k -= 1) {
    const ring = wrap(k - flow, RINGS);
    const r = 26 + ring * step;
    ctx.globalAlpha = Math.min(1, (RINGS - ring) / 2.2);
    ctx.fillStyle = k % 2 ? tints.olive[1 + (k % 3)] : tints.forest[1 + (k % 3)];
    diamond(ctx, cx, cy, r);
    ctx.fill();
    ctx.strokeStyle = '#f7f5f0';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = tints.forest[4];
  diamond(ctx, cx, cy, 22 + Math.sin(seconds * 3) * 2);
  ctx.fill();

  // Members at the corners flash when a ring's edge sweeps past them.
  NODES.forEach(([nx, ny]) => {
    const x = nx * W;
    const y = ny * H;
    // Diamond distance from the centre, against every ring's current edge.
    const reach = Math.abs(x - cx) + Math.abs(y - cy);
    let glow = 0;
    for (let k = 0; k < RINGS; k += 1) {
      const edge = 26 + wrap(k - flow, RINGS) * step;
      glow = Math.max(glow, 1 - Math.abs(edge - reach) / 18);
    }
    ctx.fillStyle = glow > 0.05 ? tints.harvest[4] : tints.forest[3];
    const size = 16 + glow * 8;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  });
}

import { easeInOut, span } from '@/effects/art/canvas.js';
import { dots, H, tints, W } from './stage.js';

const LOOP = 6;
const ROWS = 9;

/**
 * Decisions with a date: a funnel of planes, the thinning window. It opens
 * row by row, holds while a date marker drops through it, then closes again —
 * the moment Viora warns you about, never let slip.
 */
export function drawWindow(ctx, seconds) {
  dots(ctx, 1);
  const t = (seconds % LOOP) / LOOP;
  const top = 18;
  const rowH = (H - top) / ROWS;
  const marker = easeInOut(span(t, 0.3, 0.72));

  for (let row = 0; row < ROWS; row += 1) {
    const delay = row * 0.025;
    const open =
      easeInOut(span(t, 0.05 + delay, 0.28 + delay)) -
      easeInOut(span(t, 0.78 + delay * 0.5, 0.95 + delay * 0.5));
    const funnel = 1 - row / (ROWS + 2);
    const width = W * 0.86 * funnel * (0.42 + 0.58 * open);
    const y = top + row * rowH;
    const lit = Math.abs(marker * (ROWS - 1) - row) < 0.6 && marker > 0 && marker < 1;
    ctx.fillStyle = lit ? tints.forest[4] : tints.harvest[(row + 1) % 5];
    ctx.fillRect((W - width) / 2, y, width, rowH + 1);
  }

  // The date marker: a forest tick riding the funnel's axis.
  if (marker > 0 && marker < 1) {
    const y = top + marker * (ROWS - 1) * rowH + rowH / 2;
    ctx.fillStyle = tints.forest[4];
    ctx.fillRect(W / 2 - 1.5, top, 3, y - top);
    ctx.beginPath();
    ctx.arc(W / 2, y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}

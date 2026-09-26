/** Every card illustration draws in the Figma media slot: 428 × 342 units. */
export const W = 428;
export const H = 342;

/** Tints per hue, light to strong — the flat stacked planes of the reference. */
export const tints = Object.freeze({
  forest: ['#dfe7e1', '#c3d3c8', '#a6bdad', '#86a390', '#5f8069'],
  harvest: ['#fbf0cc', '#f7e3a1', '#f2d575', '#edc84d', '#e8b923'],
  clay: ['#f6ddd1', '#efc2ad', '#e5a487', '#d8845f', '#c15a2e'],
  olive: ['#eef0d8', '#dde2b4', '#c8d08c', '#b2bd69', '#9aa84a'],
});

const cache = new Map();

/**
 * Halftone ground: a grid of small squares whose size swells along a
 * diagonal band, like the reference's dithered panels. Rendered once per
 * variant into an offscreen canvas, then blitted every frame.
 */
export function dots(ctx, variant = 0) {
  let sheet = cache.get(variant);
  if (!sheet) {
    const scale = 3;
    sheet = document.createElement('canvas');
    sheet.width = W * scale;
    sheet.height = H * scale;
    const g = sheet.getContext('2d');
    g.scale(scale, scale);
    g.fillStyle = '#f7f5f0';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#dcd8d0';
    const step = 6;
    for (let y = step / 2; y < H; y += step) {
      for (let x = step / 2; x < W; x += step) {
        // Distance to the band, which runs corner to corner (flipped per variant).
        const u = variant % 2 ? (W - x) / W : x / W;
        const band = Math.abs(u - y / H);
        const size = 1.2 + 2.6 * Math.max(0, 1 - band * 2.4);
        g.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
    cache.set(variant, sheet);
  }
  ctx.drawImage(sheet, 0, 0, W, H);
}

export const wrap = (value, size) => ((value % size) + size) % size;

/** Rounded-lens displacement of the actual backdrop, with CSS fallback.
 * Each panel owns its map so nested docks and stacked notification edges refract
 * independently. This SVG is a filter graph, not a replacement visual asset.
 *
 * Two materials, selected on <html data-glass="…">:
 * - `liquid` (default): iOS-style clear glass. A convex bezel pulls the backdrop
 *   inward near the rim, with slight per-channel dispersion; `.glass--frosted`
 *   adds a heavy frost for panels that carry text.
 * - `classic`: the previous thin lens. Remove the attribute (or set it to
 *   `classic`) to restore it; CSS in styles/components/glass.css follows.
 * The nearest `data-glass` ancestor wins, so one piece can opt out of the page
 * material, e.g. <div data-glass="classic">.
 */
let instances = 0;

const ns = 'http://www.w3.org/2000/svg';
const materialOf = (panel) =>
  panel.closest('[data-glass]')?.dataset.glass === 'liquid' ? liquid : classic;

const element = (name, attributes) => {
  const node = document.createElementNS(ns, name);
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
};

/** Signed distance to the rounded-rect rim and its outward normal. */
function rim(x, y, width, height, radius) {
  const cx = Math.max(radius, Math.min(width - radius, x));
  const cy = Math.max(radius, Math.min(height - radius, y));
  const dx = x - cx;
  const dy = y - cy;
  const length = Math.hypot(dx, dy);
  return { dx, dy, length };
}

function paint(width, height, fill) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g] = fill(x, y);
      const i = (y * width + x) * 4;
      pixels.data[i] = r;
      pixels.data[i + 1] = g;
      pixels.data[i + 2] = 128;
      pixels.data[i + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL();
}

const classic = {
  build(filter, map) {
    filter.append(
      map,
      element('feDisplacementMap', {
        in: 'SourceGraphic',
        in2: 'lens',
        scale: '18',
        xChannelSelector: 'R',
        yChannelSelector: 'G',
      }),
    );
  },
  map(width, height, radius) {
    return paint(width, height, (x, y) => {
      const { dx, dy, length } = rim(x, y, width, height, radius);
      const edge = Math.max(0, 1 - (radius - length) / 12);
      const strength = Math.sin((Math.min(edge, 1) * Math.PI) / 2) * 0.8;
      return [
        128 + (length ? dx / length : 0) * strength * 127,
        128 + (length ? dy / length : 0) * strength * 127,
      ];
    });
  },
  backdrop: () => 'blur(2px) saturate(1.2)',
};

// Per-channel displacement scales: red bends most, blue least (dispersion).
const DISPERSION = [
  ['1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 1],
  ['0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 0.94],
  ['0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 0.88],
];

/** Bezel depth: thin on short pieces so the lens hugs the rim instead of
 * smearing lines that run parallel to it across the whole surface. */
const bezelOf = (radius, height) => Math.max(6, Math.min(radius * 0.95, height * 0.24, 36));

const liquid = {
  build(filter, map) {
    filter.append(map);
    DISPERSION.forEach(([matrix], channel) => {
      filter.append(
        element('feDisplacementMap', {
          in: 'SourceGraphic',
          in2: 'lens',
          scale: '0',
          xChannelSelector: 'R',
          yChannelSelector: 'G',
          result: `bent${channel}`,
        }),
        element('feColorMatrix', {
          in: `bent${channel}`,
          type: 'matrix',
          values: matrix,
          result: `channel${channel}`,
        }),
      );
    });
    filter.append(
      element('feComposite', {
        in: 'channel0',
        in2: 'channel1',
        operator: 'arithmetic',
        k2: '1',
        k3: '1',
        result: 'rg',
      }),
      element('feComposite', {
        in: 'rg',
        in2: 'channel2',
        operator: 'arithmetic',
        k2: '1',
        k3: '1',
      }),
    );
  },
  /** Convex bezel: strongest pull at the rim, easing to flat glass inside. */
  map(width, height, radius) {
    const bezel = bezelOf(radius, height);
    return paint(width, height, (x, y) => {
      const { dx, dy, length } = rim(x, y, width, height, radius);
      const depth = Math.max(0, radius - length);
      const t = Math.min(depth / bezel, 1);
      const strength = (1 - t) ** 1.7;
      // Inward sampling keeps the lens inside the element's backdrop.
      return [
        128 - (length ? dx / length : 0) * strength * 127,
        128 - (length ? dy / length : 0) * strength * 127,
      ];
    });
  },
  scale: (bezel) => bezel * 1.9,
  backdrop: (panel) =>
    panel.classList.contains('glass--frosted')
      ? 'blur(16px) saturate(1.5) brightness(0.92)'
      : 'blur(0.6px) saturate(1.45) brightness(1.06)',
};

export function mountGlass(root) {
  const scope = `viora-glass-${(instances += 1)}`;
  const svg = element('svg', { width: '0', height: '0', 'aria-hidden': 'true' });
  svg.style.position = 'absolute';
  const defs = element('defs', {});
  svg.append(defs);
  root.append(svg);
  const panels = [...root.querySelectorAll('.glass')];
  const filters = panels.map((panel, index) => {
    const material = materialOf(panel);
    const id = `${scope}-${index}`;
    const filter = element('filter', {
      id,
      x: '0%',
      y: '0%',
      width: '100%',
      height: '100%',
      'color-interpolation-filters': 'sRGB',
    });
    const map = element('feImage', {
      result: 'lens',
      width: '100%',
      height: '100%',
      preserveAspectRatio: 'none',
    });
    material.build(filter, map);
    defs.append(filter);
    return { panel, map, filter, id, material };
  });
  const render = ({ panel, map, filter, id, material }) => {
    const width = Math.max(2, Math.round(panel.clientWidth));
    const height = Math.max(2, Math.round(panel.clientHeight));
    const radius = Math.min(parseFloat(getComputedStyle(panel).borderRadius) || 23, height / 2);
    map.setAttribute('href', material.map(width, height, radius));
    if (material === liquid) {
      const bezel = bezelOf(radius, height);
      filter.querySelectorAll('feDisplacementMap').forEach((node, channel) => {
        node.setAttribute('scale', String(liquid.scale(bezel) * DISPERSION[channel][1]));
      });
    }
    // Unsupported engines ignore this value and retain the CSS glass material.
    const backdrop = `url(#${id}) ${material.backdrop(panel)}`;
    if (CSS.supports('backdrop-filter', backdrop)) panel.style.backdropFilter = backdrop;
  };
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const filter = filters.find(({ panel }) => panel === entry.target);
      if (filter) render(filter);
    }
  });
  filters.forEach(({ panel }) => observer.observe(panel));
  return () => {
    observer.disconnect();
    panels.forEach((panel) => panel.style.removeProperty('backdrop-filter'));
    svg.remove();
  };
}

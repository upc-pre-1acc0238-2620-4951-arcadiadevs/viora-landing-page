/**
 * The footer tapestry: a cross-stitch storyboard of one season with Viora.
 *
 * The scene is painted at 320 × 116 "stitches" on a work canvas, then every
 * pixel is snapped to a thread palette with a 4 × 4 ordered dither (a 4 K
 * lookup table keeps that to one read per pixel) and shown pixel-for-pixel,
 * scaled up by whole numbers in CSS with a stitch texture on top. A frame
 * costs well under a millisecond; the footer draws 12 of them a second.
 *
 * Story (36 s, four chapters of 9 s), seen through three stone arches:
 *   0 Winter — chill builds up. A grower walks in at dawn; frost; the app
 *     counts cold hours.
 *   1 Bloom — sampling. The grove flowers; she samples a tree; bars rise.
 *   2 Thinning window. One tree is overloaded; the app marks the window;
 *     she thins it and the extra fruit falls.
 *   3 Harvest. Even trees, crates fill at golden hour, she cheers; night.
 */

export const W = 320;
export const H = 116;
export const ACT = 9;
export const LOOP = ACT * 4;

// ── Threads ──────────────────────────────────────────────
const C = {
  stoneDark: '#5e4f3b',
  stone: '#7d6a4f',
  stoneMid: '#978163',
  stoneLight: '#b8a27c',
  stonePale: '#d9c9a2',
  column: '#e6dbbd',
  columnShade: '#b9ab88',
  leafDeep: '#26301a',
  leafDark: '#3d4b20',
  leaf: '#5d6d2c',
  leafLit: '#8a9a3e',
  leafSun: '#b8b153',
  blossom: '#e4c65a',
  pot: '#a85a32',
  potLit: '#c9784a',
  hillFar: '#c29a78',
  hill: '#a2775a',
  sand: '#d2b184',
  sandDark: '#b89567',
  furrow: '#9e7d52',
  treeDark: '#4c5a30',
  tree: '#6c7b43',
  treeLit: '#95a063',
  trunk: '#5a4632',
  flower: '#f6f1e4',
  olive: '#7a8a2c',
  oliveRipe: '#2e2a22',
  crate: '#8a5a32',
  crateDark: '#62401f',
  skin: '#b27a54',
  hat: '#dcb45c',
  hatBand: '#6b4a2a',
  shirt: '#c15a2e',
  trousers: '#2e4a3a',
  boots: '#2a241d',
  phone: '#1b1916',
  screen: '#f3efe4',
  card: '#f3efe4',
  cardInk: '#2e4a3a',
  cardMute: '#d6cfbd',
  gold: '#e8b923',
  terracotta: '#c15a2e',
  ice: '#6f9cc4',
  frost: '#eef2f5',
  night: '#1d2238',
  star: '#fff4c8',
  sun: '#fbe7a1',
  sunset: '#f09a4c',
  cloud: '#f4efe6',
  cloudDusk: '#d9a58f',
};

/** Sky, top and horizon, through the day: [second, top, horizon]. */
const SKY = [
  [0, '#27304b', '#6d5a6e'],
  [3, '#5f7fa6', '#e3bfa0'],
  [8, '#78aad4', '#e8e0cb'],
  [18, '#5c9fd8', '#d6e6ea'],
  [27, '#6a9dcd', '#f1d6a2'],
  [30.5, '#c2744a', '#f2bd72'],
  [33.5, '#3b3656', '#a2665a'],
  [36, '#27304b', '#6d5a6e'],
];

const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
const PALETTE = [...new Set([...Object.values(C), ...SKY.flatMap(([, a, b]) => [a, b])])].map(hex);

// ── Helpers ──────────────────────────────────────────────
const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
const span = (t, a, b) => clamp01((t - a) / (b - a));
const smooth = (t, a, b) => {
  const x = span(t, a, b);
  return x * x * (3 - 2 * x);
};
const mix = (a, b, k) => a + (b - a) * k;
const mixHex = (a, b, k) => {
  const [x, y] = [hex(a), hex(b)];
  return `rgb(${x.map((v, i) => Math.round(mix(v, y[i], k))).join(' ')})`;
};

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Layout (stitches) ────────────────────────────────────
const ARCH = { left: 72, width: 52, gap: 10, spring: 40, ledge: 100 };
const OPENINGS = [0, 1, 2].map((i) => ARCH.left + i * (ARCH.width + ARCH.gap));
const VIEW = { left: ARCH.left, right: ARCH.left + 3 * ARCH.width + 2 * ARCH.gap };
const GROUND = 98;
const TREES = [96, 140, 180, 224];
const CRATES = 212;

/** Where the grower is and what she is doing: [second, x, pose]. */
const PATH = [
  [0, 46, 'walk'],
  [4.6, 112, 'phone'],
  [9, 112, 'walk'],
  [12, 146, 'sample'],
  [17.4, 146, 'walk'],
  [20.4, 169, 'thin'],
  [25, 169, 'phone'],
  [27, 169, 'walk'],
  [29, 204, 'carry'],
  [31.6, 204, 'cheer'],
  [34, 204, 'walk'],
  [36, 262, 'walk'],
];

/** App cards: [from, to, kind]. */
const CARDS = [
  [4.9, 8.8, 'chill'],
  [12.3, 17.2, 'sample'],
  [20.7, 26.6, 'window'],
  [29.6, 34, 'harvest'],
];

/** Chapter shown at `t` (0–3). */
export const chapterAt = (t) => Math.floor((((t % LOOP) + LOOP) % LOOP) / ACT);

// ── Pre-rendered frame: the arcade, its garden and the ledge ──
function paintFrame() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const rng = seeded(7);

  // Stone courses with a little tint per block.
  const stones = [C.stone, C.stoneMid, C.stone, C.stoneDark];
  for (let y = 0; y < H; y += 6) {
    const shift = (y / 6) % 2 ? 6 : 0;
    for (let x = -shift; x < W; x += 12) {
      ctx.fillStyle = stones[Math.floor(rng() * stones.length)];
      ctx.fillRect(x, y, 12, 6);
      ctx.fillStyle = C.stoneLight;
      ctx.fillRect(x + 1, y + 1, 10, 1);
      ctx.fillStyle = C.stoneDark;
      ctx.fillRect(x, y + 5, 12, 1);
      ctx.fillRect(x + 11, y, 1, 6);
    }
  }

  // Openings.
  ctx.globalCompositeOperation = 'destination-out';
  const opening = (x) => {
    const r = ARCH.width / 2;
    ctx.beginPath();
    ctx.moveTo(x, ARCH.ledge);
    ctx.lineTo(x, ARCH.spring);
    ctx.arc(x + r, ARCH.spring, r, Math.PI, 0);
    ctx.lineTo(x + ARCH.width, ARCH.ledge);
    ctx.closePath();
  };
  OPENINGS.forEach((x) => {
    opening(x);
    ctx.fill();
  });
  ctx.globalCompositeOperation = 'source-over';

  // Arch rims: a pale voussoir ring with a shadow inside.
  OPENINGS.forEach((x) => {
    const r = ARCH.width / 2;
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.stonePale;
    ctx.beginPath();
    ctx.arc(x + r, ARCH.spring, r + 1.5, Math.PI, 0);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = C.stoneDark;
    ctx.beginPath();
    ctx.arc(x + r, ARCH.spring, r - 0.5, Math.PI * 1.05, Math.PI * 1.6);
    ctx.stroke();
  });

  // Columns between the openings, with capitals and bases.
  [OPENINGS[0] + ARCH.width, OPENINGS[1] + ARCH.width].forEach((x) => {
    ctx.fillStyle = C.column;
    ctx.fillRect(x + 2, 40, 6, 60);
    ctx.fillStyle = C.columnShade;
    ctx.fillRect(x + 6, 40, 2, 60);
    ctx.fillStyle = C.stonePale;
    ctx.fillRect(x, 36, 10, 4);
    ctx.fillRect(x, 96, 10, 4);
    ctx.fillStyle = C.columnShade;
    ctx.fillRect(x, 39, 10, 1);
  });

  // Ledge.
  ctx.fillStyle = C.stonePale;
  ctx.fillRect(0, ARCH.ledge, W, 6);
  ctx.fillStyle = C.column;
  ctx.fillRect(0, ARCH.ledge, W, 1);
  ctx.fillStyle = C.stoneDark;
  ctx.fillRect(0, ARCH.ledge + 6, W, 1);

  // A clay pot, bottom left, like the reference.
  ctx.fillStyle = C.pot;
  ctx.fillRect(14, 96, 40, 20);
  ctx.fillRect(10, 92, 48, 5);
  ctx.fillStyle = C.potLit;
  ctx.fillRect(10, 92, 48, 1);
  ctx.fillRect(16, 98, 3, 16);

  // Garden: leafy clumps, heavy at both sides and thinning towards the
  // arches, each lit from the top left like the reference's painted ivy.
  const tones = [C.leafDeep, C.leafDark, C.leaf, C.leafLit, C.leafSun];
  const leaf = (x, y, lit) => {
    ctx.fillStyle = tones[Math.max(0, Math.min(4, Math.round(lit * 4)))];
    ctx.fillRect(
      Math.round(x),
      Math.round(y),
      2 + (rng() > 0.6 ? 1 : 0),
      1 + (rng() > 0.5 ? 1 : 0),
    );
  };
  const clump = (cx, cy, radius, shade) => {
    const count = Math.round(radius * radius * 1.3);
    for (let k = 0; k < count; k += 1) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * radius;
      const dx = Math.cos(a) * r;
      const dy = Math.sin(a) * r * 0.8;
      const lit = 0.55 - (dx + dy) / (radius * 2.4) + shade + (rng() - 0.5) * 0.35;
      leaf(cx + dx, cy + dy, clamp01(lit));
    }
  };
  const clumps = [];
  for (let i = 0; i < 150; i += 1) {
    const side = rng() > 0.5;
    const depth = rng() ** 1.4;
    const x = side ? W - 4 - depth * 78 : 4 + depth * 72;
    clumps.push([x, rng() * 100, 5 + rng() * 9, -depth * 0.35 + (rng() - 0.5) * 0.2]);
  }
  for (let i = 0; i < 26; i += 1)
    clumps.push([66 + rng() * 188, rng() ** 1.8 * 18, 3 + rng() * 5, -0.05]);
  // Back to front: lower clumps overlap the ones above them.
  clumps.sort((a, b) => a[1] - b[1]).forEach(([x, y, r, shade]) => clump(x, y, r, shade));
  // Hanging strands over the arches.
  for (let s = 0; s < 14; s += 1) {
    let x = 66 + rng() * 188;
    let y = 4 + rng() * 10;
    const length = 8 + rng() * 22;
    for (let k = 0; k < length; k += 1) {
      x += (rng() - 0.5) * 1.4;
      y += 1;
      leaf(x, y, clamp01(0.6 - k / 40 + (rng() - 0.5) * 0.3));
    }
  }
  for (let i = 0; i < 140; i += 1) {
    const side = rng() > 0.5;
    const x = side ? W - rng() * 70 : rng() * 64;
    ctx.fillStyle = rng() > 0.3 ? C.blossom : C.flower;
    ctx.fillRect(Math.round(x), Math.round(rng() * 88), 1, 1);
  }
  return canvas;
}

// ── The world seen through the arches ────────────────────
function sky(t) {
  let i = 0;
  while (i < SKY.length - 2 && t > SKY[i + 1][0]) i += 1;
  const [t0, top0, low0] = SKY[i];
  const [t1, top1, low1] = SKY[i + 1];
  const k = smooth(t, t0, t1);
  return [mixHex(top0, top1, k), mixHex(low0, low1, k)];
}

function createWorld() {
  const rng = seeded(21);
  const stars = Array.from({ length: 46 }, () => [VIEW.left + rng() * 176, rng() * 50, rng() * 6]);
  const frost = Array.from({ length: 60 }, () => [
    VIEW.left + rng() * 176,
    rng() * 100,
    0.4 + rng(),
  ]);
  const clouds = Array.from({ length: 5 }, (_, i) => [
    rng() * 240,
    8 + rng() * 26,
    6 + rng() * 8,
    i,
  ]);
  const rime = Array.from({ length: 140 }, () => [VIEW.left + rng() * 176, 72 + rng() * 26]);
  // Per tree: flower and fruit spots inside the canopy.
  const spots = TREES.map((_, i) => {
    const local = seeded(100 + i);
    return Array.from({ length: 44 }, () => {
      const a = local() * Math.PI * 2;
      const r = Math.sqrt(local()) * 10;
      return [Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.8 - 1];
    });
  });
  return { stars, frost, clouds, rime, spots };
}

function drawWorld(ctx, t, world) {
  const [top, low] = sky(t);
  const night = Math.max(smooth(t, 31.5, 34.5), 1 - smooth(t, 0.5, 3.5));
  const dusk = smooth(t, 28, 31) * (1 - smooth(t, 33, 35));

  // Sky.
  const gradient = ctx.createLinearGradient(0, 0, 0, 72);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, low);
  ctx.fillStyle = gradient;
  ctx.fillRect(VIEW.left - 4, 0, VIEW.right - VIEW.left + 8, 74);

  // Stars and moon.
  if (night > 0.05) {
    ctx.globalAlpha = night;
    ctx.fillStyle = C.star;
    world.stars.forEach(([x, y, phase]) => {
      if (Math.sin(t * 2.2 + phase * 3) > -0.3) ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    });
    ctx.beginPath();
    ctx.arc(t > 20 ? 222 : 98, 16, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Sun, rising at dawn and setting orange.
  const day = span(t, 2, 33);
  if (day > 0 && day < 1) {
    const x = mix(VIEW.left + 6, VIEW.right - 8, day);
    const y = 66 - Math.sin(day * Math.PI) * 50;
    ctx.fillStyle = mixHex(C.sun, C.sunset, smooth(t, 26, 31));
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Clouds drifting east.
  ctx.globalAlpha = 0.9 * (1 - night * 0.8);
  ctx.fillStyle = dusk > 0.3 ? C.cloudDusk : C.cloud;
  world.clouds.forEach(([x0, y, w, i]) => {
    const x = VIEW.left - 20 + ((x0 + t * (2 + i * 0.5)) % 220);
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 2);
    ctx.fillRect(Math.round(x + 2), Math.round(y - 2), Math.round(w - 5), 2);
  });
  ctx.globalAlpha = 1;

  // The Tacna hills.
  ctx.fillStyle = C.hillFar;
  ctx.beginPath();
  ctx.moveTo(VIEW.left, 72);
  for (let x = VIEW.left; x <= VIEW.right; x += 4)
    ctx.lineTo(x, 60 - Math.sin(x * 0.04) * 4 - Math.sin(x * 0.11) * 2);
  ctx.lineTo(VIEW.right, 72);
  ctx.fill();
  ctx.fillStyle = C.hill;
  ctx.beginPath();
  ctx.moveTo(VIEW.left, 74);
  for (let x = VIEW.left; x <= VIEW.right; x += 4) ctx.lineTo(x, 66 - Math.sin(x * 0.07 + 1) * 3);
  ctx.lineTo(VIEW.right, 74);
  ctx.fill();

  // Grove floor with furrows and a drip line.
  const floor = ctx.createLinearGradient(0, 68, 0, 100);
  floor.addColorStop(0, C.sandDark);
  floor.addColorStop(1, C.sand);
  ctx.fillStyle = floor;
  ctx.fillRect(VIEW.left, 68, VIEW.right - VIEW.left, 32);
  ctx.fillStyle = C.furrow;
  [71, 75, 80, 86, 93].forEach((y) => ctx.fillRect(VIEW.left, y, VIEW.right - VIEW.left, 1));

  // Frost on the ground, melting as the sun comes up.
  const rime = 1 - smooth(t, 3, 7.5);
  if (rime > 0) {
    ctx.globalAlpha = rime;
    ctx.fillStyle = C.frost;
    world.rime.forEach(([x, y]) => ctx.fillRect(Math.round(x), Math.round(y), 1, 1));
    ctx.globalAlpha = 1;
  }

  // Far row of trees.
  for (let x = VIEW.left + 2; x < VIEW.right; x += 9) {
    ctx.fillStyle = C.treeDark;
    ctx.fillRect(x - 3, 67, 7, 3);
    ctx.fillStyle = C.tree;
    ctx.fillRect(x - 2, 65, 5, 3);
  }

  // Near trees, with flowers, then fruit, thinned and harvested.
  const bloom = smooth(t, 9.6, 12.6) * (1 - smooth(t, 17, 19));
  const fruit = smooth(t, 17.4, 19.4);
  const ripe = smooth(t, 27.5, 29.5);
  const picked = smooth(t, 29, 32);
  TREES.forEach((cx, i) => {
    const sway = Math.sin(t * 1.3 + i) * 0.6;
    const cy = 77;
    ctx.fillStyle = C.trunk;
    ctx.fillRect(cx - 1, 83, 3, 15);
    ctx.fillRect(cx - 3, 85, 2, 2);
    ctx.fillRect(cx + 2, 84, 2, 2);
    const blob = (dx, dy, r, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(cx + dx + sway, cy + dy, r * 1.15, r * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
    };
    blob(-5, 1, 7, C.treeDark);
    blob(5, 1, 7, C.treeDark);
    blob(0, -4, 8, C.treeDark);
    blob(-3, -3, 5, C.tree);
    blob(4, -4, 4, C.tree);
    blob(-4, -6, 2.5, C.treeLit);

    const spots = world.spots[i];
    const draw = (count, color) => {
      ctx.fillStyle = color;
      for (let k = 0; k < count; k += 1) {
        const [dx, dy] = spots[k];
        ctx.fillRect(Math.round(cx + dx + sway), Math.round(cy + dy), 1, 1);
      }
    };
    if (bloom > 0) draw(Math.round(bloom * 34), C.flower);
    if (fruit > 0) {
      // Tree 2 is overloaded until she thins it.
      const extra = i === 2 ? Math.round(20 * (1 - span(t, 21.2, 24.2))) : 0;
      const load = Math.round((14 + extra) * fruit * (1 - picked * 0.75));
      draw(Math.min(load, spots.length), mixHex(C.olive, C.oliveRipe, ripe));
    }
  });

  // Thinned fruit falling from the overloaded tree.
  for (let k = 0; k < 20; k += 1) {
    const start = 21.2 + k * 0.15;
    if (t < start || t > 27) continue;
    const [dx, dy] = world.spots[2][14 + k];
    const fall = span(t, start, start + 0.7);
    const y = mix(77 + dy, GROUND - (k % 3), fall * fall);
    ctx.fillStyle = C.olive;
    ctx.fillRect(Math.round(TREES[2] + dx + (fall > 0.99 ? (k % 5) - 2 : 0)), Math.round(y), 1, 1);
  }

  // Crates filling at golden hour.
  const crates = Math.floor(smooth(t, 29.2, 32.5) * 3.99);
  for (let k = 0; k < crates; k += 1) {
    const x = CRATES + (k === 2 ? 5 : k * 10);
    const y = GROUND - 5 - (k === 2 ? 5 : 0);
    ctx.fillStyle = C.crate;
    ctx.fillRect(x, y, 9, 5);
    ctx.fillStyle = C.crateDark;
    ctx.fillRect(x, y + 2, 9, 1);
    ctx.fillStyle = C.oliveRipe;
    ctx.fillRect(x + 1, y - 1, 7, 1);
  }

  // Winter frost drifting down.
  const snow = (1 - smooth(t, 5, 9)) * (t < 10 ? 1 : 0);
  if (snow > 0) {
    ctx.globalAlpha = snow;
    ctx.fillStyle = C.frost;
    world.frost.forEach(([x, y, speed]) => {
      const fy = (y + t * 6 * speed) % 100;
      ctx.fillRect(Math.round(x + Math.sin(t + y) * 2), Math.round(fy), 1, 1);
    });
    ctx.globalAlpha = 1;
  }

  // The grower.
  drawGrower(ctx, t);

  // Evening light and night.
  if (dusk > 0) {
    ctx.globalAlpha = dusk * 0.14;
    ctx.fillStyle = C.sunset;
    ctx.fillRect(VIEW.left, 0, VIEW.right - VIEW.left, 100);
  }
  if (night > 0) {
    ctx.globalAlpha = night * 0.5;
    ctx.fillStyle = C.night;
    ctx.fillRect(VIEW.left, 0, VIEW.right - VIEW.left, 100);
  }
  ctx.globalAlpha = 1;
}

function poseAt(t) {
  let i = 0;
  while (i < PATH.length - 2 && t >= PATH[i + 1][0]) i += 1;
  const [t0, x0, pose] = PATH[i];
  const [t1, x1] = PATH[i + 1];
  return { x: pose === 'walk' ? mix(x0, x1, span(t, t0, t1)) : x0, pose, since: t - t0 };
}

function drawGrower(ctx, t) {
  const { x: fx, pose, since } = poseAt(t);
  const x = Math.round(fx);
  const px = (dx, dy, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + dx, GROUND + dy, w, h);
  };
  const step = Math.floor(t * 6) % 2;
  const crouch = pose === 'sample' || pose === 'carry' ? 2 : 0;

  // Legs and boots.
  if (pose === 'walk') {
    px(-2 + step, -5, 1, 4, C.trousers);
    px(1 - step, -5, 1, 4, C.trousers);
    px(-2 + step, -1, 2, 1, C.boots);
    px(1 - step, -1, 2, 1, C.boots);
  } else {
    px(-2, -5 + crouch, 1, 4 - crouch, C.trousers);
    px(1, -5 + crouch, 1, 4 - crouch, C.trousers);
    px(-2, -1, 2, 1, C.boots);
    px(1, -1, 2, 1, C.boots);
  }
  const b = crouch; // body drop
  // Body.
  px(-2, -11 + b, 5, 6, C.shirt);
  // Head and hat.
  px(-1, -14 + b, 3, 3, C.skin);
  px(-3, -15 + b, 7, 1, C.hat);
  px(-1, -17 + b, 3, 2, C.hat);
  px(-1, -15 + b, 3, 1, C.hatBand);

  // Arms per pose.
  const cheer = pose === 'cheer' && Math.floor(since * 4) % 2 === 0;
  if (pose === 'phone') {
    px(2, -11 + b, 1, 3, C.skin);
    px(2, -12 + b, 2, 1, C.skin);
    px(3, -14 + b, 1, 2, C.phone);
    px(3, -14 + b, 1, 1, C.screen);
    px(-3, -10 + b, 1, 4, C.skin);
  } else if (pose === 'sample' || pose === 'thin') {
    const reach = Math.floor(since * 3) % 2;
    px(2, -13 + b - reach, 1, 3, C.skin);
    px(3, -14 + b - reach, 1, 1, C.skin);
    px(-3, -10 + b, 1, 4, C.skin);
  } else if (pose === 'carry') {
    px(-3, -8 + b, 7, 1, C.skin);
  } else if (pose === 'cheer') {
    px(-3, (cheer ? -15 : -13) + b, 1, 4, C.skin);
    px(3, (cheer ? -15 : -13) + b, 1, 4, C.skin);
  } else {
    px(-3, -10 + b + step, 1, 4, C.skin);
    px(3, -10 + b - step, 1, 4, C.skin);
  }

  // Gold sparks around her at the cheer.
  if (pose === 'cheer') {
    ctx.fillStyle = C.gold;
    for (let k = 0; k < 6; k += 1) {
      const a = k * 1.05 + since * 2;
      const r = 6 + ((since * 6 + k) % 5);
      if ((k + Math.floor(since * 5)) % 2)
        ctx.fillRect(
          Math.round(x + Math.cos(a) * r),
          Math.round(GROUND - 12 + Math.sin(a) * r * 0.7),
          1,
          1,
        );
    }
  }
}

// ── App card above the grower ────────────────────────────
function drawCard(ctx, t) {
  const card = CARDS.find(([from, to]) => t >= from && t <= to);
  if (!card) return;
  const [from, to, kind] = card;
  const open = Math.min(span(t, from, from + 0.35), 1 - span(t, to - 0.3, to));
  if (open <= 0) return;
  const { x: gx } = poseAt(t);
  const w = 36;
  const h = Math.max(2, Math.round(22 * open));
  const x = Math.round(Math.min(Math.max(gx - 18, VIEW.left + 2), VIEW.right - w - 2));
  const y = 44 - h;
  const p = span(t, from + 0.4, to - 0.6);

  // Tail towards her head.
  ctx.fillStyle = C.cardInk;
  ctx.fillRect(Math.round(gx), y + h, 1, Math.max(0, GROUND - 18 - (y + h)));
  // Card.
  ctx.fillStyle = C.cardInk;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = C.card;
  ctx.fillRect(x, y, w, h);
  if (open < 1) return;
  ctx.fillStyle = C.cardInk;
  ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = C.gold;
  ctx.fillRect(x + 2, y + 1, 1, 1);

  const bar = (bx, by, bw, bh, k, color) => {
    ctx.fillStyle = C.cardMute;
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = color;
    ctx.fillRect(bx, by, Math.round(bw * k), bh);
  };
  if (kind === 'chill') {
    // Snowflake and the cold hours bar.
    ctx.fillStyle = C.ice;
    ctx.fillRect(x + 4, y + 9, 5, 1);
    ctx.fillRect(x + 6, y + 7, 1, 5);
    ctx.fillRect(x + 5, y + 8, 1, 1);
    ctx.fillRect(x + 7, y + 8, 1, 1);
    ctx.fillRect(x + 5, y + 10, 1, 1);
    ctx.fillRect(x + 7, y + 10, 1, 1);
    bar(x + 12, y + 8, 20, 3, p, C.gold);
    for (let k = 0; k < 5; k += 1) {
      ctx.fillStyle = k / 5 < p ? C.cardInk : C.cardMute;
      ctx.fillRect(x + 12 + k * 4, y + 14, 2, 1);
    }
    ctx.fillStyle = C.cardMute;
    ctx.fillRect(x + 4, y + 17, 26, 1);
  } else if (kind === 'sample') {
    [6, 11, 5, 9, 7].forEach((height, k) => {
      const hh = Math.round(height * smooth(p, k * 0.12, k * 0.12 + 0.4));
      ctx.fillStyle = C.cardInk;
      ctx.fillRect(x + 4 + k * 6, y + 19 - hh, 4, hh);
      if (hh > 0) {
        ctx.fillStyle = C.gold;
        ctx.fillRect(x + 4 + k * 6, y + 19 - hh, 4, 1);
      }
    });
  } else if (kind === 'window') {
    for (let k = 0; k < 7; k += 1) {
      const lit = k >= 2 && k <= 4 && p > 0.15 + (k - 2) * 0.15;
      ctx.fillStyle = lit ? C.terracotta : C.cardMute;
      ctx.fillRect(x + 3 + k * 4, y + 7, 3, 4);
    }
    // Dashed bracket over the window, then a check once she has thinned.
    ctx.fillStyle = C.terracotta;
    for (let k = 0; k < 11; k += 2) if (p > 0.45) ctx.fillRect(x + 11 + k, y + 13, 1, 1);
    if (p > 0.8) {
      ctx.fillStyle = C.cardInk;
      ctx.fillRect(x + 25, y + 17, 1, 1);
      ctx.fillRect(x + 26, y + 18, 1, 1);
      ctx.fillRect(x + 27, y + 17, 1, 1);
      ctx.fillRect(x + 28, y + 16, 1, 1);
      ctx.fillRect(x + 29, y + 15, 1, 1);
    }
  } else {
    for (let k = 0; k < 3; k += 1) {
      const hh = Math.round(9 * smooth(p, k * 0.15, k * 0.15 + 0.35));
      ctx.fillStyle = C.gold;
      ctx.fillRect(x + 5 + k * 7, y + 19 - hh, 5, hh);
    }
    if (p > 0.7) {
      ctx.fillStyle = C.cardInk;
      ctx.fillRect(x + 27, y + 12, 1, 1);
      ctx.fillRect(x + 28, y + 13, 1, 1);
      ctx.fillRect(x + 29, y + 12, 1, 1);
      ctx.fillRect(x + 30, y + 11, 1, 1);
      ctx.fillRect(x + 31, y + 10, 1, 1);
    }
  }
}

// ── Threads: quantise every pixel to the palette, dithered ──
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  (v) => (v / 16 - 0.5) * 30,
);

function buildLookup() {
  const table = new Uint8Array(16 * 16 * 16);
  for (let r = 0; r < 16; r += 1) {
    for (let g = 0; g < 16; g += 1) {
      for (let b = 0; b < 16; b += 1) {
        const [R, G, B] = [r * 17, g * 17, b * 17];
        let best = 0;
        let bestDistance = Infinity;
        PALETTE.forEach(([pr, pg, pb], i) => {
          // Weighted towards how eyes judge difference (green counts most).
          const d = (R - pr) ** 2 * 3 + (G - pg) ** 2 * 4 + (B - pb) ** 2 * 2;
          if (d < bestDistance) {
            bestDistance = d;
            best = i;
          }
        });
        table[(r << 8) | (g << 4) | b] = best;
      }
    }
  }
  return table;
}

/**
 * Creates the tapestry on `canvas` (sized W × H). Returns `draw(t)`.
 */
export function createTapestry(canvas) {
  canvas.width = W;
  canvas.height = H;
  const out = canvas.getContext('2d');
  const work = document.createElement('canvas');
  work.width = W;
  work.height = H;
  const ctx = work.getContext('2d', { willReadFrequently: true });
  const frame = paintFrame();
  const world = createWorld();
  const lookup = buildLookup();
  const flat = new Uint8Array(PALETTE.length * 3);
  PALETTE.forEach((rgb, i) => flat.set(rgb, i * 3));

  return (seconds) => {
    const t = ((seconds % LOOP) + LOOP) % LOOP;
    ctx.fillStyle = C.stone;
    ctx.fillRect(0, 0, W, H);
    drawWorld(ctx, t, world);
    ctx.drawImage(frame, 0, 0);
    drawCard(ctx, t);

    const image = ctx.getImageData(0, 0, W, H);
    const data = image.data;
    for (let y = 0, i = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1, i += 4) {
        const d = BAYER[((y & 3) << 2) | (x & 3)];
        const r = Math.min(255, Math.max(0, data[i] + d)) >> 4;
        const g = Math.min(255, Math.max(0, data[i + 1] + d)) >> 4;
        const b = Math.min(255, Math.max(0, data[i + 2] + d)) >> 4;
        const p = lookup[(r << 8) | (g << 4) | b] * 3;
        data[i] = flat[p];
        data[i + 1] = flat[p + 1];
        data[i + 2] = flat[p + 2];
        data[i + 3] = 255;
      }
    }
    out.putImageData(image, 0, 0);
  };
}
